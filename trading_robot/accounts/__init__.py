"""Multi-account and cross-platform execution exports."""

from trading_robot.accounts.account_manager import AccountManager
from trading_robot.accounts.adapters import ExecutionAdapter, MT5Adapter, TopstepAdapter
from trading_robot.accounts.master_signal_engine import MasterSignalEngine
from trading_robot.accounts.models import AccountExecutionResult, CopyResult, ManagedAccount, MasterTradeSignal
from trading_robot.accounts.trade_copier import TradeCopier

__all__ = [
    "AccountExecutionResult",
    "AccountManager",
    "CopyResult",
    "ExecutionAdapter",
    "MT5Adapter",
    "ManagedAccount",
    "MasterSignalEngine",
    "MasterTradeSignal",
    "TopstepAdapter",
    "TradeCopier",
]

