"""Risk manager.

All trade sizing and account-level permission checks belong here. The strategy
can propose a signal, but the risk manager decides whether it is allowed and how
large it can be.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_FLOOR

from trading_robot.config.settings import RiskConfig
from trading_robot.operations.alerts import AlertDispatcher
from trading_robot.state.robot_state import RobotState
from trading_robot.types.enums import CooldownState, MarketStateDecision, OrderSide, SignalDecision
from trading_robot.types.models import AccountSnapshot, MarketSnapshot, SymbolSpec, TradeSignal


@dataclass(frozen=True)
class RiskDecision:
    """Result of a risk calculation."""

    allowed: bool
    volume: Decimal = Decimal("0")
    reason: str = ""
    risk_amount: Decimal = Decimal("0")
    stop_distance: Decimal = Decimal("0")
    risk_per_unit: Decimal = Decimal("0")


class RiskManager:
    """Calculates risk and applies global kill-switch style constraints."""

    def __init__(self, config: RiskConfig, alert_dispatcher: AlertDispatcher | None = None) -> None:
        self._config = config
        self._alert_dispatcher = alert_dispatcher

    def calculate_risk(
        self,
        signal: TradeSignal,
        market: MarketSnapshot,
        account: AccountSnapshot,
        state: RobotState,
        timestamp: datetime | None = None,
    ) -> RiskDecision:
        """Calculate lot size and enforce account-level risk gates.

        The calculation is broker-neutral and backtest-friendly:
        risk amount = account equity * configured risk percentage
        risk per 1.0 volume = stop distance / tick size * tick value
        volume = risk amount / risk per 1.0 volume, rounded down to volume step
        """

        timestamp = timestamp or datetime.utcnow()
        state.reset_daily_counters_if_needed(timestamp)
        state.refresh_cooldown(timestamp)

        gate = self._validate_trade_allowed(signal=signal, account=account, state=state)
        if gate is not None:
            return gate

        if market.symbol_spec is None:
            return RiskDecision(allowed=False, reason="missing symbol specification")

        entry_price = self._resolve_entry_price(signal=signal, market=market)
        if entry_price is None:
            return RiskDecision(allowed=False, reason="missing entry price")
        if signal.stop_loss is None:
            return RiskDecision(allowed=False, reason="missing stop loss")

        stop_distance = abs(entry_price - signal.stop_loss)
        if stop_distance <= 0:
            return RiskDecision(allowed=False, reason="stop distance must be greater than zero")

        risk_per_unit = self._risk_per_unit(stop_distance=stop_distance, symbol_spec=market.symbol_spec)
        if risk_per_unit <= 0:
            return RiskDecision(allowed=False, reason="invalid symbol risk metadata")

        risk_pct = self._config.max_risk_per_trade_pct
        adaptation = signal.metadata.get("risk_adaptation")
        if adaptation is not None:
            risk_pct = min(risk_pct, adaptation.adjusted_risk)
        control_risk_pct = signal.metadata.get("control_risk_pct")
        if control_risk_pct is not None:
            risk_pct = min(risk_pct, control_risk_pct)
        risk_amount = account.equity * risk_pct
        raw_volume = risk_amount / risk_per_unit
        volume = self._round_volume_down(raw_volume=raw_volume, symbol_spec=market.symbol_spec)

        if volume <= 0:
            return RiskDecision(
                allowed=False,
                reason="calculated volume is below minimum volume",
                risk_amount=risk_amount,
                stop_distance=stop_distance,
                risk_per_unit=risk_per_unit,
            )

        return RiskDecision(
            allowed=True,
            volume=volume,
            reason="risk approved",
            risk_amount=risk_amount,
            stop_distance=stop_distance,
            risk_per_unit=risk_per_unit,
        )

    def _validate_trade_allowed(
        self,
        signal: TradeSignal,
        account: AccountSnapshot,
        state: RobotState,
    ) -> RiskDecision | None:
        """Return a blocking decision when a risk gate fails."""

        if signal.decision in {SignalDecision.WAIT, SignalDecision.BLOCKED}:
            return RiskDecision(allowed=False, reason=f"signal decision is {signal.decision.value}")
        if signal.side is None:
            return RiskDecision(allowed=False, reason="missing signal side")
        market_state = signal.metadata.get("market_state")
        if market_state is not None and getattr(market_state, "trade_allowed", None) == MarketStateDecision.NO_TRADE:
            return RiskDecision(allowed=False, reason="market state is no trade")
        trade_permission = signal.metadata.get("trade_permission")
        if trade_permission is not None and not getattr(trade_permission, "can_trade", False):
            return RiskDecision(allowed=False, reason="trade permission denied")
        control_decision = signal.metadata.get("control_decision")
        if control_decision is not None and not getattr(control_decision, "trading_allowed", False):
            return RiskDecision(allowed=False, reason=f"control blocked trading: {control_decision.reason}")
        adaptation = signal.metadata.get("risk_adaptation")
        if adaptation is not None and not getattr(adaptation, "trading_allowed", False):
            return RiskDecision(allowed=False, reason=f"risk adaptation blocked trading: {adaptation.reason}")
        if signal.score is not None and not signal.score.valid:
            return RiskDecision(allowed=False, reason="setup score below threshold")

        daily_loss_limit = account.equity * self._config.max_daily_loss_pct
        if state.daily_pnl <= -daily_loss_limit:
            if self._alert_dispatcher is not None:
                self._alert_dispatcher.notify_daily_loss_reached(state.daily_pnl)
            return RiskDecision(allowed=False, reason="daily loss cap reached")
        if state.daily_trade_count >= self._config.max_trades_per_day:
            return RiskDecision(allowed=False, reason="maximum trades per day reached")
        if len(state.open_positions) >= self._config.max_open_positions:
            return RiskDecision(allowed=False, reason="maximum open positions reached")
        if state.cooldown_state == CooldownState.ACTIVE:
            return RiskDecision(allowed=False, reason="cooldown is active")
        if state.loss_streak >= self._config.max_loss_streak_before_cooldown:
            return RiskDecision(allowed=False, reason="loss streak cooldown threshold reached")

        return None

    def _resolve_entry_price(self, signal: TradeSignal, market: MarketSnapshot) -> Decimal | None:
        """Use explicit signal entry or the latest broker-neutral quote."""

        if signal.entry_price is not None:
            return signal.entry_price
        if signal.side == OrderSide.BUY:
            return market.ask
        if signal.side == OrderSide.SELL:
            return market.bid
        return None

    def _risk_per_unit(self, stop_distance: Decimal, symbol_spec: SymbolSpec) -> Decimal:
        """Calculate cash risk for 1.0 volume at the provided stop distance."""

        if symbol_spec.tick_size <= 0 or symbol_spec.tick_value <= 0:
            return Decimal("0")
        ticks_at_risk = stop_distance / symbol_spec.tick_size
        return ticks_at_risk * symbol_spec.tick_value

    def _round_volume_down(self, raw_volume: Decimal, symbol_spec: SymbolSpec) -> Decimal:
        """Round down to broker volume step while respecting min/max volume."""

        step = symbol_spec.volume_step
        if step <= 0:
            return Decimal("0")
        rounded = (raw_volume / step).to_integral_value(rounding=ROUND_FLOOR) * step
        if rounded < symbol_spec.min_volume:
            return Decimal("0")
        if symbol_spec.max_volume is not None and rounded > symbol_spec.max_volume:
            max_steps = (symbol_spec.max_volume / step).to_integral_value(rounding=ROUND_FLOOR)
            return max_steps * step
        return rounded

    def CalculateRisk(
        self,
        signal: TradeSignal,
        market: MarketSnapshot,
        account: AccountSnapshot,
        state: RobotState,
        timestamp: datetime | None = None,
    ) -> RiskDecision:
        """Compatibility method using the requested PascalCase name."""

        return self.calculate_risk(
            signal=signal,
            market=market,
            account=account,
            state=state,
            timestamp=timestamp,
        )
