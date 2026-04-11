"""Backtesting exports with lazy loading to avoid package import cycles."""

from __future__ import annotations

from importlib import import_module

__all__ = [
    "BacktestEngine",
    "BacktestParameters",
    "BacktestReporter",
    "BacktestResult",
    "BacktestStats",
    "OptimizationEngine",
    "OptimizationResult",
    "StrategyReplayBacktestEngine",
    "StrategyReplayResult",
    "TradeRecord",
    "aggregate_bars",
]


def __getattr__(name: str):
    if name in {"BacktestEngine", "BacktestParameters", "BacktestResult"}:
        module = import_module("trading_robot.backtesting.engine")
        return getattr(module, name)
    if name in {"OptimizationEngine", "OptimizationResult"}:
        module = import_module("trading_robot.backtesting.optimizer")
        return getattr(module, name)
    if name in {"StrategyReplayBacktestEngine", "StrategyReplayResult", "aggregate_bars"}:
        module = import_module("trading_robot.backtesting.replay_engine")
        return getattr(module, name)
    if name == "BacktestReporter":
        module = import_module("trading_robot.backtesting.reporting")
        return getattr(module, name)
    if name in {"BacktestStats", "TradeRecord"}:
        module = import_module("trading_robot.backtesting.stats")
        return getattr(module, name)
    raise AttributeError(name)
