"""Shared domain models.

The models describe internal contracts. Broker adapters should translate their
native DTOs into these models before the rest of the system consumes them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any

from trading_robot.types.enums import (
    EntryReadiness,
    ConfidenceLevel,
    MarketStateDecision,
    NewsLockState,
    OrderSide,
    OrderStatus,
    OrderType,
    PositionStatus,
    PropProtectionState,
    Regime,
    SessionQuality,
    SessionState,
    SignalDecision,
    StrategyType,
    StructureState,
    Timeframe,
    VolatilityState,
)


@dataclass(frozen=True)
class SymbolSpec:
    """Contract metadata required for position sizing and order validation."""

    symbol: str
    base_currency: str | None = None
    quote_currency: str | None = None
    tick_size: Decimal = Decimal("0.01")
    tick_value: Decimal = Decimal("1")
    min_volume: Decimal = Decimal("0.01")
    volume_step: Decimal = Decimal("0.01")
    max_volume: Decimal | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Bar:
    """OHLCV candle for one symbol and timeframe."""

    symbol: str
    timeframe: Timeframe
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


@dataclass(frozen=True)
class MarketSnapshot:
    """Latest data bundle used by strategy and risk modules."""

    symbol: str
    bars_by_timeframe: dict[Timeframe, list[Bar]]
    bid: Decimal | None = None
    ask: Decimal | None = None
    symbol_spec: SymbolSpec | None = None


@dataclass(frozen=True)
class AccountSnapshot:
    """Account state used by risk manager and execution router."""

    equity: Decimal
    balance: Decimal
    margin_free: Decimal | None = None
    currency: str = "USD"


@dataclass(frozen=True)
class NewsEvent:
    """Economic calendar event normalized from a future news provider."""

    event_id: str
    timestamp: datetime
    currency: str
    impact: str
    title: str


@dataclass(frozen=True)
class SessionDecision:
    """Session permission and quality output."""

    session_valid: bool
    state: SessionState
    quality: SessionQuality
    active_session: str | None = None
    reason: str = ""


@dataclass(frozen=True)
class NewsDecision:
    """News filter output including post-news mode."""

    news_blocked: bool
    state: NewsLockState
    reason: str = ""
    event: NewsEvent | None = None


@dataclass(frozen=True)
class PropProtectionDecision:
    """Prop-firm protection output."""

    prop_safe: bool
    state: PropProtectionState
    cooldown_active: bool
    reason: str = ""


@dataclass(frozen=True)
class TradePermission:
    """Final trading permission object for session, news, cooldown, and prop rules."""

    session_valid: bool
    news_blocked: bool
    cooldown_active: bool
    prop_safe: bool
    can_trade: bool
    reasons: tuple[str, ...] = ()
    session_quality: SessionQuality = SessionQuality.LOW
    news_state: NewsLockState = NewsLockState.UNKNOWN
    active_session: str | None = None

    def as_output(self) -> dict[str, Any]:
        """Return API-style output with the requested field names."""

        return {
            "sessionValid": self.session_valid,
            "newsBlocked": self.news_blocked,
            "cooldownActive": self.cooldown_active,
            "propSafe": self.prop_safe,
            "canTrade": self.can_trade,
        }


@dataclass(frozen=True)
class RiskAdaptationDecision:
    """Output of the dynamic risk adaptation engine."""

    adjusted_risk: Decimal
    trading_allowed: bool
    reason: str
    confidence_level: ConfidenceLevel
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_output(self) -> dict[str, Any]:
        """Return API-style output with the requested field names."""

        return {
            "adjustedRisk": self.adjusted_risk,
            "tradingAllowed": self.trading_allowed,
            "reason": self.reason,
            "confidenceLevel": self.confidence_level,
        }


@dataclass(frozen=True)
class SetupScore:
    """Score returned by the setup scorer before order creation."""

    symbol: str
    score: int
    reasons: tuple[str, ...] = ()
    valid: bool = False
    reason: str = ""
    priority_rank: int | None = None
    breakdown: dict[str, int] = field(default_factory=dict)

    def as_output(self) -> dict[str, Any]:
        """Return API-style output with the requested field names."""

        return {
            "symbol": self.symbol,
            "score": self.score,
            "valid": self.valid,
            "reason": self.reason,
            "priorityRank": self.priority_rank,
        }


@dataclass(frozen=True)
class MarketState:
    """Structured multi-timeframe market intelligence output."""

    symbol: str
    regime: Regime
    structure: StructureState
    volatility: VolatilityState
    entry_ready: EntryReadiness
    trade_allowed: MarketStateDecision
    reasons: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_output(self) -> dict[str, Any]:
        """Return API-style output with the requested field names."""

        return {
            "symbol": self.symbol,
            "regime": self.regime,
            "structure": self.structure,
            "volatility": self.volatility,
            "entryReady": self.entry_ready,
            "tradeAllowed": self.trade_allowed,
        }


@dataclass(frozen=True)
class TradeSignal:
    """Strategy output before execution."""

    symbol: str
    decision: SignalDecision
    regime: Regime = Regime.UNKNOWN
    score: SetupScore | None = None
    side: OrderSide | None = None
    entry_price: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_output(self) -> dict[str, Any]:
        """Return API-style output with the requested field names."""

        return {
            "symbol": self.symbol,
            "direction": self.side,
            "entryPrice": self.entry_price,
            "stopLoss": self.stop_loss,
            "takeProfit": self.take_profit,
            "strategyType": self.metadata.get("strategy_type", StrategyType.NONE),
        }


@dataclass(frozen=True)
class OrderRequest:
    """Broker-neutral order request."""

    symbol: str
    side: OrderSide
    order_type: OrderType
    volume: Decimal
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    price: Decimal | None = None
    comment: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class OrderResult:
    """Broker-neutral order response."""

    order_id: str | None
    status: OrderStatus
    message: str = ""
    filled_volume: Decimal = Decimal("0")
    average_price: Decimal | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Position:
    """Open or closed position tracked by robot state."""

    position_id: str
    symbol: str
    side: OrderSide
    volume: Decimal
    entry_price: Decimal
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    status: PositionStatus = PositionStatus.OPEN
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def initial_stop_loss(self) -> Decimal | None:
        """Return original stop-loss if available, otherwise current stop-loss."""

        value = self.metadata.get("initial_stop_loss", self.stop_loss)
        return value if isinstance(value, Decimal) else self.stop_loss
