"""Prop-firm protection engine.

This module enforces account-level behavioral rules that decide whether the
robot may continue trading. It reads `RobotState` and `AccountSnapshot` only, so
it stays deterministic and works in both live trading and backtesting.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from trading_robot.config.settings import PropProtectionConfig
from trading_robot.state.robot_state import RobotState
from trading_robot.types.enums import CooldownState, PropProtectionState
from trading_robot.types.models import AccountSnapshot, PropProtectionDecision


class PropProtection:
    """Applies prop-firm style drawdown, trade count, and cooldown rules."""

    def __init__(self, config: PropProtectionConfig) -> None:
        self._config = config

    def evaluate(
        self,
        account: AccountSnapshot,
        state: RobotState,
        timestamp: datetime,
    ) -> PropProtectionDecision:
        """Return whether prop protection rules still allow trading."""

        if not self._config.enabled:
            return PropProtectionDecision(
                prop_safe=True,
                state=PropProtectionState.SAFE,
                cooldown_active=False,
                reason="prop protection disabled",
            )

        state.reset_daily_counters_if_needed(timestamp)
        state.refresh_cooldown(timestamp)

        daily_loss_limit = account.equity * self._config.max_daily_loss_pct
        if state.daily_pnl <= -daily_loss_limit:
            return PropProtectionDecision(
                prop_safe=False,
                state=PropProtectionState.VIOLATED,
                cooldown_active=False,
                reason="prop daily loss limit reached",
            )

        daily_target = account.equity * self._config.daily_target_pct
        if daily_target > 0 and state.daily_pnl >= daily_target:
            return PropProtectionDecision(
                prop_safe=False,
                state=PropProtectionState.VIOLATED,
                cooldown_active=False,
                reason="daily profit target reached",
            )

        if state.daily_trade_count >= self._config.max_trades_per_day:
            return PropProtectionDecision(
                prop_safe=False,
                state=PropProtectionState.VIOLATED,
                cooldown_active=False,
                reason="prop max trades per day reached",
            )

        if state.loss_streak >= self._config.max_loss_streak_before_cooldown:
            if state.cooldown_until is None:
                state.cooldown_state = CooldownState.ACTIVE
                state.cooldown_until = timestamp + timedelta(minutes=self._config.cooldown_minutes)
            return PropProtectionDecision(
                prop_safe=False,
                state=PropProtectionState.VIOLATED,
                cooldown_active=True,
                reason="prop loss streak cooldown active",
            )

        if state.cooldown_state == CooldownState.ACTIVE:
            return PropProtectionDecision(
                prop_safe=False,
                state=PropProtectionState.VIOLATED,
                cooldown_active=True,
                reason="cooldown active",
            )

        return PropProtectionDecision(
            prop_safe=True,
            state=PropProtectionState.SAFE,
            cooldown_active=False,
            reason="prop rules safe",
        )

    def apply_trade_outcome(
        self,
        pnl,
        account: AccountSnapshot,
        state: RobotState,
        timestamp: datetime,
    ) -> None:
        """Update state after a closed trade and apply configured cooldowns."""

        state.apply_trade_outcome(
            pnl=pnl,
            max_loss_streak_before_cooldown=self._config.max_loss_streak_before_cooldown,
            cooldown_minutes=self._config.cooldown_minutes,
            timestamp=timestamp,
        )
        if self._config.pause_after_big_win and pnl >= account.equity * self._config.big_win_pct:
            state.cooldown_state = CooldownState.ACTIVE
            state.cooldown_until = timestamp + timedelta(minutes=self._config.big_win_cooldown_minutes)

