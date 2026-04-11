"""Tests for Phase 6 strategy entry logic and execution flow."""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
import unittest

from trading_robot.config import NewsFilterConfig, ProductionConfig, RiskConfig, SessionConfig, StrategyConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.execution.router import ExecutionRouter
from trading_robot.filters.news_filter import NewsFilter
from trading_robot.filters.session_filter import SessionFilter
from trading_robot.research import ResearchTuningEngine
from trading_robot.risk import RiskManager
from trading_robot.scoring import SetupScorer
from trading_robot.state import RobotState
from trading_robot.strategy import StrategyEngine
from trading_robot.types import (
    AccountSnapshot,
    Bar,
    EntryReadiness,
    MarketSnapshot,
    MarketState,
    MarketStateDecision,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderStatus,
    Regime,
    SessionQuality,
    SignalDecision,
    StrategyType,
    StructureState,
    SymbolSpec,
    Timeframe,
    TradePermission,
    VolatilityState,
)


def _bar(index: int, open_price: str, high: str, low: str, close: str) -> Bar:
    return Bar(
        symbol="NQ",
        timeframe=Timeframe.M5,
        timestamp=datetime(2026, 4, 10, 14, 0) + timedelta(minutes=index * 5),
        open=Decimal(open_price),
        high=Decimal(high),
        low=Decimal(low),
        close=Decimal(close),
        volume=Decimal("100"),
    )


def _snapshot(symbol: str, bars: list[Bar]) -> MarketSnapshot:
    return MarketSnapshot(
        symbol=symbol,
        bars_by_timeframe={Timeframe.M5: bars},
        bid=bars[-1].close - Decimal("0.01"),
        ask=bars[-1].close,
        symbol_spec=SymbolSpec(
            symbol=symbol,
            tick_size=Decimal("0.01"),
            tick_value=Decimal("1"),
            min_volume=Decimal("0.01"),
            volume_step=Decimal("0.01"),
            metadata={"max_spread_points": 3},
        ),
    )


def _sweep_bars() -> list[Bar]:
    bars = [_bar(index, "100", "101", "99", "100.5") for index in range(6)]
    bars.append(_bar(6, "100", "101.2", "98", "101"))
    bars.append(_bar(7, "100.5", "102", "100.3", "101.5"))
    return bars


def _breakout_bars() -> list[Bar]:
    bars = [_bar(index, "99", "100", "98.5", "99.5") for index in range(9)]
    bars.append(_bar(9, "99.7", "102", "99.6", "101.5"))
    bars.append(_bar(10, "101.2", "101.4", "99.99", "100.4"))
    bars.append(_bar(11, "100.4", "102.2", "100.2", "102.0"))
    return bars


class RecordingExecutionClient(ExecutionClient):
    """Execution fake that records market orders."""

    def __init__(self) -> None:
        self.requests: list[OrderRequest] = []

    def connect(self) -> None:
        pass

    def disconnect(self) -> None:
        pass

    def open_trade(self, request: OrderRequest) -> OrderResult:
        self.requests.append(request)
        return OrderResult(order_id="order-1", status=OrderStatus.FILLED, filled_volume=request.volume)

    def close_position(self, position):
        return OrderResult(order_id="close", status=OrderStatus.FILLED)

    def partial_close_position(self, position, volume: Decimal) -> OrderResult:
        return OrderResult(order_id="partial", status=OrderStatus.FILLED, filled_volume=volume)

    def modify_position(self, position):
        return OrderResult(order_id="modify", status=OrderStatus.FILLED)


class StaticMarketStateEngine:
    """Market-state stub for strategy orchestration tests."""

    def __init__(self, symbol: str) -> None:
        self.market_state = MarketState(
            symbol=symbol,
            regime=Regime.BULLISH,
            structure=StructureState.TRENDING_UP,
            volatility=VolatilityState.HIGH,
            entry_ready=EntryReadiness.READY,
            trade_allowed=MarketStateDecision.TRADE_ALLOWED,
            metadata={"cache_key": symbol},
        )

    def get_market_state(self, market: MarketSnapshot) -> MarketState:
        return self.market_state

    def detect_trend(self, market: MarketSnapshot):
        return self.market_state.regime

    def detect_structure(self, market: MarketSnapshot):
        return self.market_state.structure

    def detect_entry_condition(self, market: MarketSnapshot):
        return self.market_state.entry_ready

    def detect_volatility(self, market: MarketSnapshot):
        return self.market_state.volatility


class AllowPermissionEngine:
    """Permission stub that always allows trading."""

    def can_trade(self, **kwargs):
        return TradePermission(
            session_valid=True,
            news_blocked=False,
            cooldown_active=False,
            prop_safe=True,
            can_trade=True,
            session_quality=SessionQuality.HIGH,
        )


class StrategyEngineTests(unittest.TestCase):
    """Validates sweep, breakout/retest, routing, execution, and duplicates."""

    def _engine(
        self,
        symbol: str,
        client: RecordingExecutionClient,
        research_tuning_engine: ResearchTuningEngine | None = None,
    ) -> StrategyEngine:
        return StrategyEngine(
            config=StrategyConfig(minimum_setup_score=7),
            session_filter=SessionFilter(SessionConfig()),
            news_filter=NewsFilter(NewsFilterConfig()),
            risk_manager=RiskManager(RiskConfig(max_risk_per_trade_pct=Decimal("0.01"))),
            setup_scorer=SetupScorer(minimum_score=7),
            execution_router=ExecutionRouter(client, production_config=ProductionConfig(live_trading_enabled=True)),
            market_state_engine=StaticMarketStateEngine(symbol),
            permission_engine=AllowPermissionEngine(),
            research_tuning_engine=research_tuning_engine,
        )

    def test_detect_liquidity_sweep_buy_signal(self) -> None:
        client = RecordingExecutionClient()
        engine = self._engine("XAUUSD", client)

        signal = engine.DetectLiquiditySweep("XAUUSD", _snapshot("XAUUSD", _sweep_bars()))

        self.assertEqual(signal.decision, SignalDecision.LONG)
        self.assertEqual(signal.side, OrderSide.BUY)
        self.assertEqual(signal.stop_loss, Decimal("97.99"))
        self.assertEqual(signal.metadata["strategy_type"], StrategyType.LIQUIDITY_SWEEP_REVERSAL)
        self.assertEqual(signal.take_profit, Decimal("105.01"))

    def test_detect_breakout_retest_buy_signal(self) -> None:
        client = RecordingExecutionClient()
        engine = self._engine("NQ", client)

        signal = engine.detect_breakout_retest("NQ", _snapshot("NQ", _breakout_bars()))

        self.assertEqual(signal.decision, SignalDecision.LONG)
        self.assertEqual(signal.side, OrderSide.BUY)
        self.assertEqual(signal.metadata["strategy_type"], StrategyType.BREAKOUT_RETEST)
        self.assertEqual(signal.metadata["tp2"], "runner_trailing")
        self.assertEqual(signal.as_output()["strategyType"], StrategyType.BREAKOUT_RETEST)

    def test_evaluate_routes_nq_to_breakout_and_executes_once(self) -> None:
        client = RecordingExecutionClient()
        engine = self._engine("NQ", client)
        market = _snapshot("NQ", _breakout_bars())
        account = AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000"))
        state = RobotState(trading_day=datetime(2026, 4, 10).date())

        signal = engine.evaluate(
            symbol="NQ",
            market=market,
            account=account,
            state=state,
            timestamp=datetime(2026, 4, 10, 14, 0),
        )
        duplicate = engine.evaluate(
            symbol="NQ",
            market=market,
            account=account,
            state=state,
            timestamp=datetime(2026, 4, 10, 14, 0),
        )

        self.assertEqual(signal.decision, SignalDecision.LONG)
        self.assertEqual(signal.metadata["strategy_type"], StrategyType.BREAKOUT_RETEST)
        self.assertEqual(len(client.requests), 1)
        self.assertEqual(duplicate.decision, SignalDecision.WAIT)
        self.assertTrue(duplicate.metadata["duplicate_signal"])

    def test_evaluate_routes_gold_to_sweep(self) -> None:
        client = RecordingExecutionClient()
        engine = self._engine("XAUUSD", client)

        signal = engine.evaluate(
            symbol="XAUUSD",
            market=_snapshot("XAUUSD", _sweep_bars()),
            account=AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000")),
            state=RobotState(trading_day=datetime(2026, 4, 10).date()),
            timestamp=datetime(2026, 4, 10, 14, 0),
        )

        self.assertEqual(signal.decision, SignalDecision.LONG)
        self.assertEqual(signal.metadata["strategy_type"], StrategyType.LIQUIDITY_SWEEP_REVERSAL)
        self.assertEqual(len(client.requests), 1)

    def test_research_tuning_blocks_breakout_family_for_eurusd(self) -> None:
        client = RecordingExecutionClient()
        tuning = ResearchTuningEngine.from_payload(
            {
                "symbols": {
                    "EURUSD": {
                        "preferred_patterns": ["sweep_reversal", "outside_bar_reversal"],
                        "score_threshold_bias": "raise",
                    }
                }
            }
        )
        engine = self._engine("EURUSD", client, research_tuning_engine=tuning)

        signal = engine.evaluate(
            symbol="EURUSD",
            market=_snapshot("EURUSD", _breakout_bars()),
            account=AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000")),
            state=RobotState(trading_day=datetime(2026, 4, 10).date()),
            timestamp=datetime(2026, 4, 10, 14, 0),
        )

        self.assertEqual(signal.decision, SignalDecision.WAIT)
        self.assertIn("reason", signal.metadata)
        self.assertEqual(len(client.requests), 0)


if __name__ == "__main__":
    unittest.main()
