"""Tests for risk sizing and risk gates."""

from datetime import datetime
from decimal import Decimal
import unittest

from trading_robot.config import RiskConfig
from trading_robot.risk import RiskManager
from trading_robot.state import RobotState
from trading_robot.types import (
    AccountSnapshot,
    MarketSnapshot,
    OrderSide,
    Position,
    SignalDecision,
    SymbolSpec,
    TradeSignal,
)


class RiskManagerTests(unittest.TestCase):
    """Validates broker-neutral risk calculations."""

    def setUp(self) -> None:
        self.account = AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000"))
        self.symbol_spec = SymbolSpec(
            symbol="TEST",
            tick_size=Decimal("0.01"),
            tick_value=Decimal("1"),
            min_volume=Decimal("0.01"),
            volume_step=Decimal("0.01"),
            max_volume=Decimal("100"),
        )
        self.market = MarketSnapshot(
            symbol="TEST",
            bars_by_timeframe={},
            bid=Decimal("99.99"),
            ask=Decimal("100.00"),
            symbol_spec=self.symbol_spec,
        )
        self.signal = TradeSignal(
            symbol="TEST",
            decision=SignalDecision.LONG,
            side=OrderSide.BUY,
            entry_price=Decimal("100"),
            stop_loss=Decimal("99"),
        )

    def test_lot_size_uses_stop_distance_and_symbol_spec(self) -> None:
        manager = RiskManager(RiskConfig(max_risk_per_trade_pct=Decimal("0.01")))

        decision = manager.calculate_risk(
            signal=self.signal,
            market=self.market,
            account=self.account,
            state=RobotState(),
            timestamp=datetime(2026, 4, 10),
        )

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.risk_amount, Decimal("100.00"))
        self.assertEqual(decision.stop_distance, Decimal("1"))
        self.assertEqual(decision.risk_per_unit, Decimal("100"))
        self.assertEqual(decision.volume, Decimal("1.00"))

    def test_daily_loss_cap_blocks_new_trades(self) -> None:
        manager = RiskManager(RiskConfig(max_daily_loss_pct=Decimal("0.02")))
        state = RobotState(daily_pnl=Decimal("-200"), trading_day=datetime(2026, 4, 10).date())

        decision = manager.calculate_risk(
            signal=self.signal,
            market=self.market,
            account=self.account,
            state=state,
            timestamp=datetime(2026, 4, 10),
        )

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "daily loss cap reached")

    def test_trade_count_and_open_position_limits_block_new_trades(self) -> None:
        manager = RiskManager(RiskConfig(max_trades_per_day=1, max_open_positions=1))
        state = RobotState(daily_trade_count=1, trading_day=datetime(2026, 4, 10).date())

        decision = manager.calculate_risk(
            signal=self.signal,
            market=self.market,
            account=self.account,
            state=state,
            timestamp=datetime(2026, 4, 10),
        )

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "maximum trades per day reached")

        state.daily_trade_count = 0
        state.open_positions["1"] = Position(
            position_id="1",
            symbol="TEST",
            side=OrderSide.BUY,
            volume=Decimal("1"),
            entry_price=Decimal("100"),
        )
        decision = manager.calculate_risk(
            signal=self.signal,
            market=self.market,
            account=self.account,
            state=state,
            timestamp=datetime(2026, 4, 10),
        )

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "maximum open positions reached")

    def test_loss_streak_activates_cooldown(self) -> None:
        state = RobotState(trading_day=datetime(2026, 4, 10).date())

        state.apply_trade_outcome(
            pnl=Decimal("-50"),
            max_loss_streak_before_cooldown=1,
            cooldown_minutes=30,
            timestamp=datetime(2026, 4, 10, 9, 0),
        )

        self.assertEqual(state.loss_streak, 1)
        self.assertIsNotNone(state.cooldown_until)


if __name__ == "__main__":
    unittest.main()

