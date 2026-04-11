"""Live performance optimization system.

This module stores real trades, computes lightweight performance analytics, and
generates adaptive suggestions for score threshold, risk, and allowed setups.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Iterable

from trading_robot.backtesting.stats import TradeRecord
from trading_robot.config.settings import LiveOptimizationConfig
from trading_robot.journal.logger import TradingLogger
from trading_robot.scoring.setup_scorer import SetupScorer


@dataclass(frozen=True)
class ConditionPerformance:
    """Aggregated performance metrics for one setup, session, or symbol."""

    name: str
    trades: int
    wins: int
    losses: int
    win_rate: Decimal
    profit_factor: Decimal
    average_r: Decimal
    net_pnl: Decimal


@dataclass(frozen=True)
class AdaptiveRules:
    """Recommended live settings from recent real-trading performance."""

    score_threshold: int
    risk_pct: Decimal
    allowed_setups: tuple[str, ...]
    disabled_sessions: tuple[str, ...]
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class LivePerformanceReport:
    """Final report for operators or automated control layers."""

    best_conditions: tuple[str, ...]
    worst_conditions: tuple[str, ...]
    improvement_suggestions: tuple[str, ...]
    adaptive_rules: AdaptiveRules
    setup_metrics: dict[str, ConditionPerformance]
    session_metrics: dict[str, ConditionPerformance]
    symbol_metrics: dict[str, ConditionPerformance]
    average_r: Decimal


@dataclass
class _MetricAccumulator:
    trades: int = 0
    wins: int = 0
    losses: int = 0
    gross_profit: Decimal = Decimal("0")
    gross_loss: Decimal = Decimal("0")
    total_r: Decimal = Decimal("0")
    net_pnl: Decimal = Decimal("0")

    def record(self, record: TradeRecord) -> None:
        self.trades += 1
        self.total_r += record.r_result
        self.net_pnl += record.pnl
        if record.pnl > 0:
            self.wins += 1
            self.gross_profit += record.pnl
        elif record.pnl < 0:
            self.losses += 1
            self.gross_loss += record.pnl

    def as_condition_performance(self, name: str) -> ConditionPerformance:
        if self.trades == 0:
            win_rate = Decimal("0")
            average_r = Decimal("0")
        else:
            win_rate = Decimal(self.wins) / Decimal(self.trades)
            average_r = self.total_r / Decimal(self.trades)

        if self.gross_loss == 0:
            profit_factor = Decimal("0") if self.gross_profit == 0 else Decimal("999")
        else:
            profit_factor = self.gross_profit / abs(self.gross_loss)

        return ConditionPerformance(
            name=name,
            trades=self.trades,
            wins=self.wins,
            losses=self.losses,
            win_rate=win_rate,
            profit_factor=profit_factor,
            average_r=average_r,
            net_pnl=self.net_pnl,
        )


class LiveTradeDatabase:
    """Append-only JSONL storage for closed live or demo trades."""

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)

    def record_trade(self, trade: TradeRecord) -> None:
        """Persist one closed trade."""

        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(self._serialize(trade), sort_keys=True) + "\n")

    def load_trades(self) -> list[TradeRecord]:
        """Load all recorded trades in insertion order."""

        if not self._path.exists():
            return []
        trades: list[TradeRecord] = []
        with self._path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                trades.append(self._deserialize(json.loads(line)))
        return trades

    def _serialize(self, trade: TradeRecord) -> dict[str, str]:
        return {
            "timestamp": trade.timestamp.isoformat(),
            "symbol": trade.symbol,
            "strategy_type": trade.strategy_type,
            "entry": str(trade.entry),
            "exit": str(trade.exit),
            "stop_loss": str(trade.stop_loss),
            "take_profit": str(trade.take_profit),
            "r_result": str(trade.r_result),
            "pnl": str(trade.pnl),
            "session": trade.session,
            "news_condition": trade.news_condition,
            "volatility": trade.volatility,
        }

    def _deserialize(self, payload: dict[str, str]) -> TradeRecord:
        return TradeRecord(
            timestamp=datetime.fromisoformat(payload["timestamp"]),
            symbol=payload["symbol"],
            strategy_type=payload["strategy_type"],
            entry=Decimal(payload["entry"]),
            exit=Decimal(payload["exit"]),
            stop_loss=Decimal(payload["stop_loss"]),
            take_profit=Decimal(payload["take_profit"]),
            r_result=Decimal(payload["r_result"]),
            pnl=Decimal(payload["pnl"]),
            session=payload.get("session", "unknown"),
            news_condition=payload.get("news_condition", "clear"),
            volatility=payload.get("volatility", "unknown"),
        )


class LivePerformanceOptimizer:
    """Analyzes real trades and recommends lightweight adaptive changes."""

    def __init__(
        self,
        config: LiveOptimizationConfig | None = None,
        logger: TradingLogger | None = None,
        database: LiveTradeDatabase | None = None,
    ) -> None:
        self._config = config or LiveOptimizationConfig()
        self._logger = logger or TradingLogger()
        self._database = database or LiveTradeDatabase(self._config.database_path)

    def record_trade(self, trade: TradeRecord) -> None:
        """Store a closed trade for future live analysis."""

        self._database.record_trade(trade)
        self._logger.info(
            "live trade recorded",
            symbol=trade.symbol,
            strategy_type=trade.strategy_type,
            session=trade.session,
            r_result=trade.r_result,
            pnl=trade.pnl,
        )

    def analyze(
        self,
        trades: Iterable[TradeRecord] | None = None,
        base_score_threshold: int = 7,
        base_risk_pct: Decimal = Decimal("0.005"),
        allowed_setups: tuple[str, ...] | None = None,
    ) -> LivePerformanceReport:
        """Build a live performance report and adaptive rule recommendations."""

        records = list(trades if trades is not None else self._database.load_trades())
        setup_metrics = self._group_metrics(records, lambda record: record.strategy_type)
        session_metrics = self._group_metrics(records, lambda record: record.session)
        symbol_metrics = self._group_metrics(records, lambda record: record.symbol)
        average_r = self._average_r(records)
        suggestions = self._suggest_improvements(setup_metrics, session_metrics, symbol_metrics, average_r)
        adaptive_rules = self._adaptive_rules(
            setup_metrics=setup_metrics,
            session_metrics=session_metrics,
            average_r=average_r,
            base_score_threshold=base_score_threshold,
            base_risk_pct=base_risk_pct,
            allowed_setups=allowed_setups,
        )
        best_conditions = self._best_conditions(setup_metrics, session_metrics, symbol_metrics)
        worst_conditions = self._worst_conditions(setup_metrics, session_metrics, symbol_metrics)

        report = LivePerformanceReport(
            best_conditions=best_conditions,
            worst_conditions=worst_conditions,
            improvement_suggestions=tuple(suggestions),
            adaptive_rules=adaptive_rules,
            setup_metrics=setup_metrics,
            session_metrics=session_metrics,
            symbol_metrics=symbol_metrics,
            average_r=average_r,
        )
        self._logger.info(
            "live optimization analysis complete",
            trades=len(records),
            best_conditions=report.best_conditions,
            worst_conditions=report.worst_conditions,
            suggestions=report.improvement_suggestions,
            adaptive_rules=report.adaptive_rules,
        )
        return report

    def optimize(
        self,
        base_score_threshold: int = 7,
        base_risk_pct: Decimal = Decimal("0.005"),
        allowed_setups: tuple[str, ...] | None = None,
    ) -> LivePerformanceReport:
        """Convenience wrapper over stored live trades."""

        return self.analyze(
            trades=self._database.load_trades(),
            base_score_threshold=base_score_threshold,
            base_risk_pct=base_risk_pct,
            allowed_setups=allowed_setups,
        )

    def apply_adaptive_rules(
        self,
        setup_scorer: SetupScorer | None = None,
        report: LivePerformanceReport | None = None,
    ) -> AdaptiveRules:
        """Apply adaptive score-threshold changes to the scorer and return rules."""

        current_report = report or self.optimize()
        if setup_scorer is not None:
            setup_scorer.update_minimum_score(current_report.adaptive_rules.score_threshold)
        self._logger.info(
            "live adaptive rules applied",
            score_threshold=current_report.adaptive_rules.score_threshold,
            risk_pct=current_report.adaptive_rules.risk_pct,
            allowed_setups=current_report.adaptive_rules.allowed_setups,
            disabled_sessions=current_report.adaptive_rules.disabled_sessions,
        )
        return current_report.adaptive_rules

    def _group_metrics(
        self,
        trades: list[TradeRecord],
        key_fn,
    ) -> dict[str, ConditionPerformance]:
        buckets: dict[str, _MetricAccumulator] = {}
        for trade in trades:
            key = str(key_fn(trade) or "unknown")
            buckets.setdefault(key, _MetricAccumulator()).record(trade)
        return {key: bucket.as_condition_performance(key) for key, bucket in buckets.items()}

    def _average_r(self, trades: list[TradeRecord]) -> Decimal:
        if not trades:
            return Decimal("0")
        return sum((trade.r_result for trade in trades), Decimal("0")) / Decimal(len(trades))

    def _suggest_improvements(
        self,
        setup_metrics: dict[str, ConditionPerformance],
        session_metrics: dict[str, ConditionPerformance],
        symbol_metrics: dict[str, ConditionPerformance],
        average_r: Decimal,
    ) -> list[str]:
        suggestions: list[str] = []

        for session, metrics in session_metrics.items():
            if self._is_weak(metrics):
                suggestions.append(f"disable bad session: {session}")

        for setup, metrics in setup_metrics.items():
            if self._is_weak(metrics):
                suggestions.append(f"disable weak setup: {setup}")

        if average_r <= self._config.weak_average_r_threshold:
            suggestions.append("increase score threshold")

        weak_symbols = [symbol for symbol, metrics in symbol_metrics.items() if self._is_weak(metrics)]
        if weak_symbols:
            suggestions.append(f"review weak symbols: {', '.join(sorted(weak_symbols))}")

        if not suggestions:
            suggestions.append("conditions stable; keep current filters")
        return suggestions

    def _adaptive_rules(
        self,
        setup_metrics: dict[str, ConditionPerformance],
        session_metrics: dict[str, ConditionPerformance],
        average_r: Decimal,
        base_score_threshold: int,
        base_risk_pct: Decimal,
        allowed_setups: tuple[str, ...] | None,
    ) -> AdaptiveRules:
        score_threshold = base_score_threshold
        risk_pct = base_risk_pct
        reasons: list[str] = []

        weak_sessions = tuple(
            session
            for session, metrics in sorted(session_metrics.items())
            if self._is_weak(metrics)
        )
        weak_setups = {
            setup
            for setup, metrics in setup_metrics.items()
            if self._is_weak(metrics)
        }

        if average_r <= self._config.weak_average_r_threshold:
            score_threshold = min(
                self._config.max_score_threshold,
                base_score_threshold + self._config.threshold_increase_step,
            )
            risk_pct = base_risk_pct * self._config.risk_reduction_factor
            reasons.append("raised threshold and reduced risk for weak average R")

        base_allowed = set(allowed_setups or tuple(sorted(setup_metrics.keys())))
        final_allowed = tuple(sorted(setup for setup in base_allowed if setup not in weak_setups))
        if weak_setups:
            reasons.append("disabled weak setups from live rotation")
        if weak_sessions:
            reasons.append("disabled underperforming sessions")
        if not final_allowed:
            final_allowed = tuple(sorted(base_allowed))

        return AdaptiveRules(
            score_threshold=max(self._config.min_score_threshold, min(self._config.max_score_threshold, score_threshold)),
            risk_pct=max(Decimal("0"), risk_pct),
            allowed_setups=final_allowed,
            disabled_sessions=weak_sessions,
            reasons=tuple(reasons),
        )

    def _best_conditions(
        self,
        setup_metrics: dict[str, ConditionPerformance],
        session_metrics: dict[str, ConditionPerformance],
        symbol_metrics: dict[str, ConditionPerformance],
    ) -> tuple[str, ...]:
        ranked = self._rank_conditions(setup_metrics, session_metrics, symbol_metrics, reverse=True)
        return tuple(item[0] for item in ranked[:3])

    def _worst_conditions(
        self,
        setup_metrics: dict[str, ConditionPerformance],
        session_metrics: dict[str, ConditionPerformance],
        symbol_metrics: dict[str, ConditionPerformance],
    ) -> tuple[str, ...]:
        ranked = self._rank_conditions(setup_metrics, session_metrics, symbol_metrics, reverse=False)
        return tuple(item[0] for item in ranked[:3])

    def _rank_conditions(
        self,
        setup_metrics: dict[str, ConditionPerformance],
        session_metrics: dict[str, ConditionPerformance],
        symbol_metrics: dict[str, ConditionPerformance],
        reverse: bool,
    ) -> list[tuple[str, tuple[Decimal, Decimal]]]:
        ranked: list[tuple[str, tuple[Decimal, Decimal]]] = []
        for prefix, metrics_by_key in (
            ("setup", setup_metrics),
            ("session", session_metrics),
            ("symbol", symbol_metrics),
        ):
            for key, metrics in metrics_by_key.items():
                ranked.append((f"{prefix}:{key}", (metrics.average_r, metrics.net_pnl)))
        return sorted(ranked, key=lambda item: item[1], reverse=reverse)

    def _is_weak(self, metrics: ConditionPerformance) -> bool:
        return bool(
            metrics.trades >= self._config.min_trades_for_analysis
            and (
                metrics.win_rate < self._config.weak_win_rate_threshold
                or metrics.profit_factor < self._config.weak_profit_factor_threshold
                or metrics.average_r <= self._config.weak_average_r_threshold
            )
        )

    def RecordTrade(self, trade: TradeRecord) -> None:
        """Compatibility method using the requested PascalCase name."""

        self.record_trade(trade)

    def Analyze(
        self,
        trades: Iterable[TradeRecord] | None = None,
        base_score_threshold: int = 7,
        base_risk_pct: Decimal = Decimal("0.005"),
        allowed_setups: tuple[str, ...] | None = None,
    ) -> LivePerformanceReport:
        """Compatibility method using the requested PascalCase name."""

        return self.analyze(
            trades=trades,
            base_score_threshold=base_score_threshold,
            base_risk_pct=base_risk_pct,
            allowed_setups=allowed_setups,
        )

    def ApplyAdaptiveRules(
        self,
        setup_scorer: SetupScorer | None = None,
        report: LivePerformanceReport | None = None,
    ) -> AdaptiveRules:
        """Compatibility method using the requested PascalCase name."""

        return self.apply_adaptive_rules(setup_scorer=setup_scorer, report=report)
