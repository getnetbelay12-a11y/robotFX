"""Smoke tests for the Phase 1 scaffold."""

from datetime import datetime
from decimal import Decimal
import unittest

from trading_robot.backtesting import BacktestStats
from trading_robot.config import SystemConfig
from trading_robot.state import RobotState
from trading_robot.types import Regime


class ScaffoldTests(unittest.TestCase):
    """Verifies that the foundational objects are importable and usable."""

    def test_system_config_defaults(self) -> None:
        config = SystemConfig()

        self.assertEqual(config.strategy.timeframes.regime_timeframe, "H1")
        self.assertEqual(config.strategy.timeframes.structure_timeframe, "M15")
        self.assertEqual(config.strategy.timeframes.execution_timeframe, "M5")

    def test_robot_state_tracks_symbol_and_regime(self) -> None:
        state = RobotState()

        state.set_symbol("EURUSD")
        state.update_regime(Regime.BULLISH)

        self.assertEqual(state.current_symbol, "EURUSD")
        self.assertEqual(state.current_regime, Regime.BULLISH)
        self.assertIsInstance(state.last_updated_at, datetime)

    def test_backtest_stats_win_rate(self) -> None:
        stats = BacktestStats()

        stats.record_trade(Decimal("100"))
        stats.record_trade(Decimal("-50"))

        self.assertEqual(stats.trades, 2)
        self.assertEqual(stats.win_rate, Decimal("0.5"))


if __name__ == "__main__":
    unittest.main()
