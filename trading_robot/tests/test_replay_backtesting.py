"""Tests for strategy replay backtesting and live readiness."""

from datetime import datetime, timedelta
from decimal import Decimal
import tempfile
import unittest

from trading_robot.backtesting import StrategyReplayBacktestEngine, aggregate_bars
from trading_robot.config import ProductionConfig, StrategyConfig, SystemConfig
from trading_robot.operations import LiveReadinessChecker
from trading_robot.types import Bar, Timeframe, SymbolSpec


def _m1_bar(symbol: str, index: int, close: Decimal) -> Bar:
    return Bar(
        symbol=symbol,
        timeframe=Timeframe.M1,
        timestamp=datetime(2024, 1, 1, 0, 0) + timedelta(minutes=index),
        open=close - Decimal("0.1"),
        high=close + Decimal("0.2"),
        low=close - Decimal("0.2"),
        close=close,
        volume=Decimal("1"),
    )


class ReplayBacktestingTests(unittest.TestCase):
    def test_aggregate_bars_builds_higher_timeframes(self) -> None:
        m1 = [_m1_bar("EURUSD", index, Decimal("1.10") + (Decimal(index) * Decimal("0.001"))) for index in range(60)]

        m5 = aggregate_bars("EURUSD", Timeframe.M5, m1)
        h1 = aggregate_bars("EURUSD", Timeframe.H1, m1)

        self.assertEqual(len(m5), 12)
        self.assertEqual(len(h1), 1)
        self.assertEqual(h1[0].open, m1[0].open)
        self.assertEqual(h1[0].close, m1[-1].close)

    def test_replay_engine_runs_without_proxy_logic(self) -> None:
        engine = StrategyReplayBacktestEngine(
            SystemConfig(
                strategy=StrategyConfig(minimum_setup_score=1),
                production=ProductionConfig(live_trading_enabled=True),
            )
        )
        m1 = [_m1_bar("EURUSD", index, Decimal("1.1000") + (Decimal(index % 10) * Decimal("0.0005"))) for index in range(60 * 24 * 20)]
        bars = {
            Timeframe.M5: aggregate_bars("EURUSD", Timeframe.M5, m1),
            Timeframe.M15: aggregate_bars("EURUSD", Timeframe.M15, m1),
            Timeframe.H1: aggregate_bars("EURUSD", Timeframe.H1, m1),
        }

        result = engine.run_symbol(
            "EURUSD",
            bars,
            symbol_spec=SymbolSpec(symbol="EURUSD", tick_size=Decimal("0.0001"), tick_value=Decimal("10")),
        )

        self.assertIsNotNone(result.stats)
        self.assertGreaterEqual(result.stats.trades, 0)

    def test_live_readiness_blocks_missing_specs(self) -> None:
        checker = LiveReadinessChecker()
        with tempfile.TemporaryDirectory() as tmp:
            report = checker.evaluate(
                config=SystemConfig(production=ProductionConfig(live_trading_enabled=True, state_file_path=f"{tmp}/state.json", log_file_path=f"{tmp}/robot.log")),
                symbols=("XAUUSD",),
                symbol_specs={},
                data_root=tmp,
            )

        self.assertFalse(report.ready)
        self.assertTrue(any(item.name == "symbol_spec:XAUUSD" and not item.passed for item in report.items))


if __name__ == "__main__":
    unittest.main()
