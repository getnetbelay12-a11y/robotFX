"""AI-style risk adaptation without heavyweight ML."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from trading_robot.config.settings import RiskAdaptationConfig
from trading_robot.state.robot_state import RobotState
from trading_robot.types.enums import ConfidenceLevel, StrategyType, VolatilityState
from trading_robot.types.models import AccountSnapshot, MarketState, RiskAdaptationDecision, TradePermission


@dataclass
class PerformanceBucket:
    """Simple R-based performance bucket."""

    trades: int = 0
    net_r: Decimal = Decimal("0")

    def record(self, r_result: Decimal) -> None:
        self.trades += 1
        self.net_r += r_result


@dataclass
class AdaptationMemory:
    """Session and strategy performance memory."""

    session_performance: dict[str, PerformanceBucket] = field(default_factory=dict)
    strategy_performance: dict[str, PerformanceBucket] = field(default_factory=dict)


class RiskAdaptationEngine:
    """Adjusts risk and trading permission from lightweight state signals."""

    def __init__(self, config: RiskAdaptationConfig | None = None) -> None:
        self._config = config or RiskAdaptationConfig()
        self._memory = AdaptationMemory()

    def adjust_risk(
        self,
        state: RobotState,
        account: AccountSnapshot,
        market_state: MarketState | None = None,
        trade_permission: TradePermission | None = None,
        strategy_type: StrategyType | str | None = None,
    ) -> RiskAdaptationDecision:
        """AdjustRisk returns adjusted risk, permission, reason, and confidence."""

        drawdown_pct = self._drawdown_pct(state=state, account=account)
        risk = self._config.default_risk_pct
        confidence = Decimal("0.75")
        reasons: list[str] = []

        if state.daily_pnl >= account.equity * self._config.daily_target_pct:
            return self._decision(Decimal("0"), False, "daily target hit", Decimal("0.2"), drawdown_pct)
        if state.loss_streak >= self._config.loss_streak_stop_threshold:
            return self._decision(Decimal("0"), False, "loss streak stop threshold reached", Decimal("0.1"), drawdown_pct)
        if drawdown_pct >= self._config.drawdown_stop_threshold_pct:
            return self._decision(Decimal("0"), False, "drawdown stop threshold reached", Decimal("0.1"), drawdown_pct)

        if state.loss_streak >= self._config.loss_streak_reduce_threshold:
            risk = min(risk, self._config.reduced_risk_pct)
            confidence -= Decimal("0.2")
            reasons.append("reduced after 2 losses")
        if state.win_streak >= self._config.win_streak_increase_threshold and state.loss_streak == 0:
            risk = min(self._config.increased_risk_pct, self._config.max_risk_pct)
            confidence += Decimal("0.1")
            reasons.append("increased after 2 wins")

        if market_state is not None and market_state.volatility == VolatilityState.HIGH:
            risk *= self._config.high_volatility_multiplier
            confidence -= Decimal("0.15")
            reasons.append("reduced for high volatility")
        elif market_state is not None and market_state.volatility == VolatilityState.LOW:
            reasons.append("normal risk for low volatility")

        if drawdown_pct >= self._config.drawdown_reduce_threshold_pct:
            risk = min(risk, self._config.reduced_risk_pct)
            confidence -= Decimal("0.2")
            reasons.append("reduced for drawdown")

        session = trade_permission.session_quality.value if trade_permission is not None else "unknown"
        if self._is_underperforming("session", session):
            risk = min(risk, self._config.reduced_risk_pct)
            confidence -= Decimal("0.1")
            reasons.append(f"reduced for underperforming session {session}")

        strategy_name = str(strategy_type.value if isinstance(strategy_type, StrategyType) else strategy_type or "unknown")
        if self._is_underperforming("strategy", strategy_name):
            risk = min(risk, self._config.reduced_risk_pct)
            confidence -= Decimal("0.1")
            reasons.append(f"reduced for underperforming strategy {strategy_name}")

        if self._config.abnormal_volatility_blocks and market_state is not None and market_state.volatility == VolatilityState.UNKNOWN:
            return self._decision(Decimal("0"), False, "market volatility unstable", Decimal("0.1"), drawdown_pct)
        if state.cooldown_until is not None:
            return self._decision(Decimal("0"), False, "cooldown active", Decimal("0.1"), drawdown_pct)

        risk = max(Decimal("0"), min(risk, self._config.max_risk_pct))
        confidence = max(self._config.confidence_floor, min(Decimal("1"), confidence))
        return self._decision(risk, True, "; ".join(reasons) if reasons else "default risk", confidence, drawdown_pct)

    def record_session_result(self, session: str, r_result: Decimal) -> None:
        """Track per-session performance."""

        self._memory.session_performance.setdefault(session, PerformanceBucket()).record(r_result)

    def record_strategy_result(self, strategy_type: StrategyType | str, r_result: Decimal) -> None:
        """Track per-strategy performance."""

        key = str(strategy_type.value if isinstance(strategy_type, StrategyType) else strategy_type)
        self._memory.strategy_performance.setdefault(key, PerformanceBucket()).record(r_result)

    def _is_underperforming(self, bucket_type: str, key: str) -> bool:
        bucket = self._memory.session_performance.get(key) if bucket_type == "session" else self._memory.strategy_performance.get(key)
        return bool(
            bucket is not None
            and bucket.trades >= self._config.underperformance_min_trades
            and bucket.net_r <= self._config.underperformance_profit_threshold
        )

    def _drawdown_pct(self, state: RobotState, account: AccountSnapshot) -> Decimal:
        if account.equity <= 0:
            return Decimal("0")
        return abs(min(state.daily_pnl, Decimal("0"))) / account.equity

    def _decision(self, risk: Decimal, allowed: bool, reason: str, confidence: Decimal, drawdown_pct: Decimal) -> RiskAdaptationDecision:
        if confidence >= Decimal("0.7"):
            level = ConfidenceLevel.HIGH
        elif confidence >= Decimal("0.4"):
            level = ConfidenceLevel.MEDIUM
        else:
            level = ConfidenceLevel.LOW
        return RiskAdaptationDecision(
            adjusted_risk=risk,
            trading_allowed=allowed,
            reason=reason,
            confidence_level=level,
            metadata={"drawdown_pct": drawdown_pct},
        )

    def AdjustRisk(
        self,
        state: RobotState,
        account: AccountSnapshot,
        market_state: MarketState | None = None,
        trade_permission: TradePermission | None = None,
        strategy_type: StrategyType | str | None = None,
    ) -> RiskAdaptationDecision:
        """Compatibility method using the requested PascalCase name."""

        return self.adjust_risk(state, account, market_state, trade_permission, strategy_type)

