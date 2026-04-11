"""Parameter optimization with out-of-sample validation."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from itertools import product

from trading_robot.backtesting.engine import BacktestEngine, BacktestParameters, BacktestResult
from trading_robot.types.enums import Timeframe
from trading_robot.types.models import Bar


@dataclass(frozen=True)
class OptimizationResult:
    """Optimizer output with training and validation performance."""

    best_parameters: BacktestParameters
    training: dict[str, BacktestResult]
    validation: dict[str, BacktestResult]
    stable_parameter_ranges: dict[str, tuple[object, ...]]
    worst_case_drawdown: Decimal


class OptimizationEngine:
    """Grid-search optimizer with 70/30 out-of-sample split."""

    def __init__(self, backtest_engine: BacktestEngine) -> None:
        self._backtest_engine = backtest_engine

    def optimize(
        self,
        historical_data: dict[str, dict[Timeframe, list[Bar]]],
        parameter_grid: dict[str, tuple[object, ...]] | None = None,
    ) -> OptimizationResult:
        """Run grid optimization and validate the best parameter set out of sample."""

        grid = parameter_grid or self.default_grid()
        training_data, validation_data = self._split_data(historical_data)
        best_parameters = None
        best_training = None
        best_score = Decimal("-999999")
        stable_values: dict[str, set[object]] = {key: set() for key in grid}

        for parameters in self._iter_parameters(grid):
            training = self._backtest_engine.run(training_data, parameters)
            score = self._score_results(training)
            if score > Decimal("0"):
                for key in grid:
                    stable_values[key].add(getattr(parameters, key))
            if score > best_score:
                best_score = score
                best_parameters = parameters
                best_training = training

        if best_parameters is None or best_training is None:
            best_parameters = BacktestParameters()
            best_training = self._backtest_engine.run(training_data, best_parameters)

        validation = self._backtest_engine.run(validation_data, best_parameters)
        worst_case_drawdown = max(
            [result.stats.max_drawdown for result in tuple(best_training.values()) + tuple(validation.values())],
            default=Decimal("0"),
        )
        return OptimizationResult(
            best_parameters=best_parameters,
            training=best_training,
            validation=validation,
            stable_parameter_ranges={key: tuple(sorted(values)) for key, values in stable_values.items()},
            worst_case_drawdown=worst_case_drawdown,
        )

    def default_grid(self) -> dict[str, tuple[object, ...]]:
        """Default optimization ranges from Phase 8 requirements."""

        return {
            "risk_per_trade_pct": (Decimal("0.0025"), Decimal("0.005"), Decimal("0.01")),
            "tp_multiplier": (Decimal("1.5"), Decimal("2"), Decimal("3")),
            "trailing_start_r": (Decimal("1"), Decimal("1.5"), Decimal("2")),
            "ema_fast_period": (50,),
            "ema_slow_period": (200,),
            "atr_period": (14, 21),
            "score_threshold": (6, 7, 8, 9),
        }

    def _iter_parameters(self, grid: dict[str, tuple[object, ...]]):
        keys = tuple(grid.keys())
        for values in product(*(grid[key] for key in keys)):
            yield BacktestParameters(**dict(zip(keys, values)))

    def _split_data(
        self,
        historical_data: dict[str, dict[Timeframe, list[Bar]]],
    ) -> tuple[dict[str, dict[Timeframe, list[Bar]]], dict[str, dict[Timeframe, list[Bar]]]]:
        """Split each timeframe 70% training / 30% validation."""

        training: dict[str, dict[Timeframe, list[Bar]]] = {}
        validation: dict[str, dict[Timeframe, list[Bar]]] = {}
        for symbol, timeframes in historical_data.items():
            training[symbol] = {}
            validation[symbol] = {}
            for timeframe, bars in timeframes.items():
                split_index = max(1, int(len(bars) * 0.7))
                training[symbol][timeframe] = bars[:split_index]
                validation[symbol][timeframe] = bars[split_index:]
        return training, validation

    def _score_results(self, results: dict[str, BacktestResult]) -> Decimal:
        """Score result quality for optimizer ranking."""

        if not results:
            return Decimal("-999999")
        total_pnl = sum((result.stats.net_pnl for result in results.values()), Decimal("0"))
        total_drawdown = sum((result.stats.max_drawdown for result in results.values()), Decimal("0"))
        total_trades = sum(result.stats.trades for result in results.values())
        trade_bonus = Decimal(min(total_trades, 50))
        return total_pnl - total_drawdown + trade_bonus

