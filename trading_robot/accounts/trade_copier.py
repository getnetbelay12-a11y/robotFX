"""Trade copier for multi-account signal distribution."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_FLOOR

from trading_robot.accounts.account_manager import AccountManager
from trading_robot.accounts.adapters import ExecutionAdapter
from trading_robot.accounts.models import AccountExecutionResult, CopyResult, ManagedAccount, MasterTradeSignal
from trading_robot.journal.logger import TradingLogger
from trading_robot.types.enums import BrokerType


class TradeCopier:
    """Distributes one master signal to all safe active accounts."""

    def __init__(
        self,
        account_manager: AccountManager,
        adapters: dict[BrokerType, ExecutionAdapter],
        logger: TradingLogger | None = None,
    ) -> None:
        self._account_manager = account_manager
        self._adapters = adapters
        self._logger = logger or TradingLogger()
        self._executed_signal_accounts: set[tuple[str, str]] = set()

    def copy_signal(self, signal: MasterTradeSignal, timestamp: datetime) -> CopyResult:
        """Send a signal to all active accounts with isolated failure handling."""

        results: list[AccountExecutionResult] = []
        signal_id = signal.signal_id or f"{signal.symbol}:{signal.direction}:{signal.entry}"
        for account in self._account_manager.active_accounts(timestamp):
            duplicate_key = (signal_id, account.account_id)
            if duplicate_key in self._executed_signal_accounts:
                results.append(AccountExecutionResult(account_id=account.account_id, success=False, error_message="duplicate execution skipped"))
                continue

            allowed, reason = self._account_manager.can_trade(account=account, signal=signal, timestamp=timestamp)
            if not allowed:
                results.append(AccountExecutionResult(account_id=account.account_id, success=False, error_message=reason))
                self._logger.warning("account skipped", account_id=account.account_id, reason=reason)
                continue

            adapter = self._adapters.get(account.broker_type)
            if adapter is None:
                results.append(AccountExecutionResult(account_id=account.account_id, success=False, error_message="missing execution adapter"))
                continue

            volume = self._volume_for_account(account=account, signal=signal)
            try:
                result = adapter.execute(account=account, signal=signal, volume=volume)
            except Exception as exc:  # Account isolation boundary.
                account.active = False
                result = AccountExecutionResult(account_id=account.account_id, success=False, error_message=str(exc))

            if result.success:
                self._executed_signal_accounts.add(duplicate_key)
                self._account_manager.mark_trade_sent(account)
                self._logger.info("copied trade executed", account_id=account.account_id, risk_used=result.risk_used, ticket=result.ticket)
            else:
                account.active = False
                self._logger.error("copied trade failed; account disabled", account_id=account.account_id, error=result.error_message)
            results.append(result)

        return CopyResult(signal_id=signal_id, results=tuple(results))

    def _volume_for_account(self, account: ManagedAccount, signal: MasterTradeSignal) -> Decimal:
        """Adjust lot size by account equity and risk allocation.

        This deliberately stays generic. Platform-specific adapters can remap
        volume to contracts or lots when full contract specs are available.
        """

        risk_pct = min(signal.risk_pct, account.risk_allocation_pct, Decimal("0.005"))
        risk_amount = account.equity * risk_pct
        stop_distance = abs(signal.entry - signal.stop_loss)
        if stop_distance <= 0:
            return Decimal("0")
        raw_volume = risk_amount / (stop_distance * Decimal("100"))
        return (raw_volume / Decimal("0.01")).to_integral_value(rounding=ROUND_FLOOR) * Decimal("0.01")

    def CopySignal(self, signal: MasterTradeSignal, timestamp: datetime) -> CopyResult:
        """Compatibility method using the requested PascalCase name."""

        return self.copy_signal(signal=signal, timestamp=timestamp)

