"""Tests for Phase 5 setup scoring and trade selection."""

from decimal import Decimal
import unittest

from trading_robot.research import ResearchTuningEngine
from trading_robot.scoring import SetupCandidate, SetupScorer, TradeSelectionEngine
from trading_robot.types import (
    EntryReadiness,
    MarketSnapshot,
    MarketState,
    MarketStateDecision,
    NewsLockState,
    Regime,
    SessionQuality,
    StructureState,
    SymbolSpec,
    TradePermission,
    VolatilityState,
)


def _permission(session_quality: SessionQuality = SessionQuality.HIGH, news_state: NewsLockState = NewsLockState.CLEAR) -> TradePermission:
    return TradePermission(
        session_valid=True,
        news_blocked=False,
        cooldown_active=False,
        prop_safe=True,
        can_trade=True,
        session_quality=session_quality,
        news_state=news_state,
        active_session="new_york",
    )


def _market(symbol: str, spread_points: int = 1) -> MarketSnapshot:
    return MarketSnapshot(
        symbol=symbol,
        bars_by_timeframe={},
        bid=Decimal("100"),
        ask=Decimal("100") + (Decimal(spread_points) * Decimal("0.01")),
        symbol_spec=SymbolSpec(
            symbol=symbol,
            tick_size=Decimal("0.01"),
            metadata={"max_spread_points": 2},
        ),
    )


def _state(symbol: str, structure: StructureState = StructureState.TRENDING_UP, volatility: VolatilityState = VolatilityState.NORMAL) -> MarketState:
    return MarketState(
        symbol=symbol,
        regime=Regime.BULLISH,
        structure=structure,
        volatility=volatility,
        entry_ready=EntryReadiness.READY,
        trade_allowed=MarketStateDecision.TRADE_ALLOWED,
        metadata={"cache_key": symbol},
    )


class SetupScoringTests(unittest.TestCase):
    """Validates 0-10 setup scoring and multi-market selection."""

    def test_score_setup_accepts_high_quality_setup(self) -> None:
        score = SetupScorer().score_setup(
            symbol="EURUSD",
            market=_market("EURUSD"),
            market_state=_state("EURUSD"),
            trade_permission=_permission(),
        )

        self.assertEqual(score.score, 10)
        self.assertTrue(score.valid)
        self.assertEqual(score.as_output()["valid"], True)
        self.assertEqual(score.breakdown["trend_alignment"], 2)
        self.assertEqual(score.breakdown["session_quality"], 2)

    def test_score_setup_penalizes_spread_news_weak_candle_and_chop(self) -> None:
        state = MarketState(
            symbol="EURUSD",
            regime=Regime.BULLISH,
            structure=StructureState.RANGE,
            volatility=VolatilityState.NORMAL,
            entry_ready=EntryReadiness.NOT_READY,
            trade_allowed=MarketStateDecision.NO_TRADE,
            reasons=("M15 structure is range",),
            metadata={"cache_key": "weak"},
        )

        score = SetupScorer().score_setup(
            symbol="EURUSD",
            market=_market("EURUSD", spread_points=5),
            market_state=state,
            trade_permission=_permission(news_state=NewsLockState.POST_NEWS),
        )

        self.assertFalse(score.valid)
        self.assertLess(score.score, 7)
        self.assertEqual(score.breakdown["penalties"], -4)

    def test_symbol_specific_weighting(self) -> None:
        gold_score = SetupScorer().score_setup(
            symbol="XAUUSD",
            market=_market("XAUUSD"),
            market_state=_state("XAUUSD", structure=StructureState.RANGE, volatility=VolatilityState.HIGH),
            trade_permission=_permission(),
        )
        nq_score = SetupScorer().score_setup(
            symbol="NQ",
            market=_market("NQ"),
            market_state=_state("NQ", volatility=VolatilityState.NORMAL),
            trade_permission=_permission(),
        )
        btc_score = SetupScorer().score_setup(
            symbol="BTCUSD",
            market=_market("BTCUSD"),
            market_state=_state("BTCUSD", volatility=VolatilityState.HIGH),
            trade_permission=_permission(),
        )

        self.assertIn("Gold volatility emphasis", gold_score.reasons)
        self.assertIn("index trend/breakout emphasis", nq_score.reasons)
        self.assertIn("crypto momentum/volatility emphasis", btc_score.reasons)

    def test_trade_selection_sorts_and_selects_top_valid_setups(self) -> None:
        scorer = SetupScorer()
        selector = TradeSelectionEngine(scorer=scorer, max_selected_trades=2)
        candidates = (
            SetupCandidate("EURUSD", _market("EURUSD"), _state("EURUSD"), _permission()),
            SetupCandidate("GBPUSD", _market("GBPUSD", spread_points=5), _state("GBPUSD"), _permission()),
            SetupCandidate("NQ", _market("NQ"), _state("NQ"), _permission()),
        )

        selected = selector.select_best(candidates)

        self.assertEqual(len(selected), 2)
        self.assertEqual(selected[0].priority_rank, 1)
        self.assertGreaterEqual(selected[0].score, selected[1].score)
        self.assertTrue(all(score.valid for score in selected))

    def test_research_tuning_penalizes_avoided_session_and_raises_threshold(self) -> None:
        tuning = ResearchTuningEngine.from_payload(
            {
                "symbols": {
                    "EURUSD": {
                        "avoided_sessions": ["new_york"],
                        "preferred_patterns": ["sweep_reversal"],
                        "score_threshold_bias": "raise",
                    }
                }
            }
        )
        score = SetupScorer(minimum_score=10, tuning_engine=tuning).score_setup(
            symbol="EURUSD",
            market=_market("EURUSD"),
            market_state=_state("EURUSD"),
            trade_permission=_permission(),
        )

        self.assertEqual(score.breakdown["research_penalties"], -1)
        self.assertFalse(score.valid)
        self.assertIn("penalty: weak research session (new_york)", score.reasons)


if __name__ == "__main__":
    unittest.main()
