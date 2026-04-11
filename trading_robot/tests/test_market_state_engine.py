"""Tests for multi-timeframe market-state intelligence."""

from datetime import datetime, timedelta
from decimal import Decimal
import unittest

from trading_robot.config import MarketStateConfig, RiskConfig
from trading_robot.market_data import MarketStateEngine
from trading_robot.risk import RiskManager
from trading_robot.scoring import SetupScorer
from trading_robot.state import RobotState
from trading_robot.types import (
    AccountSnapshot,
    Bar,
    EntryReadiness,
    MarketSnapshot,
    MarketStateDecision,
    OrderSide,
    Regime,
    SessionQuality,
    SignalDecision,
    StructureState,
    SymbolSpec,
    Timeframe,
    TradePermission,
    TradeSignal,
    VolatilityState,
)


def _bar(symbol: str, timeframe: Timeframe, index: int, open_price: Decimal, high: Decimal, low: Decimal, close: Decimal) -> Bar:
    """Create a deterministic test candle."""

    return Bar(
        symbol=symbol,
        timeframe=timeframe,
        timestamp=datetime(2026, 4, 10) + timedelta(minutes=index),
        open=open_price,
        high=high,
        low=low,
        close=close,
        volume=Decimal("100"),
    )


def _h1_uptrend(symbol: str) -> list[Bar]:
    return [
        _bar(symbol, Timeframe.H1, index, Decimal(100 + index), Decimal(101 + index), Decimal(99 + index), Decimal(100 + index))
        for index in range(220)
    ]


def _m15_up_structure(symbol: str) -> list[Bar]:
    return [
        _bar(symbol, Timeframe.M15, index, Decimal(100 + index), Decimal(101 + index), Decimal(99 + index), Decimal(100 + index))
        for index in range(10)
    ]


def _m5_ready(symbol: str) -> list[Bar]:
    bars = [
        _bar(symbol, Timeframe.M5, index, Decimal("100"), Decimal("100.5"), Decimal("99.5"), Decimal("100.2"))
        for index in range(70)
    ]
    bars.append(_bar(symbol, Timeframe.M5, 70, Decimal("100"), Decimal("103"), Decimal("99.8"), Decimal("102.8")))
    return bars


class MarketStateEngineTests(unittest.TestCase):
    """Validates Phase 3 market-state rules."""

    def setUp(self) -> None:
        self.engine = MarketStateEngine()
        self.snapshot = MarketSnapshot(
            symbol="EURUSD",
            bars_by_timeframe={
                Timeframe.H1: _h1_uptrend("EURUSD"),
                Timeframe.M15: _m15_up_structure("EURUSD"),
                Timeframe.M5: _m5_ready("EURUSD"),
            },
            bid=Decimal("102.7"),
            ask=Decimal("102.8"),
            symbol_spec=SymbolSpec(symbol="EURUSD", tick_size=Decimal("0.0001")),
        )

    def test_detect_trend_structure_entry_and_volatility(self) -> None:
        self.assertEqual(self.engine.detect_trend(self.snapshot), Regime.BULLISH)
        self.assertEqual(self.engine.detect_structure(self.snapshot), StructureState.TRENDING_UP)
        self.assertEqual(self.engine.detect_entry_condition(self.snapshot), EntryReadiness.READY)
        self.assertIn(self.engine.detect_volatility(self.snapshot), {VolatilityState.NORMAL, VolatilityState.HIGH})

    def test_get_market_state_allows_aligned_trend(self) -> None:
        state = self.engine.get_market_state(self.snapshot)

        self.assertEqual(state.symbol, "EURUSD")
        self.assertEqual(state.regime, Regime.BULLISH)
        self.assertEqual(state.structure, StructureState.TRENDING_UP)
        self.assertEqual(state.entry_ready, EntryReadiness.READY)
        self.assertEqual(state.trade_allowed, MarketStateDecision.TRADE_ALLOWED)

    def test_cache_reuses_market_state_until_latest_candle_changes(self) -> None:
        first = self.engine.get_market_state(self.snapshot)
        second = self.engine.get_market_state(self.snapshot)

        self.assertIs(first, second)

    def test_low_volatility_blocks_trading(self) -> None:
        low_vol_engine = MarketStateEngine(MarketStateConfig(volatility_low_ratio=Decimal("10")))

        state = low_vol_engine.get_market_state(self.snapshot)

        self.assertEqual(state.volatility, VolatilityState.LOW)
        self.assertEqual(state.trade_allowed, MarketStateDecision.NO_TRADE)

    def test_gold_allows_range_structure_when_regime_and_entry_are_valid(self) -> None:
        snapshot = MarketSnapshot(
            symbol="XAUUSD",
            bars_by_timeframe={
                Timeframe.H1: _h1_uptrend("XAUUSD"),
                Timeframe.M15: [
                    _bar("XAUUSD", Timeframe.M15, index, Decimal("2000"), Decimal("2001"), Decimal("1999"), Decimal("2000"))
                    for index in range(10)
                ],
                Timeframe.M5: _m5_ready("XAUUSD"),
            },
            symbol_spec=SymbolSpec(symbol="XAUUSD", tick_size=Decimal("0.01")),
        )

        state = self.engine.get_market_state(snapshot)

        self.assertEqual(state.structure, StructureState.RANGE)
        self.assertEqual(state.trade_allowed, MarketStateDecision.TRADE_ALLOWED)

    def test_index_requires_stronger_m5_entry_candle(self) -> None:
        snapshot = MarketSnapshot(
            symbol="NQ",
            bars_by_timeframe={
                Timeframe.H1: _h1_uptrend("NQ"),
                Timeframe.M15: _m15_up_structure("NQ"),
                Timeframe.M5: _m5_ready("NQ"),
            },
            symbol_spec=SymbolSpec(symbol="NQ", tick_size=Decimal("0.25")),
        )

        state = self.engine.get_market_state(snapshot)

        self.assertEqual(state.trade_allowed, MarketStateDecision.TRADE_ALLOWED)

    def test_setup_scorer_and_risk_manager_consume_market_state(self) -> None:
        market_state = self.engine.get_market_state(self.snapshot)
        permission = TradePermission(
            session_valid=True,
            news_blocked=False,
            cooldown_active=False,
            prop_safe=True,
            can_trade=True,
            session_quality=SessionQuality.HIGH,
        )
        score = SetupScorer().score_setup(
            symbol="EURUSD",
            market=self.snapshot,
            market_state=market_state,
            trade_permission=permission,
        )

        self.assertGreaterEqual(score.score, 7)
        self.assertTrue(score.valid)

        blocked_signal = TradeSignal(
            symbol="EURUSD",
            decision=SignalDecision.LONG,
            side=OrderSide.BUY,
            entry_price=Decimal("100"),
            stop_loss=Decimal("99"),
            metadata={"market_state": market_state},
        )
        blocked_state = market_state.__class__(
            symbol=market_state.symbol,
            regime=market_state.regime,
            structure=market_state.structure,
            volatility=VolatilityState.LOW,
            entry_ready=market_state.entry_ready,
            trade_allowed=MarketStateDecision.NO_TRADE,
        )
        blocked_signal.metadata["market_state"] = blocked_state

        decision = RiskManager(RiskConfig()).calculate_risk(
            signal=blocked_signal,
            market=self.snapshot,
            account=AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000")),
            state=RobotState(),
        )

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "market state is no trade")


if __name__ == "__main__":
    unittest.main()
