"""Backtest result analysis and trade logging utilities."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from trading_robot.backtesting.engine import BacktestResult
from trading_robot.backtesting.optimizer import OptimizationResult
from trading_robot.backtesting.stats import TradeRecord


class BacktestReporter:
    """Generates reports, CSV logs, and visual-output data series."""

    def summarize(self, results: dict[str, BacktestResult]) -> dict[str, Any]:
        """Return performance, filter, and visual-output series."""

        return {
            symbol: result.stats.as_report()
            for symbol, result in results.items()
        }

    def summarize_optimization(self, result: OptimizationResult) -> dict[str, Any]:
        """Return best parameter set, stable ranges, and worst-case drawdown."""

        return {
            "best_parameter_set": result.best_parameters,
            "stable_parameter_ranges": result.stable_parameter_ranges,
            "worst_case_drawdown": result.worst_case_drawdown,
            "training": self.summarize(result.training),
            "validation": self.summarize(result.validation),
        }

    def write_trade_log(self, records: list[TradeRecord], path: str | Path) -> None:
        """Save each trade to CSV."""

        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=[
                    "timestamp",
                    "symbol",
                    "strategy_type",
                    "entry",
                    "exit",
                    "stop_loss",
                    "take_profit",
                    "r_result",
                    "pnl",
                    "session",
                    "news_condition",
                    "volatility",
                ],
            )
            writer.writeheader()
            for record in records:
                writer.writerow(
                    {
                        "timestamp": record.timestamp.isoformat(),
                        "symbol": record.symbol,
                        "strategy_type": record.strategy_type,
                        "entry": record.entry,
                        "exit": record.exit,
                        "stop_loss": record.stop_loss,
                        "take_profit": record.take_profit,
                        "r_result": record.r_result,
                        "pnl": record.pnl,
                        "session": record.session,
                        "news_condition": record.news_condition,
                        "volatility": record.volatility,
                    }
                )

