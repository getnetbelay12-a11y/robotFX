"""Translate research findings into robot-tuning recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from trading_robot.research.pattern_learning import PatternResearchReport


@dataclass(frozen=True)
class ResearchRecommendations:
    """Actionable strategy and filter recommendations from historical research."""

    preferred_sessions: tuple[str, ...]
    avoided_sessions: tuple[str, ...]
    preferred_patterns: tuple[str, ...]
    score_threshold_bias: str
    notes: tuple[str, ...]


class ResearchRecommendationEngine:
    """Converts pattern evidence into conservative tuning guidance."""

    def recommend(self, report: PatternResearchReport) -> ResearchRecommendations:
        preferred_sessions = tuple(
            name for name, metric in report.session_metrics.items() if metric.trades >= 50 and metric.expectancy > Decimal("0")
        )
        avoided_sessions = tuple(
            name for name, metric in report.session_metrics.items() if metric.trades >= 50 and metric.expectancy <= Decimal("0")
        )
        preferred_patterns = tuple(
            name for name, metric in report.pattern_metrics.items() if metric.trades >= 5 and metric.expectancy > Decimal("0")
        )
        preferred_candlesticks = tuple(
            name for name, metric in report.candlestick_metrics.items() if metric.trades >= 20 and metric.expectancy > Decimal("0")
        )

        positive_sessions = sum(1 for metric in report.session_metrics.values() if metric.expectancy > Decimal("0"))
        negative_sessions = sum(1 for metric in report.session_metrics.values() if metric.expectancy <= Decimal("0"))
        if negative_sessions > positive_sessions:
            score_threshold_bias = "raise"
        elif positive_sessions > negative_sessions and (preferred_patterns or preferred_candlesticks):
            score_threshold_bias = "normal"
        else:
            score_threshold_bias = "conservative"

        notes = list(report.suggestions)
        if avoided_sessions:
            notes.append("apply stricter filters outside preferred sessions")
        if not preferred_patterns:
            notes.append("do not expand strategy set until pattern edge improves")
        if preferred_candlesticks:
            notes.append("candlestick filters can be added selectively")

        return ResearchRecommendations(
            preferred_sessions=preferred_sessions,
            avoided_sessions=avoided_sessions,
            preferred_patterns=preferred_patterns + preferred_candlesticks,
            score_threshold_bias=score_threshold_bias,
            notes=tuple(notes),
        )
