"""Tests for the TopstepX/ProjectX execution client."""

from __future__ import annotations

import json
from decimal import Decimal
import unittest
from urllib.request import Request

from trading_robot.accounts.adapters import TopstepAdapter
from trading_robot.accounts.models import ManagedAccount, MasterTradeSignal
from trading_robot.config import TopstepXConfig
from trading_robot.execution.topstepx import TopstepXExecutionClient
from trading_robot.types import BrokerType, OrderRequest, OrderSide, OrderStatus, OrderType, Position


class FakeTopstepTransport:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str, dict[str, str], dict[str, object] | None]] = []

    def __call__(self, request: Request, timeout: int):
        body = json.loads(request.data.decode("utf-8")) if request.data else None
        headers = dict(request.header_items())
        self.requests.append((request.full_url, request.get_method(), headers, body))
        if request.full_url.endswith("/api/Auth/loginKey"):
            return 200, {}, json.dumps({"token": "token-123"}).encode("utf-8")
        if request.full_url.endswith("/api/Auth/validate"):
            return 200, {}, json.dumps({"ok": True}).encode("utf-8")
        if "/api/Account/search" in request.full_url:
            return 200, {}, json.dumps({"items": [{"id": 101, "name": "Sim-101", "canTrade": True, "active": True}]}).encode("utf-8")
        if "/api/Contract/search" in request.full_url:
            if "MGC" in request.full_url:
                payload = {"items": [{"id": "c-mgc", "name": "MGCM4", "symbolId": "MGC", "tickSize": 0.1}]}
            else:
                payload = {"items": [{"id": "c-mnq", "name": "MNQM4", "symbolId": "MNQ", "tickSize": 0.25}]}
            return 200, {}, json.dumps(payload).encode("utf-8")
        if request.full_url.endswith("/api/Order/place"):
            return 200, {}, json.dumps({"orderId": "ord-1"}).encode("utf-8")
        if request.full_url.endswith("/api/Position/closeContract"):
            return 200, {}, json.dumps({"orderId": "close-1"}).encode("utf-8")
        if request.full_url.endswith("/api/Position/partialCloseContract"):
            return 200, {}, json.dumps({"orderId": "partial-1"}).encode("utf-8")
        if request.full_url.endswith("/api/Order/modify"):
            return 200, {}, json.dumps({"orderId": "mod-1"}).encode("utf-8")
        raise AssertionError(f"unexpected request: {request.full_url}")


class TopstepXClientTests(unittest.TestCase):
    def _client(self, transport: FakeTopstepTransport) -> TopstepXExecutionClient:
        return TopstepXExecutionClient(
            TopstepXConfig(username="user", api_key="key", account_name="Sim-101"),
            transport=transport,
        )

    def test_open_trade_authenticates_and_places_order(self) -> None:
        transport = FakeTopstepTransport()
        client = self._client(transport)

        result = client.open_trade(
            OrderRequest(
                symbol="XAUUSD",
                side=OrderSide.BUY,
                order_type=OrderType.MARKET,
                volume=Decimal("1"),
                stop_loss=Decimal("2300.0"),
                take_profit=Decimal("2305.0"),
                price=Decimal("2302.0"),
            )
        )

        self.assertEqual(result.status, OrderStatus.ACCEPTED)
        self.assertEqual(result.order_id, "ord-1")
        self.assertTrue(any(url.endswith("/api/Auth/loginKey") for url, _, _, _ in transport.requests))
        place = next(body for url, _, _, body in transport.requests if url.endswith("/api/Order/place"))
        self.assertEqual(place["accountId"], 101)
        self.assertEqual(place["contractId"], "c-mgc")
        self.assertEqual(place["size"], 1)

    def test_close_and_partial_close_use_contract_close_endpoints(self) -> None:
        transport = FakeTopstepTransport()
        client = self._client(transport)
        position = Position(
            position_id="p1",
            symbol="NAS100",
            side=OrderSide.BUY,
            volume=Decimal("2"),
            entry_price=Decimal("18000"),
            metadata={"account_id": 101, "contract_id": "c-mnq"},
        )

        close = client.close_position(position)
        partial = client.partial_close_position(position, Decimal("1"))

        self.assertEqual(close.order_id, "close-1")
        self.assertEqual(partial.order_id, "partial-1")

    def test_modify_position_requires_order_id(self) -> None:
        transport = FakeTopstepTransport()
        client = self._client(transport)
        missing = Position("p1", "XAUUSD", OrderSide.BUY, Decimal("1"), Decimal("2300"))

        result = client.modify_position(missing)

        self.assertEqual(result.status, OrderStatus.REJECTED)

    def test_topstep_adapter_executes_when_client_is_configured(self) -> None:
        transport = FakeTopstepTransport()
        client = self._client(transport)
        adapter = TopstepAdapter(client)
        account = ManagedAccount("101", BrokerType.TOPSTEPX, Decimal("50000"), Decimal("50000"))
        signal = MasterTradeSignal(
            symbol="XAUUSD",
            direction=OrderSide.BUY,
            entry=Decimal("2302"),
            stop_loss=Decimal("2300"),
            take_profit=Decimal("2305"),
            risk_pct=Decimal("0.005"),
            signal_id="sig-1",
        )

        result = adapter.execute(account, signal, Decimal("1"))

        self.assertTrue(result.success)
        self.assertEqual(result.ticket, "ord-1")


if __name__ == "__main__":
    unittest.main()
