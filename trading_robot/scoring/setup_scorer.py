"""Setup scoring engine.

The scorer converts Phase 3 market-state output and Phase 4 permission output
into a lightweight 0-10 setup quality score. It does not create an entry
strategy; it only decides whether a candidate setup is worth considering.
"""

from __future__ import annotations

from decimal import Decimal

from trading_robot.research.tuning_engine import ResearchTuningEngine
from trading_robot.types.enums import (
    EntryReadiness,
    MarketStateDecision,
    NewsLockState,
    Regime,
    SessionQuality,
    StructureState,
    VolatilityState,
)
from trading_robot.types.models import MarketSnapshot, MarketState, SetupScore, TradePermission


class SetupScorer:
    """Scores whether a detected setup is good enough to trade."""

    def __init__(self, minimum_score: int = 7, tuning_engine: ResearchTuningEngine | None = None) -> None:
        self._minimum_score = minimum_score
        self._tuning_engine = tuning_engine
        self._cache: dict[tuple[object, ...], SetupScore] = {}

    @property
    def minimum_score(self) -> int:
        """Return the current minimum score threshold."""

        return self._minimum_score

    def update_minimum_score(self, minimum_score: int) -> None:
        """Update the threshold for adaptive live optimization."""

        self._minimum_score = minimum_score
        self._cache.clear()

    def score_setup(
        self,
        symbol: str,
        market: MarketSnapshot,
        market_state: MarketState | None = None,
        trade_permission: TradePermission | None = None,
    ) -> SetupScore:
        """ScoreSetup returns a 0-10 score with a transparent breakdown."""

        if market_state is None:
            return SetupScore(symbol=symbol, score=0, valid=False, reason="market state unavailable")

        cache_key = self._cache_key(symbol=symbol, market=market, market_state=market_state, trade_permission=trade_permission)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        score = 0
        reasons: list[str] = []
        breakdown: dict[str, int] = {}

        trend_points = 2 if market_state.regime in {Regime.BULLISH, Regime.BEARISH} else 0
        score += trend_points
        breakdown["trend_alignment"] = trend_points
        if trend_points:
            reasons.append("H1 trend aligned")

        structure_points = self._structure_alignment_points(symbol=symbol, market_state=market_state)
        score += structure_points
        breakdown["structure_alignment"] = structure_points
        if structure_points:
            reasons.append("M15 structure aligned")

        entry_points = 2 if market_state.entry_ready == EntryReadiness.READY else 0
        score += entry_points
        breakdown["strong_entry_candle"] = entry_points
        if entry_points:
            reasons.append("M5 entry candle strong")

        session_points = 2 if trade_permission is not None and trade_permission.session_quality == SessionQuality.HIGH else 0
        score += session_points
        breakdown["session_quality"] = session_points
        if session_points:
            reasons.append("high-quality session")

        volatility_points = 1 if market_state.volatility in {VolatilityState.NORMAL, VolatilityState.HIGH} else 0
        score += volatility_points
        breakdown["volatility_acceptable"] = volatility_points
        if volatility_points:
            reasons.append("volatility acceptable")

        cooldown_points = 1 if trade_permission is not None and trade_permission.can_trade and not trade_permission.cooldown_active else 0
        score += cooldown_points
        breakdown["no_recent_losses_or_cooldown"] = cooldown_points
        if cooldown_points:
            reasons.append("no active cooldown")

        score += self._symbol_specific_adjustment(symbol=symbol, market_state=market_state, breakdown=breakdown, reasons=reasons)
        score -= self._research_penalties(symbol=symbol, trade_permission=trade_permission, breakdown=breakdown, reasons=reasons)
        score -= self._penalties(market=market, market_state=market_state, trade_permission=trade_permission, breakdown=breakdown, reasons=reasons)
        score = max(0, min(10, score))

        if market_state.trade_allowed == MarketStateDecision.NO_TRADE:
            reasons.extend(market_state.reasons)
        if trade_permission is not None and not trade_permission.can_trade:
            reasons.extend(trade_permission.reasons)

        minimum_score = self._minimum_score
        if self._tuning_engine is not None:
            minimum_score = self._tuning_engine.minimum_score(symbol=symbol, base_score=minimum_score)

        valid = score >= minimum_score and market_state.trade_allowed == MarketStateDecision.TRADE_ALLOWED
        if trade_permission is not None:
            valid = valid and trade_permission.can_trade

        result = SetupScore(
            symbol=symbol,
            score=score,
            reasons=tuple(reasons),
            valid=valid,
            reason="setup accepted" if valid else "setup rejected",
            breakdown=breakdown,
        )
        self._cache = {cache_key: result}
        return result

    def _structure_alignment_points(self, symbol: str, market_state: MarketState) -> int:
        """Structure alignment contributes two points with Gold reversal tolerance."""

        if market_state.structure in {StructureState.TRENDING_UP, StructureState.TRENDING_DOWN}:
            return 2
        if self._is_gold(symbol) and market_state.structure == StructureState.RANGE and market_state.volatility == VolatilityState.HIGH:
            return 1
        return 0

    def _symbol_specific_adjustment(
        self,
        symbol: str,
        market_state: MarketState,
        breakdown: dict[str, int],
        reasons: list[str],
    ) -> int:
        """Apply small market-specific preferences while keeping max score at 10."""

        if self._is_gold(symbol) and market_state.volatility == VolatilityState.HIGH:
            breakdown["symbol_specific"] = 1
            reasons.append("Gold volatility emphasis")
            return 1
        if self._is_index(symbol) and market_state.regime in {Regime.BULLISH, Regime.BEARISH} and market_state.entry_ready == EntryReadiness.READY:
            breakdown["symbol_specific"] = 1
            reasons.append("index trend/breakout emphasis")
            return 1
        if self._is_crypto(symbol) and market_state.volatility in {VolatilityState.NORMAL, VolatilityState.HIGH} and market_state.entry_ready == EntryReadiness.READY:
            breakdown["symbol_specific"] = 1
            reasons.append("crypto momentum/volatility emphasis")
            return 1
        if self._is_forex(symbol) and market_state.structure in {StructureState.TRENDING_UP, StructureState.TRENDING_DOWN}:
            breakdown["symbol_specific"] = 1
            reasons.append("forex clean-structure emphasis")
            return 1
        breakdown["symbol_specific"] = 0
        return 0

    def _penalties(
        self,
        market: MarketSnapshot,
        market_state: MarketState,
        trade_permission: TradePermission | None,
        breakdown: dict[str, int],
        reasons: list[str],
    ) -> int:
        """Subtract points for poor trade-selection conditions."""

        penalty = 0
        if trade_permission is not None and trade_permission.news_state == NewsLockState.POST_NEWS:
            penalty += 1
            reasons.append("penalty: near recent news")
        if self._spread_too_high(market):
            penalty += 1
            reasons.append("penalty: spread too high")
        if market_state.entry_ready != EntryReadiness.READY:
            penalty += 1
            reasons.append("penalty: weak M5 candle")
        if market_state.structure == StructureState.RANGE:
            penalty += 1
            reasons.append("penalty: choppy M15 structure")
        breakdown["penalties"] = -penalty
        return penalty

    def _spread_too_high(self, market: MarketSnapshot) -> bool:
        """Use optional SymbolSpec metadata to penalize excessive spread."""

        if market.bid is None or market.ask is None or market.symbol_spec is None:
            return False
        max_spread_points = market.symbol_spec.metadata.get("max_spread_points")
        if max_spread_points is None or market.symbol_spec.tick_size <= 0:
            return False
        spread = market.ask - market.bid
        if spread < 0:
            return False
        spread_points = spread / market.symbol_spec.tick_size
        return spread_points > Decimal(str(max_spread_points))

    def _cache_key(
        self,
        symbol: str,
        market: MarketSnapshot,
        market_state: MarketState,
        trade_permission: TradePermission | None,
    ) -> tuple[object, ...]:
        """Build a small cache key for repeated scoring on the same tick."""

        return (
            symbol,
            market_state.metadata.get("cache_key"),
            market_state.regime,
            market_state.structure,
            market_state.volatility,
            market_state.entry_ready,
            trade_permission.can_trade if trade_permission is not None else None,
            trade_permission.session_quality if trade_permission is not None else None,
            trade_permission.active_session if trade_permission is not None else None,
            trade_permission.news_state if trade_permission is not None else None,
            market.bid,
            market.ask,
        )

    def _research_penalties(
        self,
        symbol: str,
        trade_permission: TradePermission | None,
        breakdown: dict[str, int],
        reasons: list[str],
    ) -> int:
        """Apply small penalties from offline research tuning."""

        penalty = 0
        if self._tuning_engine is None or trade_permission is None:
            breakdown["research_penalties"] = 0
            return penalty

        session_penalty = self._tuning_engine.session_penalty(symbol=symbol, active_session=trade_permission.active_session)
        if session_penalty:
            penalty += session_penalty
            reasons.append(f"penalty: weak research session ({trade_permission.active_session})")
        breakdown["research_penalties"] = -penalty
        return penalty

    def _is_gold(self, symbol: str) -> bool:
        normalized = symbol.upper()
        return "XAU" in normalized or "GOLD" in normalized

    def _is_index(self, symbol: str) -> bool:
        normalized = symbol.upper()
        return any(token in normalized for token in ("NQ", "NAS100", "US100", "US30", "DJ30", "SPX", "US500"))

    def _is_forex(self, symbol: str) -> bool:
        normalized = symbol.upper()
        return len(normalized) == 6 and normalized.isalpha() and not self._is_gold(normalized)

    def _is_crypto(self, symbol: str) -> bool:
        normalized = symbol.upper()
        return any(token in normalized for token in ("BTC", "ETH", "XRP", "SOL"))

    def ScoreSetup(
        self,
        symbol: str,
        market: MarketSnapshot,
        market_state: MarketState | None = None,
        trade_permission: TradePermission | None = None,
    ) -> SetupScore:
        """Compatibility method using the requested PascalCase name."""

        return self.score_setup(
            symbol=symbol,
            market=market,
            market_state=market_state,
            trade_permission=trade_permission,
        )

    def UpdateMinimumScore(self, minimum_score: int) -> None:
        """Compatibility method using the requested PascalCase name."""

        self.update_minimum_score(minimum_score)
