"""Strategy engine.

The engine coordinates multi-timeframe analysis, session/news filters, scoring,
risk, and execution. Phase 1 intentionally avoids final entry strategy logic.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from trading_robot.config.settings import PropProtectionConfig, StrategyConfig
from trading_robot.execution.router import ExecutionRouter
from trading_robot.filters.news_filter import NewsFilter
from trading_robot.filters.permission_engine import PermissionEngine
from trading_robot.filters.prop_protection import PropProtection
from trading_robot.filters.session_filter import SessionFilter
from trading_robot.journal.logger import TradingLogger
from trading_robot.market_data.market_state_engine import MarketStateEngine
from trading_robot.operations.alerts import AlertDispatcher
from trading_robot.operations.control import ControlCenter
from trading_robot.research.tuning_engine import ResearchTuningEngine
from trading_robot.risk.adaptation_engine import RiskAdaptationEngine
from trading_robot.risk.risk_manager import RiskManager
from trading_robot.scoring.setup_scorer import SetupScorer
from trading_robot.state.robot_state import RobotState
from trading_robot.types.enums import MarketStateDecision, OrderSide, OrderType, Regime, SignalDecision, StrategyType, Timeframe
from trading_robot.types.models import AccountSnapshot, Bar, MarketSnapshot, MarketState, NewsEvent, OrderRequest, TradeSignal


class StrategyEngine:
    """Coordinates the full decision cycle for one symbol at a time."""

    def __init__(
        self,
        config: StrategyConfig,
        session_filter: SessionFilter,
        news_filter: NewsFilter,
        risk_manager: RiskManager,
        setup_scorer: SetupScorer,
        execution_router: ExecutionRouter,
        market_state_engine: MarketStateEngine | None = None,
        permission_engine: PermissionEngine | None = None,
        risk_adaptation_engine: RiskAdaptationEngine | None = None,
        research_tuning_engine: ResearchTuningEngine | None = None,
        control_center: ControlCenter | None = None,
        alert_dispatcher: AlertDispatcher | None = None,
        logger: TradingLogger | None = None,
    ) -> None:
        self._config = config
        self._session_filter = session_filter
        self._news_filter = news_filter
        self._risk_manager = risk_manager
        self._setup_scorer = setup_scorer
        self._execution_router = execution_router
        self._market_state_engine = market_state_engine or MarketStateEngine()
        self._risk_adaptation_engine = risk_adaptation_engine or RiskAdaptationEngine()
        self._research_tuning_engine = research_tuning_engine
        self._control_center = control_center
        self._alert_dispatcher = alert_dispatcher
        self._last_signal_key: tuple[object, ...] | None = None
        self._logger = logger or TradingLogger()
        self._permission_engine = permission_engine or PermissionEngine(
            session_filter=session_filter,
            news_filter=news_filter,
            prop_protection=PropProtection(PropProtectionConfig()),
        )

    def detect_trend(self, market: MarketSnapshot) -> Regime:
        """DetectTrend using the H1 market-state engine."""

        return self._market_state_engine.detect_trend(market)

    def detect_structure(self, market: MarketSnapshot):
        """DetectStructure using the M15 market-state engine."""

        return self._market_state_engine.detect_structure(market)

    def detect_entry_condition(self, market: MarketSnapshot):
        """DetectEntryCondition using the M5 market-state engine."""

        return self._market_state_engine.detect_entry_condition(market)

    def detect_volatility(self, market: MarketSnapshot):
        """DetectVolatility using ATR analysis."""

        return self._market_state_engine.detect_volatility(market)

    def get_market_state(self, market: MarketSnapshot) -> MarketState:
        """GetMarketState structured multi-timeframe output."""

        return self._market_state_engine.get_market_state(market)

    def evaluate(
        self,
        symbol: str,
        market: MarketSnapshot,
        account: AccountSnapshot,
        state: RobotState,
        timestamp: datetime,
        events: tuple[NewsEvent, ...] = (),
    ) -> TradeSignal:
        """Run the decision pipeline without final entry order logic."""

        state.set_symbol(symbol)
        control_decision = self._control_center.control_decision(symbol) if self._control_center is not None else None
        if control_decision is not None and not control_decision.trading_allowed:
            if self._alert_dispatcher is not None and "paused" in control_decision.reason:
                self._alert_dispatcher.notify_system_stopped(control_decision.reason)
            return TradeSignal(
                symbol=symbol,
                decision=SignalDecision.BLOCKED,
                metadata={"control_decision": control_decision},
            )

        market_state = self.get_market_state(market)
        regime = market_state.regime
        state.update_regime(regime)

        permission = self._permission_engine.can_trade(
            symbol=symbol,
            timestamp=timestamp,
            account=account,
            state=state,
            market_state=market_state,
            events=events,
        )
        state.session_state = self._session_filter.validate_session(symbol=symbol, timestamp=timestamp)
        state.news_lock_state = self._news_filter.validate_news_window(
            symbol=symbol,
            timestamp=timestamp,
            events=events,
            market_state=market_state,
        )
        if not permission.can_trade:
            return TradeSignal(
                symbol=symbol,
                decision=SignalDecision.BLOCKED,
                regime=regime,
                metadata={"market_state": market_state, "trade_permission": permission},
            )

        score = self._setup_scorer.score_setup(
            symbol=symbol,
            market=market,
            market_state=market_state,
            trade_permission=permission,
        )
        if market_state.trade_allowed == MarketStateDecision.NO_TRADE or not score.valid or score.score < self._minimum_score_for_symbol(symbol):
            signal = TradeSignal(
                symbol=symbol,
                decision=SignalDecision.BLOCKED,
                regime=regime,
                score=score,
                metadata={"market_state": market_state, "trade_permission": permission},
            )
            self._risk_manager.calculate_risk(
                signal=signal,
                market=market,
                account=account,
                state=state,
                timestamp=timestamp,
            )
            return signal

        signal = self._detect_trade_setup(symbol=symbol, market=market, market_state=market_state)
        if signal.decision in {SignalDecision.WAIT, SignalDecision.BLOCKED}:
            return TradeSignal(
                symbol=symbol,
                decision=signal.decision,
                regime=regime,
                score=score,
                metadata={
                    **signal.metadata,
                    "market_state": market_state,
                    "trade_permission": permission,
                    "control_decision": control_decision,
                },
            )

        signal = TradeSignal(
            symbol=symbol,
            decision=signal.decision,
            regime=regime,
            score=score,
            side=signal.side,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            metadata={
                **signal.metadata,
                "market_state": market_state,
                "trade_permission": permission,
                "control_decision": control_decision,
            },
        )
        if not self._research_strategy_allowed(symbol=symbol, signal=signal):
            return TradeSignal(
                symbol=symbol,
                decision=SignalDecision.WAIT,
                regime=regime,
                score=score,
                metadata={
                    **signal.metadata,
                    "market_state": market_state,
                    "trade_permission": permission,
                    "control_decision": control_decision,
                    "reason": self._research_tuning_engine.strategy_reason(symbol, signal.metadata.get("strategy_type")),
                },
            )
        if control_decision is not None and control_decision.risk_override_pct is not None:
            signal.metadata["control_risk_pct"] = control_decision.risk_override_pct
        adaptation = self._risk_adaptation_engine.adjust_risk(
            state=state,
            account=account,
            market_state=market_state,
            trade_permission=permission,
            strategy_type=signal.metadata.get("strategy_type"),
        )
        signal.metadata["risk_adaptation"] = adaptation
        self._logger.info(
            "risk adaptation decision",
            symbol=symbol,
            adjusted_risk=adaptation.adjusted_risk,
            trading_allowed=adaptation.trading_allowed,
            reason=adaptation.reason,
            confidence_level=adaptation.confidence_level,
        )

        if self._is_duplicate_signal(signal):
            self._logger.warning(
                "duplicate strategy signal suppressed",
                symbol=symbol,
                strategy_type=signal.metadata.get("strategy_type"),
                entry_price=signal.entry_price,
                stop_loss=signal.stop_loss,
            )
            return TradeSignal(
                symbol=symbol,
                decision=SignalDecision.WAIT,
                regime=regime,
                score=score,
                metadata={**signal.metadata, "duplicate_signal": True},
            )

        risk_decision = self._risk_manager.calculate_risk(
            signal=signal,
            market=market,
            account=account,
            state=state,
            timestamp=timestamp,
        )
        signal.metadata["risk_decision"] = risk_decision
        if risk_decision.allowed:
            self._logger.info(
                "strategy signal approved by risk",
                symbol=symbol,
                strategy_type=signal.metadata.get("strategy_type"),
                pattern=signal.metadata.get("pattern"),
                entry_reason=signal.metadata.get("entry_reason"),
                r_value=signal.metadata.get("r_value"),
                volume=risk_decision.volume,
            )
            request = OrderRequest(
                symbol=symbol,
                side=signal.side,
                order_type=OrderType.MARKET,
                volume=risk_decision.volume,
                stop_loss=signal.stop_loss,
                take_profit=signal.take_profit,
                price=signal.entry_price,
                comment=str(signal.metadata.get("strategy_type", StrategyType.NONE)),
                metadata=signal.metadata,
            )
            signal.metadata["order_result"] = self._execution_router.open_trade(request)
            self._logger.info(
                "trade routed to execution",
                symbol=symbol,
                strategy_type=signal.metadata.get("strategy_type"),
                order_status=signal.metadata["order_result"].status,
            )
            self._last_signal_key = self._signal_key(signal)
        else:
            self._logger.warning(
                "strategy signal rejected by risk",
                symbol=symbol,
                strategy_type=signal.metadata.get("strategy_type"),
                reason=risk_decision.reason,
            )
        return signal

    def _detect_trade_setup(
        self,
        symbol: str,
        market: MarketSnapshot,
        market_state: MarketState,
    ) -> TradeSignal:
        """Route symbol families to the preferred strategy detector."""

        detectors = self._strategy_order(symbol)
        for detector in detectors:
            signal = detector(symbol, market, market_state)
            if signal.decision not in {SignalDecision.WAIT, SignalDecision.BLOCKED}:
                self._logger.info(
                    "strategy pattern detected",
                    symbol=symbol,
                    strategy_type=signal.metadata.get("strategy_type"),
                    pattern=signal.metadata.get("pattern"),
                    entry_reason=signal.metadata.get("entry_reason"),
                    r_value=signal.metadata.get("r_value"),
                )
                return signal
        return TradeSignal(symbol=symbol, decision=SignalDecision.WAIT, metadata={"reason": "no entry pattern detected"})

    def _strategy_order(self, symbol: str):
        """Choose strategy priority by symbol family."""

        if self._research_tuning_engine is not None:
            allowed = self._research_tuning_engine.allowed_strategies(symbol)
            if allowed == (StrategyType.LIQUIDITY_SWEEP_REVERSAL,):
                return (self.detect_liquidity_sweep,)
            if allowed == (StrategyType.BREAKOUT_RETEST,):
                return (self.detect_breakout_retest,)

        if self._is_gold(symbol):
            return (self.detect_liquidity_sweep, self.detect_breakout_retest)
        if self._is_index(symbol):
            return (self.detect_breakout_retest, self.detect_liquidity_sweep)
        return (self.detect_liquidity_sweep, self.detect_breakout_retest)

    def _minimum_score_for_symbol(self, symbol: str) -> int:
        """Require slightly higher scores for non-Gold/non-index symbols."""

        if self._research_tuning_engine is not None:
            return self._research_tuning_engine.minimum_score(symbol=symbol, base_score=self._config.minimum_setup_score)
        if self._is_gold(symbol) or self._is_index(symbol):
            return self._config.minimum_setup_score
        return self._config.minimum_setup_score + 1

    def _research_strategy_allowed(self, symbol: str, signal: TradeSignal) -> bool:
        """Filter strategy families when offline research strongly favors one side."""

        if self._research_tuning_engine is None:
            return True
        return self._research_tuning_engine.strategy_allowed(
            symbol=symbol,
            strategy_type=signal.metadata.get("strategy_type"),
        )

    def detect_liquidity_sweep(
        self,
        symbol: str,
        market: MarketSnapshot,
        market_state: MarketState | None = None,
    ) -> TradeSignal:
        """DetectLiquiditySweep with rejection candle and engulfing confirmation."""

        bars = self._bars(market, Timeframe.M5)
        if len(bars) < 8:
            return TradeSignal(symbol=symbol, decision=SignalDecision.WAIT, metadata={"reason": "not enough M5 bars for sweep"})

        sweep = bars[-2]
        confirmation = bars[-1]
        prior = bars[-8:-2]
        previous_low = min(bar.low for bar in prior)
        previous_high = max(bar.high for bar in prior)

        if sweep.low < previous_low and self.detect_rejection(sweep, OrderSide.BUY) and self.detect_engulfing(sweep, confirmation, OrderSide.BUY):
            entry = confirmation.close
            stop = self._pad_stop(symbol=symbol, market=market, price=sweep.low, side=OrderSide.BUY)
            return self._build_signal(
                symbol=symbol,
                side=OrderSide.BUY,
                entry=entry,
                stop=stop,
                strategy_type=StrategyType.LIQUIDITY_SWEEP_REVERSAL,
                reason="sweep below previous low, bullish rejection, bullish engulfing",
                pattern="bullish_liquidity_sweep",
            )

        if sweep.high > previous_high and self.detect_rejection(sweep, OrderSide.SELL) and self.detect_engulfing(sweep, confirmation, OrderSide.SELL):
            entry = confirmation.close
            stop = self._pad_stop(symbol=symbol, market=market, price=sweep.high, side=OrderSide.SELL)
            return self._build_signal(
                symbol=symbol,
                side=OrderSide.SELL,
                entry=entry,
                stop=stop,
                strategy_type=StrategyType.LIQUIDITY_SWEEP_REVERSAL,
                reason="sweep above previous high, bearish rejection, bearish engulfing",
                pattern="bearish_liquidity_sweep",
            )

        return TradeSignal(symbol=symbol, decision=SignalDecision.WAIT, metadata={"reason": "liquidity sweep not detected"})

    def detect_breakout_retest(
        self,
        symbol: str,
        market: MarketSnapshot,
        market_state: MarketState | None = None,
    ) -> TradeSignal:
        """DetectBreakout plus retest confirmation."""

        bars = self._bars(market, Timeframe.M5)
        if len(bars) < 12:
            return TradeSignal(symbol=symbol, decision=SignalDecision.WAIT, metadata={"reason": "not enough M5 bars for breakout"})

        breakout = bars[-3]
        retest = bars[-2]
        confirmation = bars[-1]
        prior = bars[-12:-3]
        resistance = max(bar.high for bar in prior)
        support = min(bar.low for bar in prior)
        tolerance = self._level_tolerance(market)

        if (
            self.detect_breakout(breakout, resistance, OrderSide.BUY)
            and self.detect_retest(retest, resistance, OrderSide.BUY, tolerance)
            and self.detect_momentum_candle(confirmation, OrderSide.BUY)
        ):
            entry = confirmation.close
            stop = self._pad_stop(symbol=symbol, market=market, price=min(retest.low, resistance), side=OrderSide.BUY)
            return self._build_signal(
                symbol=symbol,
                side=OrderSide.BUY,
                entry=entry,
                stop=stop,
                strategy_type=StrategyType.BREAKOUT_RETEST,
                reason="break above resistance, retest held, bullish momentum candle",
                pattern="bullish_breakout_retest",
            )

        if (
            self.detect_breakout(breakout, support, OrderSide.SELL)
            and self.detect_retest(retest, support, OrderSide.SELL, tolerance)
            and self.detect_momentum_candle(confirmation, OrderSide.SELL)
        ):
            entry = confirmation.close
            stop = self._pad_stop(symbol=symbol, market=market, price=max(retest.high, support), side=OrderSide.SELL)
            return self._build_signal(
                symbol=symbol,
                side=OrderSide.SELL,
                entry=entry,
                stop=stop,
                strategy_type=StrategyType.BREAKOUT_RETEST,
                reason="break below support, retest held, bearish momentum candle",
                pattern="bearish_breakout_retest",
            )

        return TradeSignal(symbol=symbol, decision=SignalDecision.WAIT, metadata={"reason": "breakout retest not detected"})

    def detect_rejection(self, candle: Bar, side: OrderSide) -> bool:
        """DetectRejection using long wick against the swept level."""

        candle_range = candle.high - candle.low
        if candle_range <= 0:
            return False
        body = abs(candle.close - candle.open)
        lower_wick = min(candle.open, candle.close) - candle.low
        upper_wick = candle.high - max(candle.open, candle.close)
        if side == OrderSide.BUY:
            return lower_wick >= body * Decimal("1.5") and lower_wick / candle_range >= Decimal("0.45")
        return upper_wick >= body * Decimal("1.5") and upper_wick / candle_range >= Decimal("0.45")

    def detect_engulfing(self, previous: Bar, current: Bar, side: OrderSide) -> bool:
        """DetectEngulfing confirmation after a sweep candle."""

        if side == OrderSide.BUY:
            return current.close > current.open and current.open <= previous.close and current.close >= previous.open
        return current.close < current.open and current.open >= previous.close and current.close <= previous.open

    def detect_breakout(self, candle: Bar, level: Decimal, side: OrderSide) -> bool:
        """DetectBreakout beyond support or resistance."""

        if side == OrderSide.BUY:
            return candle.close > level and candle.high > level
        return candle.close < level and candle.low < level

    def detect_retest(self, candle: Bar, level: Decimal, side: OrderSide, tolerance: Decimal | None = None) -> bool:
        """DetectRetest of the broken support/resistance level."""

        tolerance = tolerance or Decimal("0")
        if side == OrderSide.BUY:
            return candle.low <= level + tolerance and candle.close >= level
        return candle.high >= level - tolerance and candle.close <= level

    def detect_momentum_candle(self, candle: Bar, side: OrderSide) -> bool:
        """DetectMomentumCandle using a large directional body."""

        candle_range = candle.high - candle.low
        if candle_range <= 0:
            return False
        body = abs(candle.close - candle.open)
        body_ratio = body / candle_range
        if side == OrderSide.BUY:
            return candle.close > candle.open and body_ratio >= Decimal("0.6")
        return candle.close < candle.open and body_ratio >= Decimal("0.6")

    def _build_signal(
        self,
        symbol: str,
        side: OrderSide,
        entry: Decimal,
        stop: Decimal,
        strategy_type: StrategyType,
        reason: str,
        pattern: str,
    ) -> TradeSignal:
        """Build a broker-neutral trade signal with 1R TP metadata."""

        risk = abs(entry - stop)
        if risk <= 0:
            return TradeSignal(symbol=symbol, decision=SignalDecision.BLOCKED, metadata={"reason": "invalid R value"})
        take_profit = entry + risk if side == OrderSide.BUY else entry - risk
        return TradeSignal(
            symbol=symbol,
            decision=SignalDecision.LONG if side == OrderSide.BUY else SignalDecision.SHORT,
            side=side,
            entry_price=entry,
            stop_loss=stop,
            take_profit=take_profit,
            metadata={
                "strategy_type": strategy_type,
                "entry_reason": reason,
                "pattern": pattern,
                "r_value": risk,
                "tp1": take_profit,
                "tp2": "runner_trailing",
                "partial_close_at_r": Decimal("1"),
                "partial_close_fraction": Decimal("0.5"),
                "move_to_breakeven_at_r": Decimal("1"),
                "trail_after_r": Decimal("1.2") if self._is_gold(symbol) else Decimal("1.5"),
            },
        )

    def _bars(self, market: MarketSnapshot, timeframe: Timeframe) -> list[Bar]:
        """Return bars for a timeframe."""

        return market.bars_by_timeframe.get(timeframe) or market.bars_by_timeframe.get(Timeframe(timeframe)) or []

    def _pad_stop(self, symbol: str, market: MarketSnapshot, price: Decimal, side: OrderSide) -> Decimal:
        """Pad stop one tick beyond the sweep candle or retest level."""

        tick = market.symbol_spec.tick_size if market.symbol_spec is not None else Decimal("0.01")
        if side == OrderSide.BUY:
            return price - tick
        return price + tick

    def _level_tolerance(self, market: MarketSnapshot) -> Decimal:
        """Allow a small retest tolerance around broken levels."""

        tick = market.symbol_spec.tick_size if market.symbol_spec is not None else Decimal("0.01")
        return tick * Decimal("2")

    def _signal_key(self, signal: TradeSignal) -> tuple[object, ...]:
        """Create a duplicate-signal key."""

        return (
            signal.symbol,
            signal.side,
            signal.entry_price,
            signal.stop_loss,
            signal.metadata.get("strategy_type"),
            signal.metadata.get("pattern"),
        )

    def _is_duplicate_signal(self, signal: TradeSignal) -> bool:
        """Avoid duplicate signals on repeated ticks."""

        return self._signal_key(signal) == self._last_signal_key

    def _is_gold(self, symbol: str) -> bool:
        normalized = symbol.upper()
        return "XAU" in normalized or "GOLD" in normalized

    def _is_index(self, symbol: str) -> bool:
        normalized = symbol.upper()
        return any(token in normalized for token in ("NQ", "NAS100", "US100", "US30", "DJ30", "SPX", "US500"))

    def open_trade(self, request: OrderRequest):
        """OpenTrade placeholder routed through the execution layer."""

        return self._execution_router.open_trade(request)

    def DetectTrend(self, market: MarketSnapshot) -> Regime:
        """Compatibility placeholder using the requested Phase 1 method name."""

        return self.detect_trend(market=market)

    def DetectStructure(self, market: MarketSnapshot):
        """Compatibility method using the requested PascalCase name."""

        return self.detect_structure(market=market)

    def DetectEntryCondition(self, market: MarketSnapshot):
        """Compatibility method using the requested PascalCase name."""

        return self.detect_entry_condition(market=market)

    def DetectVolatility(self, market: MarketSnapshot):
        """Compatibility method using the requested PascalCase name."""

        return self.detect_volatility(market=market)

    def GetMarketState(self, market: MarketSnapshot) -> MarketState:
        """Compatibility method using the requested PascalCase name."""

        return self.get_market_state(market=market)

    def OpenTrade(self, request: OrderRequest):
        """Compatibility placeholder using the requested Phase 1 method name."""

        return self.open_trade(request=request)

    def DetectLiquiditySweep(self, symbol: str, market: MarketSnapshot, market_state: MarketState | None = None) -> TradeSignal:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_liquidity_sweep(symbol=symbol, market=market, market_state=market_state)

    def DetectRejection(self, candle: Bar, side: OrderSide) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_rejection(candle=candle, side=side)

    def DetectEngulfing(self, previous: Bar, current: Bar, side: OrderSide) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_engulfing(previous=previous, current=current, side=side)

    def DetectBreakout(self, candle: Bar, level: Decimal, side: OrderSide) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_breakout(candle=candle, level=level, side=side)

    def DetectRetest(self, candle: Bar, level: Decimal, side: OrderSide, tolerance: Decimal | None = None) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_retest(candle=candle, level=level, side=side, tolerance=tolerance)

    def DetectMomentumCandle(self, candle: Bar, side: OrderSide) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.detect_momentum_candle(candle=candle, side=side)
