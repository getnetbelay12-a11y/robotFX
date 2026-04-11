"""Tests for Phase 8 backtesting and optimization."""

from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest

from trading_robot.backtesting import (
    BacktestEngine,
    BacktestParameters,
    BacktestReporter,
    BacktestStats,
    OptimizationEngine,
    TradeRecord,
)
from trading_robot.types import Bar, Timeframe


def _bar(index: int, close: Decimal) -> Bar:
    return Bar(
        symbol="EURUSD",
        timeframe=Timeframe.M5,
        timestamp=datetime(2026, 4, 10, 7, 0) + timedelta(minutes=index * 5),
        open=close - Decimal("0.8"),
        high=close + Decimal("0.5"),
        low=close - Decimal("0.5"),
        close=close,
        volume=Decimal("100"),
    )


def _history(symbol: str = "EURUSD", count: int = 30):
    bars = [_bar(index, Decimal(100 + index)) for index in range(count)]
    bars = [
        Bar(
            symbol=symbol,
            timeframe=bar.timeframe,
            timestamp=bar.timestamp,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume,
        )
        for bar in bars
    ]
    return {symbol: {Timeframe.M5: bars}}


class BacktestingTests(unittest.TestCase):
    """Validates stats, logs, optimization split, and reports."""

    def test_backtest_stats_metrics(self) -> None:
        stats = BacktestStats(starting_equity=Decimal("10000"))
        stats.record_trade(
            Decimal("100"),
            TradeRecord(
                timestamp=datetime(2026, 4, 10, 8, 0),
                symbol="EURUSD",
                strategy_type="breakout",
                entry=Decimal("100"),
                exit=Decimal("102"),
                stop_loss=Decimal("99"),
                take_profit=Decimal("102"),
                r_result=Decimal("2"),
                pnl=Decimal("100"),
                session="london",
                news_condition="clear",
                volatility="high",
            ),
        )
        stats.record_trade(
            Decimal("-50"),
            TradeRecord(
                timestamp=datetime(2026, 4, 10, 9, 0),
                symbol="EURUSD",
                strategy_type="sweep",
                entry=Decimal("100"),
                exit=Decimal("99"),
                stop_loss=Decimal("99"),
                take_profit=Decimal("102"),
                r_result=Decimal("-1"),
                pnl=Decimal("-50"),
                session="new_york",
                news_condition="post_news",
                volatility="low",
            ),
        )

        self.assertEqual(stats.trades, 2)
        self.assertEqual(stats.win_rate, Decimal("0.5"))
        self.assertEqual(stats.profit_factor, Decimal("2"))
        self.assertEqual(stats.average_r, Decimal("0.5"))
        self.assertEqual(stats.best_session, "london")
        self.assertEqual(stats.worst_session, "new_york")
        self.assertEqual(stats.near_news_trades, 1)

    def test_backtest_engine_runs_multi_symbol(self) -> None:
        engine = BacktestEngine()
        result = engine.run(
            {
                **_history("XAUUSD", 30),
                **_history("NAS100", 30),
                **_history("EURUSD", 30),
            },
            BacktestParameters(tp_multiplier=Decimal("1.5")),
        )

        self.assertEqual(set(result.keys()), {"XAUUSD", "NAS100", "EURUSD"})
        self.assertTrue(all(item.stats.trades > 0 for item in result.values()))

    def test_optimizer_uses_out_of_sample_split(self) -> None:
        optimizer = OptimizationEngine(BacktestEngine())
        result = optimizer.optimize(
            _history("EURUSD", 40),
            parameter_grid={
                "risk_per_trade_pct": (Decimal("0.0025"),),
                "tp_multiplier": (Decimal("1.5"), Decimal("2")),
                "trailing_start_r": (Decimal("1.5"),),
                "ema_fast_period": (50,),
                "ema_slow_period": (200,),
                "atr_period": (14,),
                "score_threshold": (7,),
            },
        )

        self.assertIn("EURUSD", result.training)
        self.assertIn("EURUSD", result.validation)
        self.assertIn(result.best_parameters.tp_multiplier, {Decimal("1.5"), Decimal("2")})
        self.assertIn("tp_multiplier", result.stable_parameter_ranges)

    def test_reporter_writes_trade_log(self) -> None:
        stats = BacktestStats()
        record = TradeRecord(
            timestamp=datetime(2026, 4, 10, 8, 0),
            symbol="EURUSD",
            strategy_type="breakout",
            entry=Decimal("100"),
            exit=Decimal("102"),
            stop_loss=Decimal("99"),
            take_profit=Decimal("102"),
            r_result=Decimal("2"),
            pnl=Decimal("100"),
            session="london",
            news_condition="clear",
            volatility="high",
        )
        stats.record_trade(Decimal("100"), record)
        reporter = BacktestReporter()

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "trades.csv"
            reporter.write_trade_log(stats.records, path)
            content = path.read_text(encoding="utf-8")

        self.assertIn("timestamp,symbol,strategy_type", content)
        self.assertIn("EURUSD", content)


if __name__ == "__main__":
    unittest.main()
