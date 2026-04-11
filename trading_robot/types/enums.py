"""Domain enums.

Enums keep cross-module contracts explicit and avoid leaking broker-specific
strings through the strategy, risk, and backtest layers.
"""

from enum import Enum


class StrEnum(str, Enum):
    """Python 3.9-compatible string enum base."""


class BrokerType(StrEnum):
    """Supported execution route families."""

    MT5 = "mt5"
    TOPSTEPX = "topstepx"
    BACKTEST = "backtest"


class Timeframe(StrEnum):
    """Canonical strategy timeframes."""

    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"


class Regime(StrEnum):
    """Higher-timeframe market regime classification."""

    UNKNOWN = "unknown"
    BULLISH = "bullish"
    BEARISH = "bearish"
    SIDEWAYS = "sideways"
    RANGING = "ranging"
    VOLATILE = "volatile"


class StructureState(StrEnum):
    """M15 structure classification."""

    UNKNOWN = "unknown"
    TRENDING_UP = "trending_up"
    TRENDING_DOWN = "trending_down"
    RANGE = "range"


class EntryReadiness(StrEnum):
    """M5 entry readiness classification."""

    READY = "ready"
    NOT_READY = "not_ready"


class VolatilityState(StrEnum):
    """ATR-based volatility regime."""

    UNKNOWN = "unknown"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class MarketStateDecision(StrEnum):
    """Final market permission decision."""

    TRADE_ALLOWED = "trade_allowed"
    NO_TRADE = "no_trade"


class SessionState(StrEnum):
    """Trading-session availability state."""

    UNKNOWN = "unknown"
    OPEN = "open"
    CLOSED = "closed"
    RESTRICTED = "restricted"


class SessionQuality(StrEnum):
    """Quality classification for active trading sessions."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class NewsLockState(StrEnum):
    """News lockout state for high-impact events."""

    UNKNOWN = "unknown"
    CLEAR = "clear"
    LOCKED = "locked"
    POST_NEWS = "post_news"


class PropProtectionState(StrEnum):
    """Prop-firm protection state."""

    SAFE = "safe"
    VIOLATED = "violated"


class CooldownState(StrEnum):
    """Risk cooldown state after loss streaks or daily drawdown."""

    NONE = "none"
    ACTIVE = "active"


class OrderSide(StrEnum):
    """Trade direction."""

    BUY = "buy"
    SELL = "sell"


class OrderType(StrEnum):
    """Order execution type."""

    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"


class OrderStatus(StrEnum):
    """Broker order result state."""

    ACCEPTED = "accepted"
    REJECTED = "rejected"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"


class PositionStatus(StrEnum):
    """Position lifecycle state."""

    OPEN = "open"
    CLOSED = "closed"


class SignalDecision(StrEnum):
    """Strategy decision after filters, risk, and scoring."""

    WAIT = "wait"
    LONG = "long"
    SHORT = "short"
    BLOCKED = "blocked"


class StrategyType(StrEnum):
    """Supported entry strategy families."""

    NONE = "none"
    LIQUIDITY_SWEEP_REVERSAL = "liquidity_sweep_reversal"
    BREAKOUT_RETEST = "breakout_retest"


class ConfidenceLevel(StrEnum):
    """Risk adaptation confidence levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
