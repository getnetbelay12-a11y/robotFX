"""Multi-account manager with per-account prop compliance."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from trading_robot.accounts.models import ManagedAccount, MasterTradeSignal


class AccountManager:
    """Tracks accounts, status, and per-account trading permissions."""

    def __init__(self, accounts: tuple[ManagedAccount, ...] = ()) -> None:
        self._accounts: dict[str, ManagedAccount] = {account.account_id: account for account in accounts}

    def add_account(self, account: ManagedAccount) -> None:
        """Add or replace an account dynamically."""

        self._accounts[account.account_id] = account

    def remove_account(self, account_id: str) -> None:
        """Remove an account dynamically."""

        self._accounts.pop(account_id, None)

    def enable_account(self, account_id: str) -> None:
        """Enable an account."""

        self._accounts[account_id].active = True
        self._accounts[account_id].paused = False

    def disable_account(self, account_id: str) -> None:
        """Disable one account without affecting the others."""

        self._accounts[account_id].active = False

    def pause_account(self, account_id: str) -> None:
        """Pause one account."""

        self._accounts[account_id].paused = True

    def active_accounts(self, timestamp: datetime) -> tuple[ManagedAccount, ...]:
        """Return accounts that may receive copied signals."""

        accounts: list[ManagedAccount] = []
        for account in self._accounts.values():
            account.reset_daily_if_needed(timestamp)
            if account.cooldown_until is not None and timestamp >= account.cooldown_until:
                account.cooldown_until = None
                account.paused = False
            if account.active and not account.paused and account.cooldown_until is None:
                accounts.append(account)
        return tuple(accounts)

    def can_trade(self, account: ManagedAccount, signal: MasterTradeSignal, timestamp: datetime) -> tuple[bool, str]:
        """Apply account-isolated prop/risk compliance."""

        account.reset_daily_if_needed(timestamp)
        if not account.active:
            return False, "account disabled"
        if account.paused:
            return False, "account paused"
        if account.cooldown_until is not None and timestamp < account.cooldown_until:
            return False, "account cooldown active"
        if account.daily_pnl <= -(account.equity * account.daily_loss_limit_pct):
            return False, "daily loss limit reached"
        if account.daily_trade_count >= account.max_trades_per_day:
            return False, "max trades per day reached"
        if account.loss_streak >= account.max_loss_streak_before_cooldown:
            return False, "loss streak cooldown required"
        if signal.risk_pct > Decimal("0.005"):
            return False, "signal risk exceeds per-account 0.5% max"
        if account.risk_allocation_pct > Decimal("0.005"):
            return False, "account risk allocation exceeds 0.5% max"
        return True, "account safe"

    def mark_trade_sent(self, account: ManagedAccount) -> None:
        """Increment account trade count after a copied order is accepted."""

        account.daily_trade_count += 1

    def update_pnl(self, account_id: str, pnl: Decimal, timestamp: datetime) -> None:
        """Update one account's P&L and compliance state."""

        self._accounts[account_id].apply_trade_outcome(pnl=pnl, timestamp=timestamp)

    def all_accounts(self) -> tuple[ManagedAccount, ...]:
        """Return all managed accounts."""

        return tuple(self._accounts.values())

