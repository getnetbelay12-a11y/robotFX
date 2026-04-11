"""Tests for dynamic risk adaptation."""

from datetime import datetime
from decimal import Decimal
import unittest

from trading_robot.config import RiskConfig
from trading_robot.risk import RiskAdaptationEngine, RiskManager
from trading_robot.state import RobotState
from trading_robot.types import (
    AccountSnapshot,
    ConfidenceLevel,
    EntryReadiness,
    MarketSnapshot,
    MarketState,
    MarketStateDecision,
    OrderSide,
    Regime,
    RiskAdaptationDecision,
    SessionQuality,
    SignalDecision,
    StrategyType,
    StructureState,
    SymbolSpec,
    TradePermission,
    TradeSignal,
    VolatilityState,
)


class RiskAdaptationEngineTests(unittest.TestCase):
    """Validates AI-style risk adaptation without external ML dependencies."""

    def setUp(self) -> None:
        self.account = AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000"))
        self.market_state = MarketState(
            symbol="XAUUSD",
            regime=Regime.BULLISH,
            structure=StructureState.TRENDING_UP,
            volatility=VolatilityState.NORMAL,
            entry_ready=EntryReadiness.READY,
            trade_allowed=MarketStateDecision.TRADE_ALLOWED,
        )
        self.permission = TradePermission(
            session_valid=True,
            news_blocked=False,
            cooldown_active=False,
            prop_safe=True,
            can_trade=True,
            session_quality=SessionQuality.HIGH,
        )

    def test_default_risk_is_used_when_state_is_healthy(self) -> None:
        decision = RiskAdaptationEngine().adjust_risk(
            state=RobotState(),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
            strategy_type=StrategyType.LIQUIDITY_SWEEP_REVERSAL,
        )

        self.assertTrue(decision.trading_allowed)
        self.assertEqual(decision.adjusted_risk, Decimal("0.005"))
        self.assertEqual(decision.reason, "default risk")
        self.assertEqual(decision.confidence_level, ConfidenceLevel.HIGH)

    def test_two_losses_reduce_risk_and_three_losses_stop_trading(self) -> None:
        engine = RiskAdaptationEngine()

        reduced = engine.adjust_risk(
            state=RobotState(loss_streak=2),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
        )
        stopped = engine.adjust_risk(
            state=RobotState(loss_streak=3),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
        )

        self.assertTrue(reduced.trading_allowed)
        self.assertEqual(reduced.adjusted_risk, Decimal("0.0025"))
        self.assertIn("reduced after 2 losses", reduced.reason)
        self.assertFalse(stopped.trading_allowed)
        self.assertEqual(stopped.adjusted_risk, Decimal("0"))
        self.assertEqual(stopped.reason, "loss streak stop threshold reached")

    def test_two_wins_increase_risk_to_configured_cap(self) -> None:
        decision = RiskAdaptationEngine().adjust_risk(
            state=RobotState(win_streak=2),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
        )

        self.assertTrue(decision.trading_allowed)
        self.assertEqual(decision.adjusted_risk, Decimal("0.0075"))
        self.assertIn("increased after 2 wins", decision.reason)

    def test_high_volatility_reduces_risk(self) -> None:
        high_volatility = MarketState(
            symbol="XAUUSD",
            regime=Regime.BULLISH,
            structure=StructureState.TRENDING_UP,
            volatility=VolatilityState.HIGH,
            entry_ready=EntryReadiness.READY,
            trade_allowed=MarketStateDecision.TRADE_ALLOWED,
        )

        decision = RiskAdaptationEngine().adjust_risk(
            state=RobotState(),
            account=self.account,
            market_state=high_volatility,
            trade_permission=self.permission,
        )

        self.assertTrue(decision.trading_allowed)
        self.assertEqual(decision.adjusted_risk, Decimal("0.0025"))
        self.assertIn("reduced for high volatility", decision.reason)

    def test_drawdown_and_daily_target_stop_trading(self) -> None:
        engine = RiskAdaptationEngine()

        drawdown_stop = engine.adjust_risk(
            state=RobotState(daily_pnl=Decimal("-600")),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
        )
        target_stop = engine.adjust_risk(
            state=RobotState(daily_pnl=Decimal("200")),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
        )

        self.assertFalse(drawdown_stop.trading_allowed)
        self.assertEqual(drawdown_stop.reason, "drawdown stop threshold reached")
        self.assertEqual(drawdown_stop.metadata["drawdown_pct"], Decimal("0.06"))
        self.assertFalse(target_stop.trading_allowed)
        self.assertEqual(target_stop.reason, "daily target hit")

    def test_underperforming_session_and_strategy_reduce_risk(self) -> None:
        engine = RiskAdaptationEngine()
        for _ in range(3):
            engine.record_session_result("high", Decimal("-1"))
            engine.record_strategy_result(StrategyType.BREAKOUT_RETEST, Decimal("-1"))

        decision = engine.adjust_risk(
            state=RobotState(),
            account=self.account,
            market_state=self.market_state,
            trade_permission=self.permission,
            strategy_type=StrategyType.BREAKOUT_RETEST,
        )

        self.assertTrue(decision.trading_allowed)
        self.assertEqual(decision.adjusted_risk, Decimal("0.0025"))
        self.assertIn("underperforming session high", decision.reason)
        self.assertIn("underperforming strategy breakout_retest", decision.reason)


class RiskManagerAdaptationIntegrationTests(unittest.TestCase):
    """Ensures RiskManager consumes adaptation decisions from trade metadata."""

    def setUp(self) -> None:
        self.account = AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000"))
        self.market = MarketSnapshot(
            symbol="TEST",
            bars_by_timeframe={},
            bid=Decimal("99.99"),
            ask=Decimal("100.00"),
            symbol_spec=SymbolSpec(
                symbol="TEST",
                tick_size=Decimal("0.01"),
                tick_value=Decimal("1"),
                min_volume=Decimal("0.01"),
                volume_step=Decimal("0.01"),
            ),
        )

    def test_adapted_risk_caps_position_size(self) -> None:
        manager = RiskManager(RiskConfig(max_risk_per_trade_pct=Decimal("0.01")))
        signal = TradeSignal(
            symbol="TEST",
            decision=SignalDecision.LONG,
            side=OrderSide.BUY,
            entry_price=Decimal("100"),
            stop_loss=Decimal("99"),
            metadata={
                "risk_adaptation": RiskAdaptationDecision(
                    adjusted_risk=Decimal("0.0025"),
                    trading_allowed=True,
                    reason="reduced after 2 losses",
                    confidence_level=ConfidenceLevel.MEDIUM,
                )
            },
        )

        decision = manager.calculate_risk(
            signal=signal,
            market=self.market,
            account=self.account,
            state=RobotState(),
            timestamp=datetime(2026, 4, 10),
        )

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.risk_amount, Decimal("25.0000"))
        self.assertEqual(decision.volume, Decimal("0.25"))

    def test_adaptation_stop_blocks_trade(self) -> None:
        manager = RiskManager(RiskConfig(max_risk_per_trade_pct=Decimal("0.01")))
        signal = TradeSignal(
            symbol="TEST",
            decision=SignalDecision.LONG,
            side=OrderSide.BUY,
            entry_price=Decimal("100"),
            stop_loss=Decimal("99"),
            metadata={
                "risk_adaptation": RiskAdaptationDecision(
                    adjusted_risk=Decimal("0"),
                    trading_allowed=False,
                    reason="loss streak stop threshold reached",
                    confidence_level=ConfidenceLevel.LOW,
                )
            },
        )

        decision = manager.calculate_risk(
            signal=signal,
            market=self.market,
            account=self.account,
            state=RobotState(),
            timestamp=datetime(2026, 4, 10),
        )

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "risk adaptation blocked trading: loss streak stop threshold reached")


if __name__ == "__main__":
    unittest.main()
