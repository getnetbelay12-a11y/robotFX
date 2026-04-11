"""Cross-platform execution adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from decimal import Decimal

from trading_robot.accounts.models import AccountExecutionResult, ManagedAccount, MasterTradeSignal
from trading_robot.execution.topstepx import TopstepXExecutionClient
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.types.enums import BrokerType, OrderStatus, OrderType
from trading_robot.types.models import OrderRequest


class ExecutionAdapter(ABC):
    """Common adapter contract for all execution platforms."""

    broker_type: BrokerType

    @abstractmethod
    def execute(self, account: ManagedAccount, signal: MasterTradeSignal, volume: Decimal) -> AccountExecutionResult:
        """Execute a normalized signal for one account."""


class MT5Adapter(ExecutionAdapter):
    """MT5 adapter backed by an ExecutionClient or future MQL5 bridge."""

    broker_type = BrokerType.MT5

    def __init__(self, client: ExecutionClient) -> None:
        self._client = client

    def execute(self, account: ManagedAccount, signal: MasterTradeSignal, volume: Decimal) -> AccountExecutionResult:
        """Execute through the broker-neutral Python client interface."""

        request = OrderRequest(
            symbol=signal.symbol,
            side=signal.direction,
            order_type=OrderType.MARKET,
            volume=volume,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            price=signal.entry,
            comment=signal.strategy_type,
            metadata={"account_id": account.account_id, "signal_id": signal.signal_id},
        )
        result = self._client.open_trade(request)
        return AccountExecutionResult(
            account_id=account.account_id,
            success=bool(result.order_id),
            ticket=result.order_id,
            error_message=result.message,
            risk_used=account.equity * signal.risk_pct,
        )


class TopstepAdapter(ExecutionAdapter):
    """Topstep-style futures adapter backed by TopstepXExecutionClient."""

    broker_type = BrokerType.TOPSTEPX

    def __init__(self, client: TopstepXExecutionClient | None = None) -> None:
        self._client = client

    def execute(self, account: ManagedAccount, signal: MasterTradeSignal, volume: Decimal) -> AccountExecutionResult:
        """Execute on TopstepX when a live client is configured."""

        if self._client is None:
            account.active = False
            return AccountExecutionResult(
                account_id=account.account_id,
                success=False,
                error_message="Topstep adapter is not configured with a TopstepXExecutionClient",
                risk_used=account.equity * signal.risk_pct,
            )

        request = OrderRequest(
            symbol=signal.symbol,
            side=signal.direction,
            order_type=OrderType.MARKET,
            volume=volume,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            price=signal.entry,
            comment=signal.strategy_type,
            metadata={"account_id": account.account_id, "signal_id": signal.signal_id},
        )
        result = self._client.open_trade(request)
        success = result.status in {OrderStatus.ACCEPTED, OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED}
        if not success:
            account.active = False
        return AccountExecutionResult(
            account_id=account.account_id,
            success=success,
            ticket=result.order_id,
            error_message=result.message,
            risk_used=account.equity * signal.risk_pct,
        )
