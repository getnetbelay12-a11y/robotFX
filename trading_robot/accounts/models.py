"""Account and signal models for multi-account execution."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal

from trading_robot.types.enums import BrokerType, CooldownState, OrderSide


@dataclass(frozen=True)
class MasterTradeSignal:
    """Centralized signal format shared by MT5 and Topstep-style adapters."""

    symbol: str
    direction: OrderSide
    entry: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    risk_pct: Decimal
    strategy_type: str = "unknown"
    signal_id: str | None = None

    def as_output(self) -> dict[str, object]:
        """Return the Phase 9 signal output shape."""

        return {
            "symbol": self.symbol,
            "direction": self.direction,
            "entry": self.entry,
            "SL": self.stop_loss,
            "TP": self.take_profit,
            "risk %": self.risk_pct,
        }


@dataclass
class ManagedAccount:
    """Per-account state and compliance settings."""

    account_id: str
    broker_type: BrokerType
    balance: Decimal
    equity: Decimal
    risk_allocation_pct: Decimal = Decimal("0.005")
    active: bool = True
    paused: bool = False
    daily_pnl: Decimal = Decimal("0")
    daily_trade_count: int = 0
    loss_streak: int = 0
    cooldown_until: datetime | None = None
    trading_day: date | None = None
    daily_loss_limit_pct: Decimal = Decimal("0.015")
    max_trades_per_day: int = 3
    max_loss_streak_before_cooldown: int = 2
    cooldown_minutes: int = 120
    consistency_pnl: list[Decimal] = field(default_factory=list)

    @property
    def status(self) -> str:
        """Return active / paused status."""

        if not self.active:
            return "disabled"
        if self.paused or self.cooldown_until is not None:
            return "paused"
        return "active"

    def reset_daily_if_needed(self, timestamp: datetime) -> None:
        """Reset day-specific counters."""

        if self.trading_day != timestamp.date():
            self.trading_day = timestamp.date()
            self.daily_pnl = Decimal("0")
            self.daily_trade_count = 0

    def apply_trade_outcome(self, pnl: Decimal, timestamp: datetime) -> None:
        """Update account P&L, streaks, cooldown, and consistency tracking."""

        self.reset_daily_if_needed(timestamp)
        self.daily_pnl += pnl
        self.consistency_pnl.append(pnl)
        if pnl < 0:
            self.loss_streak += 1
        elif pnl > 0:
            self.loss_streak = 0
        if self.loss_streak >= self.max_loss_streak_before_cooldown:
            self.paused = True
            self.cooldown_until = timestamp + timedelta(minutes=self.cooldown_minutes)


@dataclass(frozen=True)
class AccountExecutionResult:
    """Per-account execution result."""

    account_id: str
    success: bool
    ticket: str | None = None
    error_message: str = ""
    risk_used: Decimal = Decimal("0")


@dataclass(frozen=True)
class CopyResult:
    """Aggregated trade copier output."""

    signal_id: str
    results: tuple[AccountExecutionResult, ...]

