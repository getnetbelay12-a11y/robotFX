"""Tests for Phase 12 live performance optimization."""

from datetime import datetime
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest

from trading_robot.backtesting import TradeRecord
from trading_robot.config import LiveOptimizationConfig
from trading_robot.research import LivePerformanceOptimizer, LiveTradeDatabase
from trading_robot.scoring import SetupScorer


def _trade(
    timestamp_hour: int,
    symbol: str,
    strategy_type: str,
    pnl: str,
    r_result: str,
    session: str,
    news_condition: str = "clear",
) -> TradeRecord:
    return TradeRecord(
        timestamp=datetime(2026, 4, 10, timestamp_hour, 0),
        symbol=symbol,
        strategy_type=strategy_type,
        entry=Decimal("100"),
        exit=Decimal("101"),
        stop_loss=Decimal("99"),
        take_profit=Decimal("102"),
        r_result=Decimal(r_result),
        pnl=Decimal(pnl),
        session=session,
        news_condition=news_condition,
        volatility="normal",
    )


class LiveOptimizationTests(unittest.TestCase):
    """Validates live-trade storage, analytics, and adaptive suggestions."""

    def test_trade_database_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            database = LiveTradeDatabase(Path(tmp) / "live_trades.jsonl")
            trade = _trade(7, "XAUUSD", "sweep", "50", "1", "london")

            database.record_trade(trade)
            restored = database.load_trades()

            self.assertEqual(len(restored), 1)
            self.assertEqual(restored[0].symbol, "XAUUSD")
            self.assertEqual(restored[0].strategy_type, "sweep")
            self.assertEqual(restored[0].r_result, Decimal("1"))

    def test_optimizer_calculates_live_metrics_and_suggestions(self) -> None:
        optimizer = LivePerformanceOptimizer(
            config=LiveOptimizationConfig(min_trades_for_analysis=2),
        )
        trades = [
            _trade(7, "XAUUSD", "sweep", "100", "2", "london"),
            _trade(8, "XAUUSD", "sweep", "-50", "-1", "london"),
            _trade(13, "NAS100", "breakout", "-50", "-1", "new_york", news_condition="post_news"),
            _trade(14, "NAS100", "breakout", "-25", "-0.5", "new_york"),
        ]

        report = optimizer.analyze(
            trades=trades,
            base_score_threshold=7,
            base_risk_pct=Decimal("0.005"),
            allowed_setups=("sweep", "breakout"),
        )

        self.assertEqual(report.setup_metrics["sweep"].win_rate, Decimal("0.5"))
        self.assertEqual(report.session_metrics["new_york"].win_rate, Decimal("0"))
        self.assertEqual(report.symbol_metrics["NAS100"].profit_factor, Decimal("0"))
        self.assertEqual(report.average_r, Decimal("-0.125"))
        self.assertIn("disable bad session: new_york", report.improvement_suggestions)
        self.assertIn("disable weak setup: breakout", report.improvement_suggestions)
        self.assertIn("increase score threshold", report.improvement_suggestions)
        self.assertIn("session:new_york", report.worst_conditions)
        self.assertIn("setup:sweep", report.best_conditions)

    def test_optimizer_adaptive_rules_raise_threshold_and_reduce_risk(self) -> None:
        optimizer = LivePerformanceOptimizer(
            config=LiveOptimizationConfig(min_trades_for_analysis=2),
        )
        trades = [
            _trade(7, "XAUUSD", "sweep", "-50", "-1", "london"),
            _trade(8, "XAUUSD", "sweep", "-25", "-0.5", "london"),
            _trade(13, "NAS100", "breakout", "-50", "-1", "new_york"),
            _trade(14, "NAS100", "breakout", "-25", "-0.5", "new_york"),
        ]

        report = optimizer.analyze(
            trades=trades,
            base_score_threshold=7,
            base_risk_pct=Decimal("0.005"),
            allowed_setups=("sweep", "breakout"),
        )

        self.assertEqual(report.adaptive_rules.score_threshold, 8)
        self.assertEqual(report.adaptive_rules.risk_pct, Decimal("0.00375"))
        self.assertEqual(report.adaptive_rules.allowed_setups, ("breakout", "sweep"))
        self.assertEqual(report.adaptive_rules.disabled_sessions, ("london", "new_york"))
        self.assertIn("raised threshold and reduced risk", " ".join(report.adaptive_rules.reasons))

    def test_apply_adaptive_rules_updates_setup_scorer(self) -> None:
        optimizer = LivePerformanceOptimizer(
            config=LiveOptimizationConfig(min_trades_for_analysis=2),
        )
        scorer = SetupScorer(minimum_score=7)
        report = optimizer.analyze(
            trades=[
                _trade(7, "XAUUSD", "sweep", "-50", "-1", "london"),
                _trade(8, "XAUUSD", "sweep", "-25", "-0.5", "london"),
            ],
            base_score_threshold=7,
            base_risk_pct=Decimal("0.005"),
            allowed_setups=("sweep",),
        )

        rules = optimizer.apply_adaptive_rules(setup_scorer=scorer, report=report)

        self.assertEqual(rules.score_threshold, 8)
        self.assertEqual(scorer.minimum_score, 8)


if __name__ == "__main__":
    unittest.main()
