"""Tests for restart-safe RobotState persistence."""

from datetime import datetime
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest

from trading_robot.state import RobotState, RobotStateStore
from trading_robot.types import OrderSide, Position, Regime
from trading_robot.types.enums import CooldownState, NewsLockState, PositionStatus, SessionState


class RobotStateStoreTests(unittest.TestCase):
    """Validates state save/load for VPS restart recovery."""

    def test_round_trip_persists_runtime_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "robot_state.json"
            store = RobotStateStore(path)
            state = RobotState(
                current_symbol="XAUUSD",
                current_regime=Regime.BULLISH,
                daily_pnl=Decimal("125.50"),
                daily_trade_count=2,
                trading_day=datetime(2026, 4, 10).date(),
                loss_streak=1,
                win_streak=2,
                cooldown_state=CooldownState.ACTIVE,
                cooldown_until=datetime(2026, 4, 10, 15, 0),
                session_state=SessionState.OPEN,
                news_lock_state=NewsLockState.CLEAR,
            )
            state.open_positions["ticket-1"] = Position(
                position_id="ticket-1",
                symbol="XAUUSD",
                side=OrderSide.BUY,
                volume=Decimal("0.50"),
                entry_price=Decimal("2300.10"),
                stop_loss=Decimal("2295.00"),
                take_profit=Decimal("2305.20"),
                status=PositionStatus.OPEN,
                opened_at=datetime(2026, 4, 10, 13, 0),
                metadata={"initial_stop_loss": Decimal("2295.00")},
            )

            store.save(state)
            restored = store.load()

            self.assertEqual(restored.current_symbol, "XAUUSD")
            self.assertEqual(restored.current_regime, Regime.BULLISH)
            self.assertEqual(restored.daily_pnl, Decimal("125.50"))
            self.assertEqual(restored.daily_trade_count, 2)
            self.assertEqual(restored.cooldown_state, CooldownState.ACTIVE)
            self.assertEqual(restored.session_state, SessionState.OPEN)
            self.assertEqual(restored.news_lock_state, NewsLockState.CLEAR)
            self.assertIn("ticket-1", restored.open_positions)
            self.assertEqual(restored.open_positions["ticket-1"].metadata["initial_stop_loss"], Decimal("2295.00"))


if __name__ == "__main__":
    unittest.main()
