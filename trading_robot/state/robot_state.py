"""Central runtime state.

The state object is deliberately small and serializable. Modules can read it to
make decisions, but long-term persistence should later be handled by a journal
or database layer to support restarts and auditability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal

from trading_robot.types.enums import CooldownState, NewsLockState, Regime, SessionState
from trading_robot.types.models import Position


@dataclass
class RobotState:
    """Tracks current symbol, regime, streaks, locks, and open positions."""

    current_symbol: str | None = None
    current_regime: Regime = Regime.UNKNOWN
    daily_pnl: Decimal = Decimal("0")
    open_positions: dict[str, Position] = field(default_factory=dict)
    daily_trade_count: int = 0
    trading_day: date | None = None
    loss_streak: int = 0
    win_streak: int = 0
    cooldown_state: CooldownState = CooldownState.NONE
    cooldown_until: datetime | None = None
    session_state: SessionState = SessionState.UNKNOWN
    news_lock_state: NewsLockState = NewsLockState.UNKNOWN
    last_updated_at: datetime | None = None

    def set_symbol(self, symbol: str) -> None:
        """Set the active symbol for the current strategy cycle."""

        self.current_symbol = symbol
        self.last_updated_at = datetime.utcnow()

    def update_regime(self, regime: Regime) -> None:
        """Store the latest H1 regime classification."""

        self.current_regime = regime
        self.last_updated_at = datetime.utcnow()

    def register_position(self, position: Position) -> None:
        """Add or replace an open position in state."""

        is_new_position = position.position_id not in self.open_positions
        self.open_positions[position.position_id] = position
        if is_new_position:
            self.daily_trade_count += 1
            self.trading_day = (position.opened_at or datetime.utcnow()).date()
        self.last_updated_at = datetime.utcnow()

    def remove_position(self, position_id: str) -> None:
        """Remove a position once the broker confirms it is closed."""

        self.open_positions.pop(position_id, None)
        self.last_updated_at = datetime.utcnow()

    def reset_daily_counters_if_needed(self, timestamp: datetime) -> None:
        """Reset daily counters when a new trading day starts."""

        if self.trading_day != timestamp.date():
            self.trading_day = timestamp.date()
            self.daily_pnl = Decimal("0")
            self.daily_trade_count = 0
            self.last_updated_at = datetime.utcnow()

    def apply_trade_outcome(
        self,
        pnl: Decimal,
        max_loss_streak_before_cooldown: int,
        cooldown_minutes: int,
        timestamp: datetime,
    ) -> None:
        """Update P&L, win/loss streaks, and cooldown after a closed trade."""

        self.reset_daily_counters_if_needed(timestamp)
        self.daily_pnl += pnl
        if pnl < 0:
            self.loss_streak += 1
            self.win_streak = 0
        elif pnl > 0:
            self.win_streak += 1
            self.loss_streak = 0

        if self.loss_streak >= max_loss_streak_before_cooldown:
            self.cooldown_state = CooldownState.ACTIVE
            self.cooldown_until = timestamp + timedelta(minutes=cooldown_minutes)

        self.last_updated_at = datetime.utcnow()

    def refresh_cooldown(self, timestamp: datetime) -> None:
        """Deactivate cooldown after its end time has passed."""

        if self.cooldown_until is not None and timestamp >= self.cooldown_until:
            self.cooldown_state = CooldownState.NONE
            self.cooldown_until = None
            self.last_updated_at = datetime.utcnow()
