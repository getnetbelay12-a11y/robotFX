"""Tests for Phase 9 multi-account and cross-platform execution."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
import unittest

from trading_robot.accounts import AccountManager, MT5Adapter, ManagedAccount, MasterSignalEngine, TopstepAdapter, TradeCopier
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.types import BrokerType, OrderRequest, OrderResult, OrderSide, OrderStatus, SignalDecision, TradeSignal


class RecordingExecutionClient(ExecutionClient):
    """Fake execution client that can fail one account."""

    def __init__(self, fail_account_id: str | None = None) -> None:
        self.fail_account_id = fail_account_id
        self.requests: list[OrderRequest] = []

    def connect(self) -> None:
        pass

    def disconnect(self) -> None:
        pass

    def open_trade(self, request: OrderRequest) -> OrderResult:
        self.requests.append(request)
        if request.metadata.get("account_id") == self.fail_account_id:
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="simulated failure")
        return OrderResult(order_id=f"ticket-{request.metadata['account_id']}", status=OrderStatus.FILLED)

    def close_position(self, position):
        return OrderResult(order_id="close", status=OrderStatus.FILLED)

    def partial_close_position(self, position, volume: Decimal) -> OrderResult:
        return OrderResult(order_id="partial", status=OrderStatus.FILLED)

    def modify_position(self, position):
        return OrderResult(order_id="modify", status=OrderStatus.FILLED)


class MultiAccountTests(unittest.TestCase):
    """Validates master signal, account manager, and trade copier behavior."""

    def _signal(self):
        signal = TradeSignal(
            symbol="EURUSD",
            decision=SignalDecision.LONG,
            side=OrderSide.BUY,
            entry_price=Decimal("100"),
            stop_loss=Decimal("99"),
            take_profit=Decimal("102"),
            metadata={"strategy_type": "breakout"},
        )
        master = MasterSignalEngine().GenerateTradeSignal(signal)
        self.assertIsNotNone(master)
        return master

    def test_master_signal_engine_outputs_shared_format(self) -> None:
        master = self._signal()

        self.assertEqual(master.symbol, "EURUSD")
        self.assertEqual(master.risk_pct, Decimal("0.005"))
        self.assertEqual(master.as_output()["risk %"], Decimal("0.005"))

    def test_account_manager_compliance(self) -> None:
        account = ManagedAccount(
            account_id="a1",
            broker_type=BrokerType.MT5,
            balance=Decimal("100000"),
            equity=Decimal("100000"),
            daily_pnl=Decimal("-1500"),
            trading_day=datetime(2026, 4, 10).date(),
        )
        manager = AccountManager((account,))

        allowed, reason = manager.can_trade(account, self._signal(), datetime(2026, 4, 10, 14, 0))

        self.assertFalse(allowed)
        self.assertEqual(reason, "daily loss limit reached")

    def test_trade_copier_sends_to_active_accounts_and_skips_topstep_placeholder(self) -> None:
        mt5_account = ManagedAccount("mt5-1", BrokerType.MT5, Decimal("100000"), Decimal("100000"))
        topstep_account = ManagedAccount("topstep-1", BrokerType.TOPSTEPX, Decimal("50000"), Decimal("50000"))
        manager = AccountManager((mt5_account, topstep_account))
        client = RecordingExecutionClient()
        copier = TradeCopier(
            account_manager=manager,
            adapters={BrokerType.MT5: MT5Adapter(client), BrokerType.TOPSTEPX: TopstepAdapter()},
        )

        result = copier.CopySignal(self._signal(), datetime(2026, 4, 10, 14, 0))

        self.assertEqual(len(result.results), 2)
        self.assertTrue(result.results[0].success)
        self.assertFalse(result.results[1].success)
        self.assertEqual(mt5_account.daily_trade_count, 1)
        self.assertFalse(topstep_account.active)

    def test_trade_copier_isolates_failed_account_and_prevents_duplicates(self) -> None:
        failing = ManagedAccount("bad", BrokerType.MT5, Decimal("100000"), Decimal("100000"))
        good = ManagedAccount("good", BrokerType.MT5, Decimal("100000"), Decimal("100000"))
        manager = AccountManager((failing, good))
        client = RecordingExecutionClient(fail_account_id="bad")
        copier = TradeCopier(account_manager=manager, adapters={BrokerType.MT5: MT5Adapter(client)})
        signal = self._signal()

        first = copier.CopySignal(signal, datetime(2026, 4, 10, 14, 0))
        second = copier.CopySignal(signal, datetime(2026, 4, 10, 14, 0))

        self.assertFalse(failing.active)
        self.assertTrue(good.active)
        self.assertEqual(good.daily_trade_count, 1)
        self.assertEqual(len(client.requests), 2)
        self.assertTrue(any(result.error_message == "duplicate execution skipped" for result in second.results))
        self.assertTrue(any(result.success for result in first.results))


if __name__ == "__main__":
    unittest.main()
