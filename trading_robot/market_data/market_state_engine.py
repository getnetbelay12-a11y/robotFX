"""Multi-timeframe market state engine.

The engine analyzes H1 regime, M15 structure, M5 entry readiness, and ATR-based
volatility using only normalized `MarketSnapshot` candles. It does not depend on
MT5 or any broker SDK, so the same implementation can run live or in backtests.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from trading_robot.config.settings import MarketStateConfig
from trading_robot.types.enums import (
    EntryReadiness,
    MarketStateDecision,
    Regime,
    StructureState,
    Timeframe,
    VolatilityState,
)
from trading_robot.types.models import Bar, MarketSnapshot, MarketState


@dataclass(frozen=True)
class _CacheKey:
    """Cache key based on symbol and latest candle timestamps."""

    symbol: str
    h1_timestamp: object | None
    m15_timestamp: object | None
    m5_timestamp: object | None


class MarketStateEngine:
    """Calculates market permissions from H1, M15, and M5 data."""

    def __init__(self, config: MarketStateConfig | None = None) -> None:
        self._config = config or MarketStateConfig()
        self._cache: dict[_CacheKey, MarketState] = {}

    def get_market_state(self, market: MarketSnapshot) -> MarketState:
        """Return structured market state, using candle-timestamp caching."""

        cache_key = self._cache_key(market)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        regime = self.detect_trend(market)
        structure = self.detect_structure(market)
        entry_ready = self.detect_entry_condition(market)
        volatility = self.detect_volatility(market)
        trade_allowed, reasons = self._trade_decision(
            symbol=market.symbol,
            regime=regime,
            structure=structure,
            entry_ready=entry_ready,
            volatility=volatility,
        )

        state = MarketState(
            symbol=market.symbol,
            regime=regime,
            structure=structure,
            volatility=volatility,
            entry_ready=entry_ready,
            trade_allowed=trade_allowed,
            reasons=tuple(reasons),
            metadata={"cache_key": repr(cache_key)},
        )
        self._cache = {cache_key: state}
        return state

    def detect_trend(self, market: MarketSnapshot) -> Regime:
        """DetectTrend using H1 EMA 50/200 alignment and flatness checks."""

        bars = self._bars(market, Timeframe.H1)
        slow_period = self._config.ema_slow_period
        if len(bars) < slow_period:
            return Regime.SIDEWAYS

        closes = [bar.close for bar in bars]
        ema_fast = self._ema(closes, self._config.ema_fast_period)
        ema_slow = self._ema(closes, slow_period)
        if ema_fast is None or ema_slow is None or ema_slow == 0:
            return Regime.SIDEWAYS

        distance_ratio = abs(ema_fast - ema_slow) / abs(ema_slow)
        fast_slope = self._ema_slope(closes, self._config.ema_fast_period, self._config.ema_slope_lookback)
        slow_slope = self._ema_slope(closes, slow_period, self._config.ema_slope_lookback)
        flat_threshold = self._config.ema_flat_slope_threshold_pct

        if distance_ratio <= self._config.ema_close_threshold_pct:
            return Regime.SIDEWAYS
        if abs(fast_slope) <= flat_threshold and abs(slow_slope) <= flat_threshold:
            return Regime.SIDEWAYS
        if ema_fast > ema_slow:
            return Regime.BULLISH
        if ema_fast < ema_slow:
            return Regime.BEARISH
        return Regime.SIDEWAYS

    def detect_structure(self, market: MarketSnapshot) -> StructureState:
        """DetectStructure from M15 higher-high/higher-low sequences."""

        bars = self._bars(market, Timeframe.M15)
        lookback = self._config.structure_lookback
        if len(bars) < lookback:
            return StructureState.RANGE

        recent = bars[-lookback:]
        tolerance = self._structure_tolerance(market.symbol, market)
        higher_highs = all(
            recent[index].high >= recent[index - 1].high - tolerance
            for index in range(1, len(recent))
        )
        higher_lows = all(
            recent[index].low >= recent[index - 1].low - tolerance
            for index in range(1, len(recent))
        )
        lower_highs = all(
            recent[index].high <= recent[index - 1].high + tolerance
            for index in range(1, len(recent))
        )
        lower_lows = all(
            recent[index].low <= recent[index - 1].low + tolerance
            for index in range(1, len(recent))
        )
        net_up = recent[-1].high > recent[0].high and recent[-1].low > recent[0].low
        net_down = recent[-1].high < recent[0].high and recent[-1].low < recent[0].low

        if net_up and higher_highs and higher_lows:
            return StructureState.TRENDING_UP
        if net_down and lower_highs and lower_lows:
            return StructureState.TRENDING_DOWN
        return StructureState.RANGE

    def detect_entry_condition(self, market: MarketSnapshot) -> EntryReadiness:
        """DetectEntryCondition from M5 candle expansion and body momentum."""

        bars = self._bars(market, Timeframe.M5)
        lookback = self._config.entry_average_lookback
        if len(bars) < lookback + 1:
            return EntryReadiness.NOT_READY

        current = bars[-1]
        recent = bars[-lookback - 1 : -1]
        current_range = self._range(current)
        if current_range <= 0:
            return EntryReadiness.NOT_READY

        average_range = sum((self._range(bar) for bar in recent), Decimal("0")) / Decimal(len(recent))
        if average_range <= 0:
            return EntryReadiness.NOT_READY

        body = abs(current.close - current.open)
        body_to_range = body / current_range
        range_multiple = current_range / average_range
        min_range, min_body = self._entry_thresholds(market.symbol)

        if body_to_range <= self._config.doji_body_to_range:
            return EntryReadiness.NOT_READY
        if range_multiple >= min_range and body_to_range >= min_body:
            return EntryReadiness.READY
        return EntryReadiness.NOT_READY

    def detect_volatility(self, market: MarketSnapshot) -> VolatilityState:
        """DetectVolatility by comparing current ATR to historical ATR average."""

        bars = self._bars(market, Timeframe.M5)
        atr_period = self._config.atr_period
        average_lookback = self._config.atr_average_lookback
        required = atr_period + average_lookback + 1
        if len(bars) < required:
            return VolatilityState.NORMAL

        atr_series = self._atr_series(bars, atr_period)
        if len(atr_series) < average_lookback + 1:
            return VolatilityState.NORMAL

        current_atr = atr_series[-1]
        historical = atr_series[-average_lookback - 1 : -1]
        average_atr = sum(historical, Decimal("0")) / Decimal(len(historical))
        if average_atr <= 0:
            return VolatilityState.NORMAL

        ratio = current_atr / average_atr
        if ratio <= self._config.volatility_low_ratio:
            return VolatilityState.LOW
        if ratio >= self._config.volatility_high_ratio:
            return VolatilityState.HIGH
        return VolatilityState.NORMAL

    def _trade_decision(
        self,
        symbol: str,
        regime: Regime,
        structure: StructureState,
        entry_ready: EntryReadiness,
        volatility: VolatilityState,
    ) -> tuple[MarketStateDecision, list[str]]:
        """Apply final market permission rules and symbol-specific behavior."""

        reasons: list[str] = []
        if regime == Regime.SIDEWAYS:
            reasons.append("H1 regime is sideways")
        if structure == StructureState.RANGE:
            reasons.append("M15 structure is range")
        if volatility == VolatilityState.LOW:
            reasons.append("M5 volatility is low")
        if entry_ready != EntryReadiness.READY:
            reasons.append("M5 entry readiness is not ready")

        aligned = self._structure_confirms_regime(symbol=symbol, regime=regime, structure=structure)
        if not aligned:
            reasons.append("M15 structure does not confirm H1 regime")

        allowed = (
            regime in {Regime.BULLISH, Regime.BEARISH}
            and volatility != VolatilityState.LOW
            and entry_ready == EntryReadiness.READY
            and aligned
        )
        return (MarketStateDecision.TRADE_ALLOWED if allowed else MarketStateDecision.NO_TRADE, reasons)

    def _structure_confirms_regime(self, symbol: str, regime: Regime, structure: StructureState) -> bool:
        """Apply generic, Gold, and index alignment rules."""

        if regime == Regime.BULLISH:
            if structure == StructureState.TRENDING_UP:
                return True
            return self._is_gold(symbol) and structure == StructureState.RANGE
        if regime == Regime.BEARISH:
            if structure == StructureState.TRENDING_DOWN:
                return True
            return self._is_gold(symbol) and structure == StructureState.RANGE
        return False

    def _bars(self, market: MarketSnapshot, timeframe: Timeframe) -> list[Bar]:
        """Return bars for a timeframe while tolerating string-keyed snapshots."""

        return market.bars_by_timeframe.get(timeframe) or market.bars_by_timeframe.get(Timeframe(timeframe)) or []

    def _cache_key(self, market: MarketSnapshot) -> _CacheKey:
        """Build a cache key from latest candle timestamps."""

        return _CacheKey(
            symbol=market.symbol,
            h1_timestamp=self._last_timestamp(market, Timeframe.H1),
            m15_timestamp=self._last_timestamp(market, Timeframe.M15),
            m5_timestamp=self._last_timestamp(market, Timeframe.M5),
        )

    def _last_timestamp(self, market: MarketSnapshot, timeframe: Timeframe) -> object | None:
        """Return latest timestamp for a timeframe."""

        bars = self._bars(market, timeframe)
        return bars[-1].timestamp if bars else None

    def _ema(self, values: list[Decimal], period: int) -> Decimal | None:
        """Calculate EMA for Decimal close prices."""

        if period <= 0 or len(values) < period:
            return None
        multiplier = Decimal("2") / Decimal(period + 1)
        ema = sum(values[:period], Decimal("0")) / Decimal(period)
        for value in values[period:]:
            ema = (value - ema) * multiplier + ema
        return ema

    def _ema_slope(self, values: list[Decimal], period: int, lookback: int) -> Decimal:
        """Return normalized EMA slope over the configured lookback."""

        if lookback <= 0 or len(values) < period + lookback:
            return Decimal("0")
        current = self._ema(values, period)
        previous = self._ema(values[:-lookback], period)
        if current is None or previous is None or previous == 0:
            return Decimal("0")
        return (current - previous) / abs(previous)

    def _atr_series(self, bars: list[Bar], period: int) -> list[Decimal]:
        """Calculate simple ATR series for the provided bars."""

        true_ranges: list[Decimal] = []
        for index in range(1, len(bars)):
            current = bars[index]
            previous_close = bars[index - 1].close
            true_ranges.append(
                max(
                    current.high - current.low,
                    abs(current.high - previous_close),
                    abs(current.low - previous_close),
                )
            )
        if len(true_ranges) < period:
            return []
        return [
            sum(true_ranges[index - period : index], Decimal("0")) / Decimal(period)
            for index in range(period, len(true_ranges) + 1)
        ]

    def _range(self, bar: Bar) -> Decimal:
        """Return non-negative candle range."""

        return max(bar.high - bar.low, Decimal("0"))

    def _structure_tolerance(self, symbol: str, market: MarketSnapshot) -> Decimal:
        """Return symbol-specific structure tolerance in price units."""

        points = self._config.gold_structure_tolerance_points if self._is_gold(symbol) else self._config.structure_tolerance_points
        tick_size = market.symbol_spec.tick_size if market.symbol_spec is not None else Decimal("0.01")
        return points * tick_size

    def _entry_thresholds(self, symbol: str) -> tuple[Decimal, Decimal]:
        """Return stricter thresholds for index symbols."""

        if self._is_index(symbol):
            return self._config.index_entry_min_range_vs_average, self._config.index_entry_min_body_to_range
        return self._config.entry_min_range_vs_average, self._config.entry_min_body_to_range

    def _is_gold(self, symbol: str) -> bool:
        """Classify common Gold symbols."""

        normalized = symbol.upper()
        return any(token in normalized for token in self._config.gold_symbols)

    def _is_index(self, symbol: str) -> bool:
        """Classify common index CFD/futures symbols."""

        normalized = symbol.upper()
        return any(token in normalized for token in self._config.index_symbols)

    def DetectTrend(self, market: MarketSnapshot) -> Regime:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_trend(market)

    def DetectStructure(self, market: MarketSnapshot) -> StructureState:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_structure(market)

    def DetectEntryCondition(self, market: MarketSnapshot) -> EntryReadiness:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_entry_condition(market)

    def DetectVolatility(self, market: MarketSnapshot) -> VolatilityState:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_volatility(market)

    def GetMarketState(self, market: MarketSnapshot) -> MarketState:
        """Compatibility method using the requested PascalCase name."""

        return self.get_market_state(market)
