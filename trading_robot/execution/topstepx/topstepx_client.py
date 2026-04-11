"""ProjectX/TopstepX execution client.

This adapter uses the official ProjectX Gateway REST API for authentication,
account discovery, contract lookup, order placement, and position management.
Realtime SignalR hubs are configured in TopstepXConfig but not consumed here;
the REST path is enough to execute and manage trades from the robot today.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Callable

from trading_robot.config import TopstepXConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.journal.logger import TradingLogger
from trading_robot.types.enums import OrderSide, OrderStatus, OrderType
from trading_robot.types.models import OrderRequest, OrderResult, Position


@dataclass(frozen=True)
class TopstepXAccount:
    """Normalized TopstepX account metadata."""

    id: int
    name: str
    can_trade: bool = True
    active: bool = True


@dataclass(frozen=True)
class TopstepXContract:
    """Normalized TopstepX contract metadata."""

    id: str
    name: str
    symbol_id: str
    tick_size: Decimal
    description: str = ""


class TopstepXExecutionClient(ExecutionClient):
    """Execution client backed by the official ProjectX Gateway REST API."""

    def __init__(
        self,
        config: TopstepXConfig,
        logger: TradingLogger | None = None,
        transport: Callable[[urllib.request.Request, int], tuple[int, dict[str, str], bytes]] | None = None,
    ) -> None:
        self._config = config
        self._logger = logger or TradingLogger()
        self._transport = transport or self._default_transport
        self._token: str | None = None
        self._token_expires_at: datetime | None = None
        self._account_id: int | None = config.account_id
        self._contracts_by_alias: dict[str, TopstepXContract] = {}

    def connect(self) -> None:
        """Authenticate and warm the account/contract caches."""

        self._authenticate()
        if self._config.validate_token_on_connect:
            self._validate_session()
        self._account_id = self._resolve_account_id()

    def disconnect(self) -> None:
        """Forget session-local cached state."""

        self._token = None
        self._token_expires_at = None
        self._contracts_by_alias.clear()

    def open_trade(self, request: OrderRequest) -> OrderResult:
        """Place a market/limit/stop order with optional stop/target brackets."""

        try:
            self._ensure_session()
            account_id = self._resolve_account_id(request.metadata.get("account_id"))
            contract = self._resolve_contract(
                symbol=request.symbol,
                explicit_contract_id=request.metadata.get("contract_id"),
            )
            size = self._normalize_size(request.volume)
            if size <= 0:
                return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX futures size must be >= 1 contract")

            payload: dict[str, Any] = {
                "accountId": account_id,
                "contractId": contract.id,
                "side": self._order_side(request.side),
                "size": size,
                "type": self._order_type(request.order_type),
                "customTag": self._custom_tag(request),
            }
            if request.price is not None and request.order_type in {OrderType.LIMIT, OrderType.STOP}:
                payload["limitPrice"] = self._to_number(request.price)
            sl_ticks = self._ticks_between(request.price, request.stop_loss, contract.tick_size) if request.stop_loss is not None and request.price is not None else None
            tp_ticks = self._ticks_between(request.price, request.take_profit, contract.tick_size) if request.take_profit is not None and request.price is not None else None
            if sl_ticks is not None:
                payload["stopLossTicks"] = sl_ticks
            if tp_ticks is not None:
                payload["takeProfitTicks"] = tp_ticks

            response = self._request_json("POST", "/api/Order/place", payload)
            order_id = self._extract_identifier(response, ("orderId", "id", "bracketId"))
            return OrderResult(
                order_id=order_id,
                status=OrderStatus.ACCEPTED if order_id is not None else OrderStatus.REJECTED,
                message="" if order_id is not None else f"TopstepX order not acknowledged: {response}",
                filled_volume=request.volume if order_id is not None else Decimal("0"),
                average_price=request.price,
                metadata={
                    "account_id": account_id,
                    "contract_id": contract.id,
                    "contract_symbol_id": contract.symbol_id,
                    "raw_response": response,
                },
            )
        except Exception as exc:
            self._logger.exception("topstepx open_trade failed", symbol=request.symbol, error=str(exc))
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message=str(exc))

    def close_position(self, position: Position) -> OrderResult:
        """Close a full futures position by contract."""

        return self._close_contract_position(position=position, size=self._normalize_size(position.volume))

    def partial_close_position(self, position: Position, volume: Decimal) -> OrderResult:
        """Close a partial futures position by contract."""

        return self._close_contract_position(position=position, size=self._normalize_size(volume))

    def modify_position(self, position: Position) -> OrderResult:
        """Modify a working order when order metadata is available.

        ProjectX order modification is order-based, not position-based. The
        caller must preserve `order_id` in Position.metadata.
        """

        order_id = position.metadata.get("order_id")
        if not order_id:
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX modify requires position.metadata['order_id']")

        try:
            self._ensure_session()
            contract = self._resolve_contract(position.symbol, explicit_contract_id=position.metadata.get("contract_id"))
            payload: dict[str, Any] = {
                "accountId": self._resolve_account_id(position.metadata.get("account_id")),
                "orderId": order_id,
                "contractId": contract.id,
                "customTag": position.metadata.get("custom_tag", f"{self._config.order_tag_prefix}-modify"),
            }
            if position.stop_loss is not None:
                payload["stopPrice"] = self._to_number(position.stop_loss)
            if position.take_profit is not None:
                payload["limitPrice"] = self._to_number(position.take_profit)
            response = self._request_json("POST", "/api/Order/modify", payload)
            updated_id = self._extract_identifier(response, ("orderId", "id")) or str(order_id)
            return OrderResult(order_id=updated_id, status=OrderStatus.ACCEPTED, metadata={"raw_response": response})
        except Exception as exc:
            self._logger.exception("topstepx modify_position failed", symbol=position.symbol, error=str(exc))
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message=str(exc))

    def search_accounts(self) -> tuple[TopstepXAccount, ...]:
        """Return all accessible accounts from the gateway."""

        self._ensure_session()
        response = self._request_json("GET", "/api/Account/search")
        items = self._extract_items(response)
        accounts = []
        for item in items:
            account_id = self._extract_identifier(item, ("id", "accountId"))
            if account_id is None:
                continue
            accounts.append(
                TopstepXAccount(
                    id=int(account_id),
                    name=str(item.get("name") or item.get("accountName") or account_id),
                    can_trade=bool(item.get("canTrade", True)),
                    active=bool(item.get("active", True)),
                )
            )
        return tuple(accounts)

    def search_contracts(self, query: str) -> tuple[TopstepXContract, ...]:
        """Search available contracts by symbol alias or explicit query."""

        self._ensure_session()
        params = {"query": query}
        response = self._request_json("GET", f"/api/Contract/search?{urllib.parse.urlencode(params)}")
        items = self._extract_items(response)
        contracts = []
        for item in items:
            contract_id = self._extract_identifier(item, ("id", "contractId"))
            symbol_id = str(item.get("symbolId") or item.get("symbol") or query)
            if contract_id is None:
                continue
            contracts.append(
                TopstepXContract(
                    id=str(contract_id),
                    name=str(item.get("name") or item.get("contractName") or symbol_id),
                    symbol_id=symbol_id,
                    tick_size=Decimal(str(item.get("tickSize", "0.25"))),
                    description=str(item.get("description") or ""),
                )
            )
        return tuple(contracts)

    def search_open_positions(self, account_id: int | None = None) -> tuple[dict[str, Any], ...]:
        """Return open positions from the gateway."""

        self._ensure_session()
        resolved_account_id = self._resolve_account_id(account_id)
        response = self._request_json("GET", f"/api/Position/searchOpen?{urllib.parse.urlencode({'accountId': resolved_account_id})}")
        return tuple(self._extract_items(response))

    def cancel_order(self, order_id: str, account_id: int | None = None) -> OrderResult:
        """Cancel a working order."""

        try:
            self._ensure_session()
            payload = {"accountId": self._resolve_account_id(account_id), "orderId": order_id}
            response = self._request_json("POST", "/api/Order/cancel", payload)
            return OrderResult(order_id=str(order_id), status=OrderStatus.CANCELLED, metadata={"raw_response": response})
        except Exception as exc:
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message=str(exc))

    def _close_contract_position(self, position: Position, size: int) -> OrderResult:
        if size <= 0:
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX close size must be >= 1 contract")
        try:
            self._ensure_session()
            account_id = self._resolve_account_id(position.metadata.get("account_id"))
            contract = self._resolve_contract(position.symbol, explicit_contract_id=position.metadata.get("contract_id"))
            endpoint = "/api/Position/closeContract" if size >= self._normalize_size(position.volume) else "/api/Position/partialCloseContract"
            payload = {
                "accountId": account_id,
                "contractId": contract.id,
                "size": size,
            }
            response = self._request_json("POST", endpoint, payload)
            close_id = self._extract_identifier(response, ("orderId", "id", "positionId"))
            return OrderResult(
                order_id=close_id,
                status=OrderStatus.ACCEPTED if close_id is not None else OrderStatus.REJECTED,
                message="" if close_id is not None else f"TopstepX close not acknowledged: {response}",
                filled_volume=Decimal(size),
                metadata={"raw_response": response, "account_id": account_id, "contract_id": contract.id},
            )
        except Exception as exc:
            self._logger.exception("topstepx close_position failed", symbol=position.symbol, error=str(exc))
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message=str(exc))

    def _authenticate(self) -> None:
        if not self._config.username or not self._config.api_key:
            raise ValueError("TopstepX username/api_key must be configured")
        payload = {"userName": self._config.username, "apiKey": self._config.api_key}
        response = self._request_json("POST", "/api/Auth/loginKey", payload, include_auth=False)
        token = response.get("token") or response.get("accessToken") or response.get("jwt")
        if not token:
            raise ValueError(f"TopstepX auth token missing from response: {response}")
        self._token = str(token)
        self._token_expires_at = datetime.utcnow() + timedelta(hours=23)

    def _validate_session(self) -> None:
        self._request_json("GET", "/api/Auth/validate", include_auth=True)

    def _ensure_session(self) -> None:
        if self._token is None or (self._token_expires_at is not None and datetime.utcnow() >= self._token_expires_at):
            self._authenticate()

    def _resolve_account_id(self, explicit: Any = None) -> int:
        if explicit is not None:
            return int(explicit)
        if self._account_id is not None:
            return int(self._account_id)
        accounts = self.search_accounts()
        if self._config.account_name:
            for account in accounts:
                if account.name == self._config.account_name:
                    self._account_id = account.id
                    return account.id
        for account in accounts:
            if account.active and account.can_trade:
                self._account_id = account.id
                return account.id
        raise ValueError("no active TopstepX account available")

    def _resolve_contract(self, symbol: str, explicit_contract_id: Any = None) -> TopstepXContract:
        if explicit_contract_id is not None:
            cached = self._contracts_by_alias.get(str(explicit_contract_id))
            if cached is not None:
                return cached
        aliases = self._config.symbol_aliases.get(symbol.upper(), (symbol.upper(),))
        for alias in aliases:
            cached = self._contracts_by_alias.get(alias)
            if cached is not None:
                return cached
            contracts = self.search_contracts(alias)
            preferred = self._select_preferred_contract(contracts)
            if preferred is not None:
                self._contracts_by_alias[alias] = preferred
                self._contracts_by_alias[preferred.id] = preferred
                return preferred
        raise ValueError(f"no TopstepX contract found for symbol {symbol}")

    def _select_preferred_contract(self, contracts: tuple[TopstepXContract, ...]) -> TopstepXContract | None:
        if not contracts:
            return None
        if not self._config.prefer_micro_contracts:
            return contracts[0]
        for contract in contracts:
            name = contract.name.upper()
            if any(name.startswith(prefix) for prefix in ("M", "MICRO")):
                return contract
        return contracts[0]

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        *,
        include_auth: bool = True,
    ) -> dict[str, Any]:
        url = f"{self._config.api_base_url.rstrip('/')}{path}"
        body = None
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
        if include_auth:
            if not self._token:
                raise ValueError("TopstepX session token is missing")
            headers["Authorization"] = f"Bearer {self._token}"
        request = urllib.request.Request(url=url, data=body, headers=headers, method=method)
        try:
            status_code, response_headers, response_body = self._transport(request, self._config.request_timeout_seconds)
        except urllib.error.HTTPError as exc:
            response_body = exc.read()
            raise ValueError(f"TopstepX HTTP {exc.code}: {response_body.decode('utf-8', 'ignore')}") from exc
        except urllib.error.URLError as exc:
            raise ValueError(f"TopstepX network error: {exc.reason}") from exc
        if status_code >= 400:
            raise ValueError(f"TopstepX HTTP {status_code}: {response_body.decode('utf-8', 'ignore')}")
        if not response_body:
            return {}
        decoded = json.loads(response_body.decode("utf-8"))
        if isinstance(decoded, dict):
            return decoded
        return {"items": decoded, "headers": response_headers}

    def _default_transport(self, request: urllib.request.Request, timeout: int) -> tuple[int, dict[str, str], bytes]:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.getcode(), dict(response.headers.items()), response.read()

    def _order_side(self, side: OrderSide) -> int:
        return 0 if side == OrderSide.BUY else 1

    def _order_type(self, order_type: OrderType) -> int:
        return {
            OrderType.MARKET: 0,
            OrderType.LIMIT: 1,
            OrderType.STOP: 2,
        }[order_type]

    def _normalize_size(self, volume: Decimal) -> int:
        return int(volume.to_integral_value(rounding=ROUND_HALF_UP))

    def _custom_tag(self, request: OrderRequest) -> str:
        signal_id = request.metadata.get("signal_id")
        if signal_id:
            return f"{self._config.order_tag_prefix}-{signal_id}"
        return f"{self._config.order_tag_prefix}-{request.symbol.lower()}"

    def _ticks_between(self, entry: Decimal | None, target: Decimal | None, tick_size: Decimal) -> int | None:
        if entry is None or target is None or tick_size <= 0:
            return None
        ticks = abs(target - entry) / tick_size
        return int(ticks.to_integral_value(rounding=ROUND_HALF_UP))

    def _to_number(self, value: Decimal) -> float:
        return float(value)

    def _extract_items(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        if isinstance(payload.get("items"), list):
            return [item for item in payload["items"] if isinstance(item, dict)]
        if isinstance(payload.get("data"), list):
            return [item for item in payload["data"] if isinstance(item, dict)]
        if isinstance(payload.get("results"), list):
            return [item for item in payload["results"] if isinstance(item, dict)]
        return []

    def _extract_identifier(self, payload: dict[str, Any], keys: tuple[str, ...]) -> str | None:
        for key in keys:
            value = payload.get(key)
            if value is not None:
                return str(value)
        data = payload.get("data")
        if isinstance(data, dict):
            for key in keys:
                value = data.get(key)
                if value is not None:
                    return str(value)
        return None
