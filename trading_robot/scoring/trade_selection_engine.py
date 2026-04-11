"""Trade selection engine.

This module scores multiple symbols and selects only the highest-quality one or
two setups. It is lightweight and accepts precomputed market state and permission
objects so it does not recalculate indicators or call external services.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from trading_robot.journal.logger import TradingLogger
from trading_robot.scoring.setup_scorer import SetupScorer
from trading_robot.types.models import MarketSnapshot, MarketState, SetupScore, TradePermission


@dataclass(frozen=True)
class SetupCandidate:
    """One symbol candidate with precomputed Phase 3 and Phase 4 context."""

    symbol: str
    market: MarketSnapshot
    market_state: MarketState
    trade_permission: TradePermission


class TradeSelectionEngine:
    """Scores all candidate symbols and selects only the best valid setups."""

    def __init__(
        self,
        scorer: SetupScorer,
        minimum_score: int = 7,
        max_selected_trades: int = 2,
        logger: TradingLogger | None = None,
    ) -> None:
        self._scorer = scorer
        self._minimum_score = minimum_score
        self._max_selected_trades = max_selected_trades
        self._logger = logger or TradingLogger()

    def score_setups(self, candidates: tuple[SetupCandidate, ...]) -> tuple[SetupScore, ...]:
        """Score all setups and assign priority ranks after sorting."""

        scored = [
            self._scorer.score_setup(
                symbol=candidate.symbol,
                market=candidate.market,
                market_state=candidate.market_state,
                trade_permission=candidate.trade_permission,
            )
            for candidate in candidates
        ]
        ranked = []
        for rank, score in enumerate(sorted(scored, key=lambda item: item.score, reverse=True), start=1):
            valid = score.valid and score.score >= self._minimum_score
            reason = "setup accepted" if valid else "setup rejected"
            ranked_score = replace(score, valid=valid, reason=reason, priority_rank=rank)
            ranked.append(ranked_score)
            if valid:
                self._logger.info("setup scored", symbol=score.symbol, score=score.score, breakdown=score.breakdown)
            else:
                self._logger.warning("setup rejected", symbol=score.symbol, score=score.score, reasons=score.reasons)
        return tuple(ranked)

    def select_best(self, candidates: tuple[SetupCandidate, ...]) -> tuple[SetupScore, ...]:
        """Select the top valid one or two setups after scoring all symbols."""

        ranked = self.score_setups(candidates)
        selected = tuple(score for score in ranked if score.valid)[: self._max_selected_trades]
        for score in selected:
            self._logger.info("setup selected", symbol=score.symbol, score=score.score, priority_rank=score.priority_rank)
        return selected

    def SelectBest(self, candidates: tuple[SetupCandidate, ...]) -> tuple[SetupScore, ...]:
        """Compatibility method using the requested PascalCase name."""

        return self.select_best(candidates)

