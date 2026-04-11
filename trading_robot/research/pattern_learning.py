"""Pattern research over minute-bar history.

The goal is not to "find a magic pattern." It is to produce stable evidence
about when the market tends to trend, revert, expand, or chop so the robot can
be filtered and tuned with discipline.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from trading_robot.research.data_pipeline import MinuteBarRecord


@dataclass(frozen=True)
class PatternMetric:
    """One aggregated pattern metric."""

    name: str
    trades: int
    win_rate: Decimal
    average_r: Decimal
    expectancy: Decimal


@dataclass(frozen=True)
class PatternResearchReport:
    """Evidence extracted from five years of minute bars."""

    symbol: str
    total_bars: int
    session_metrics: dict[str, PatternMetric]
    hour_metrics: dict[str, PatternMetric]
    pattern_metrics: dict[str, PatternMetric]
    candlestick_metrics: dict[str, PatternMetric]
    best_conditions: tuple[str, ...]
    worst_conditions: tuple[str, ...]
    suggestions: tuple[str, ...]


class PatternLearningEngine:
    """Computes lightweight but actionable market-structure evidence."""

    def analyze(self, symbol: str, bars: list[MinuteBarRecord]) -> PatternResearchReport:
        session_buckets: dict[str, list[Decimal]] = {}
        hour_buckets: dict[str, list[Decimal]] = {}
        pattern_buckets: dict[str, list[Decimal]] = {
            "expansion_continuation": [],
            "expansion_reversal": [],
            "sweep_reversal": [],
        }
        candlestick_buckets: dict[str, list[Decimal]] = {
            "bullish_engulfing": [],
            "bearish_engulfing": [],
            "bullish_pin_bar": [],
            "bearish_pin_bar": [],
            "doji": [],
            "inside_bar_breakout": [],
            "outside_bar_reversal": [],
        }

        ranges: list[Decimal] = []
        for index in range(1, len(bars) - 3):
            bar = bars[index]
            previous_bar = bars[index - 1]
            next_bar = bars[index + 1]
            session = self._session_name(bar.timestamp)
            hour = f"{bar.timestamp.hour:02d}:00"
            move = next_bar.close - bar.close
            direction = Decimal("1") if bar.close >= bar.open else Decimal("-1")
            signed_follow_through = move * direction
            session_buckets.setdefault(session, []).append(signed_follow_through)
            hour_buckets.setdefault(hour, []).append(signed_follow_through)

            candle_range = bar.high - bar.low
            ranges.append(candle_range)
            recent_avg_range = self._average(ranges[-20:]) if ranges else Decimal("0")
            if recent_avg_range > 0 and candle_range >= recent_avg_range * Decimal("1.5"):
                future_close = bars[index + 3].close
                continuation_r = ((future_close - bar.close) * direction) / recent_avg_range
                reversal_r = ((bar.close - future_close) * direction) / recent_avg_range
                pattern_buckets["expansion_continuation"].append(continuation_r)
                pattern_buckets["expansion_reversal"].append(reversal_r)

            if index >= 20:
                lookback = bars[index - 20 : index]
                prior_high = max(item.high for item in lookback)
                prior_low = min(item.low for item in lookback)
                future_close = bars[index + 3].close
                if bar.low < prior_low and bar.close > bar.open:
                    pattern_buckets["sweep_reversal"].append((future_close - bar.close) / max(recent_avg_range, Decimal("0.0001")))
                elif bar.high > prior_high and bar.close < bar.open:
                    pattern_buckets["sweep_reversal"].append((bar.close - future_close) / max(recent_avg_range, Decimal("0.0001")))

            future_close = bars[index + 3].close
            normalization = max(recent_avg_range, Decimal("0.0001"))
            if self._is_bullish_engulfing(previous_bar, bar):
                candlestick_buckets["bullish_engulfing"].append((future_close - bar.close) / normalization)
            if self._is_bearish_engulfing(previous_bar, bar):
                candlestick_buckets["bearish_engulfing"].append((bar.close - future_close) / normalization)
            if self._is_bullish_pin_bar(bar):
                candlestick_buckets["bullish_pin_bar"].append((future_close - bar.close) / normalization)
            if self._is_bearish_pin_bar(bar):
                candlestick_buckets["bearish_pin_bar"].append((bar.close - future_close) / normalization)
            if self._is_doji(bar):
                candlestick_buckets["doji"].append(abs(future_close - bar.close) / normalization)
            if self._is_inside_bar(previous_bar, bar):
                breakout_direction = Decimal("1") if bars[index + 1].close >= bar.high else Decimal("-1") if bars[index + 1].close <= bar.low else Decimal("0")
                if breakout_direction != 0:
                    candlestick_buckets["inside_bar_breakout"].append(((future_close - bars[index + 1].close) * breakout_direction) / normalization)
            if self._is_outside_bar(previous_bar, bar):
                reversal_direction = Decimal("-1") if bar.close > bar.open else Decimal("1")
                candlestick_buckets["outside_bar_reversal"].append(((future_close - bar.close) * reversal_direction) / normalization)

        session_metrics = {name: self._metric(name, values) for name, values in session_buckets.items()}
        hour_metrics = {name: self._metric(name, values) for name, values in hour_buckets.items()}
        pattern_metrics = {name: self._metric(name, values) for name, values in pattern_buckets.items()}
        candlestick_metrics = {name: self._metric(name, values) for name, values in candlestick_buckets.items()}

        ranked = self._rank_metrics(session_metrics, hour_metrics, pattern_metrics, candlestick_metrics)
        best_conditions = tuple(name for name, _ in ranked[:5])
        worst_conditions = tuple(name for name, _ in ranked[-5:])
        suggestions = self._suggest(
            session_metrics=session_metrics,
            pattern_metrics=pattern_metrics,
            candlestick_metrics=candlestick_metrics,
        )
        return PatternResearchReport(
            symbol=symbol.upper(),
            total_bars=len(bars),
            session_metrics=session_metrics,
            hour_metrics=hour_metrics,
            pattern_metrics=pattern_metrics,
            candlestick_metrics=candlestick_metrics,
            best_conditions=best_conditions,
            worst_conditions=worst_conditions,
            suggestions=suggestions,
        )

    def _metric(self, name: str, values: list[Decimal]) -> PatternMetric:
        if not values:
            return PatternMetric(name, 0, Decimal("0"), Decimal("0"), Decimal("0"))
        wins = sum(1 for value in values if value > 0)
        average_r = self._average(values)
        return PatternMetric(
            name=name,
            trades=len(values),
            win_rate=Decimal(wins) / Decimal(len(values)),
            average_r=average_r,
            expectancy=average_r,
        )

    def _rank_metrics(self, *metric_maps: dict[str, PatternMetric]) -> list[tuple[str, Decimal]]:
        ranked: list[tuple[str, Decimal]] = []
        for metric_map in metric_maps:
            for name, metric in metric_map.items():
                if metric.trades > 0:
                    ranked.append((name, metric.expectancy))
        return sorted(ranked, key=lambda item: item[1], reverse=True)

    def _suggest(
        self,
        session_metrics: dict[str, PatternMetric],
        pattern_metrics: dict[str, PatternMetric],
        candlestick_metrics: dict[str, PatternMetric],
    ) -> tuple[str, ...]:
        suggestions: list[str] = []
        for session, metric in session_metrics.items():
            if metric.trades >= 50 and metric.expectancy <= Decimal("0"):
                suggestions.append(f"disable or downweight session: {session}")
        if pattern_metrics.get("expansion_continuation", PatternMetric("", 0, Decimal("0"), Decimal("0"), Decimal("0"))).expectancy > Decimal("0"):
            suggestions.append("favor breakout continuation after expansion candles")
        if pattern_metrics.get("sweep_reversal", PatternMetric("", 0, Decimal("0"), Decimal("0"), Decimal("0"))).expectancy > Decimal("0"):
            suggestions.append("favor liquidity-sweep reversals after failed range breaks")
        for name, metric in candlestick_metrics.items():
            if metric.trades >= 20 and metric.expectancy > Decimal("0"):
                suggestions.append(f"candlestick edge detected: {name}")
        if not suggestions:
            suggestions.append("insufficient edge evidence; keep thresholds conservative")
        return tuple(suggestions)

    def _is_bullish_engulfing(self, previous_bar: MinuteBarRecord, current_bar: MinuteBarRecord) -> bool:
        return (
            previous_bar.close < previous_bar.open
            and current_bar.close > current_bar.open
            and current_bar.open <= previous_bar.close
            and current_bar.close >= previous_bar.open
        )

    def _is_bearish_engulfing(self, previous_bar: MinuteBarRecord, current_bar: MinuteBarRecord) -> bool:
        return (
            previous_bar.close > previous_bar.open
            and current_bar.close < current_bar.open
            and current_bar.open >= previous_bar.close
            and current_bar.close <= previous_bar.open
        )

    def _is_bullish_pin_bar(self, bar: MinuteBarRecord) -> bool:
        candle_range = bar.high - bar.low
        body = abs(bar.close - bar.open)
        lower_wick = min(bar.open, bar.close) - bar.low
        upper_wick = bar.high - max(bar.open, bar.close)
        return candle_range > 0 and lower_wick >= body * Decimal("2") and lower_wick > upper_wick * Decimal("1.5")

    def _is_bearish_pin_bar(self, bar: MinuteBarRecord) -> bool:
        candle_range = bar.high - bar.low
        body = abs(bar.close - bar.open)
        lower_wick = min(bar.open, bar.close) - bar.low
        upper_wick = bar.high - max(bar.open, bar.close)
        return candle_range > 0 and upper_wick >= body * Decimal("2") and upper_wick > lower_wick * Decimal("1.5")

    def _is_doji(self, bar: MinuteBarRecord) -> bool:
        candle_range = bar.high - bar.low
        if candle_range <= 0:
            return False
        body = abs(bar.close - bar.open)
        return body / candle_range <= Decimal("0.15")

    def _is_inside_bar(self, previous_bar: MinuteBarRecord, current_bar: MinuteBarRecord) -> bool:
        return current_bar.high <= previous_bar.high and current_bar.low >= previous_bar.low

    def _is_outside_bar(self, previous_bar: MinuteBarRecord, current_bar: MinuteBarRecord) -> bool:
        return current_bar.high >= previous_bar.high and current_bar.low <= previous_bar.low

    def _session_name(self, timestamp: datetime) -> str:
        hour = timestamp.hour
        if 7 <= hour < 13:
            return "london_open"
        if 13 <= hour < 16:
            return "new_york_open"
        if 16 <= hour < 22:
            return "new_york"
        return "off_session"

    def _average(self, values: list[Decimal]) -> Decimal:
        if not values:
            return Decimal("0")
        return sum(values, Decimal("0")) / Decimal(len(values))
