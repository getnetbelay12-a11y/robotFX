"""Deterministic backtesting engine.

The engine runs an efficient bar-by-bar loop over normalized historical bars.
It intentionally avoids broker, network, and platform dependencies so research
tests are repeatable and fast.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal

from trading_robot.backtesting.stats import BacktestStats, TradeRecord
from trading_robot.config.settings import BacktestConfig, MarketStateConfig, RiskConfig, StrategyConfig
from trading_robot.types.enums import Timeframe
from trading_robot.types.models import Bar, MarketSnapshot, SymbolSpec


@dataclass(frozen=True)
class BacktestParameters:
    """Adjustable strategy tester and optimizer parameters."""

    risk_per_trade_pct: Decimal = Decimal("0.005")
    tp_multiplier: Decimal = Decimal("2")
    trailing_start_r: Decimal = Decimal("1.5")
    ema_fast_period: int = 50
    ema_slow_period: int = 200
    atr_period: int = 14
    score_threshold: int = 7


@dataclass(frozen=True)
class BacktestResult:
    """Completed backtest output."""

    parameters: BacktestParameters
    stats: BacktestStats
    symbol: str


class BacktestEngine:
    """Runs deterministic historical tests over one or more symbols."""

    def __init__(
        self,
        backtest_config: BacktestConfig | None = None,
        symbol_specs: dict[str, SymbolSpec] | None = None,
    ) -> None:
        self._backtest_config = backtest_config or BacktestConfig()
        self._symbol_specs = symbol_specs or {}

    def run(
        self,
        historical_data: dict[str, dict[Timeframe, list[Bar]]],
        parameters: BacktestParameters,
    ) -> dict[str, BacktestResult]:
        """Run a multi-symbol backtest for XAUUSD, NQ/NAS100, EURUSD, or any supplied symbol."""

        return {
            symbol: self.run_symbol(symbol=symbol, bars_by_timeframe=bars_by_timeframe, parameters=parameters)
            for symbol, bars_by_timeframe in historical_data.items()
        }

    def run_symbol(
        self,
        symbol: str,
        bars_by_timeframe: dict[Timeframe, list[Bar]],
        parameters: BacktestParameters,
    ) -> BacktestResult:
        """Run a simple M5 event loop for one symbol."""

        stats = BacktestStats(starting_equity=self._backtest_config.starting_equity)
        m5_bars = bars_by_timeframe.get(Timeframe.M5, [])
        if len(m5_bars) < 3:
            return BacktestResult(parameters=parameters, stats=stats, symbol=symbol)

        spec = self._symbol_specs.get(symbol, SymbolSpec(symbol=symbol))
        for index in range(2, len(m5_bars) - 1):
            window = {
                timeframe: bars[: min(len(bars), index + 1)]
                for timeframe, bars in bars_by_timeframe.items()
            }
            market = MarketSnapshot(symbol=symbol, bars_by_timeframe=window, symbol_spec=spec)
            signal = self._detect_simple_signal(market)
            if signal is None:
                continue
            record = self._simulate_trade(
                symbol=symbol,
                entry_bar=m5_bars[index],
                future_bars=m5_bars[index + 1 :],
                side=signal,
                parameters=parameters,
            )
            if record is not None:
                stats.record_trade(record.pnl, record)

        return BacktestResult(parameters=parameters, stats=stats, symbol=symbol)

    def _detect_simple_signal(self, market: MarketSnapshot) -> str | None:
        """Lightweight deterministic signal proxy for optimizer sweeps."""

        bars = market.bars_by_timeframe.get(Timeframe.M5, [])
        if len(bars) < 3:
            return None
        previous = bars[-2]
        current = bars[-1]
        current_range = current.high - current.low
        if current_range <= 0:
            return None
        body = abs(current.close - current.open)
        if body / current_range < Decimal("0.6"):
            return None
        if current.close > previous.high:
            return "buy"
        if current.close < previous.low:
            return "sell"
        return None

    def _simulate_trade(
        self,
        symbol: str,
        entry_bar: Bar,
        future_bars: list[Bar],
        side: str,
        parameters: BacktestParameters,
    ) -> TradeRecord | None:
        """Simulate SL/TP resolution using future bars."""

        entry = entry_bar.close
        risk = max(entry_bar.high - entry_bar.low, Decimal("0.0001"))
        if side == "buy":
            stop = entry - risk
            take_profit = entry + risk * parameters.tp_multiplier
        else:
            stop = entry + risk
            take_profit = entry - risk * parameters.tp_multiplier

        exit_price = future_bars[-1].close if future_bars else entry
        r_result = Decimal("0")
        for bar in future_bars:
            if side == "buy":
                if bar.low <= stop:
                    exit_price = stop
                    r_result = Decimal("-1")
                    break
                if bar.high >= take_profit:
                    exit_price = take_profit
                    r_result = parameters.tp_multiplier
                    break
            else:
                if bar.high >= stop:
                    exit_price = stop
                    r_result = Decimal("-1")
                    break
                if bar.low <= take_profit:
                    exit_price = take_profit
                    r_result = parameters.tp_multiplier
                    break
        else:
            r_result = (exit_price - entry) / risk if side == "buy" else (entry - exit_price) / risk

        risk_amount = self._backtest_config.starting_equity * parameters.risk_per_trade_pct
        pnl = risk_amount * r_result
        return TradeRecord(
            timestamp=entry_bar.timestamp,
            symbol=symbol,
            strategy_type="backtest_momentum_proxy",
            entry=entry,
            exit=exit_price,
            stop_loss=stop,
            take_profit=take_profit,
            r_result=r_result,
            pnl=pnl,
            session=self._session_name(entry_bar.timestamp.hour),
            news_condition="clear",
            volatility="normal",
        )

    def _session_name(self, hour: int) -> str:
        """Classify UTC session for filter analysis."""

        if 7 <= hour < 16:
            return "london"
        if 13 <= hour < 22:
            return "new_york"
        return "off_session"

    def market_state_config(self, parameters: BacktestParameters) -> MarketStateConfig:
        """Build a MarketStateConfig from optimizer parameters."""

        return MarketStateConfig(
            ema_fast_period=parameters.ema_fast_period,
            ema_slow_period=parameters.ema_slow_period,
            atr_period=parameters.atr_period,
        )

    def risk_config(self, parameters: BacktestParameters) -> RiskConfig:
        """Build a RiskConfig from optimizer parameters."""

        return RiskConfig(max_risk_per_trade_pct=parameters.risk_per_trade_pct)

    def strategy_config(self, parameters: BacktestParameters) -> StrategyConfig:
        """Build a StrategyConfig from optimizer parameters."""

        return StrategyConfig(minimum_setup_score=parameters.score_threshold)

    def with_parameters(self, parameters: BacktestParameters, **updates) -> BacktestParameters:
        """Return a parameter set with selected fields changed."""

        return replace(parameters, **updates)

