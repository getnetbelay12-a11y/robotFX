"""Operational monitoring for live deployment."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from trading_robot.journal.logger import TradingLogger
from trading_robot.state import RobotState


@dataclass
class PerformanceSnapshot:
    """Lightweight operational metrics for dashboards or alerts."""

    timestamp: datetime
    daily_pnl: Decimal
    open_positions: int
    daily_trade_count: int
    win_streak: int
    loss_streak: int
    metadata: dict[str, str] = field(default_factory=dict)


class OperationalMonitor:
    """Tracks runtime performance and emits optional alerts via logs."""

    def __init__(self, logger: TradingLogger | None = None) -> None:
        self._logger = logger or TradingLogger()
        self._snapshots: list[PerformanceSnapshot] = []

    def record_state(self, state: RobotState, metadata: dict[str, str] | None = None) -> PerformanceSnapshot:
        """Capture a runtime snapshot and log it for monitoring."""

        snapshot = PerformanceSnapshot(
            timestamp=datetime.utcnow(),
            daily_pnl=state.daily_pnl,
            open_positions=len(state.open_positions),
            daily_trade_count=state.daily_trade_count,
            win_streak=state.win_streak,
            loss_streak=state.loss_streak,
            metadata=metadata or {},
        )
        self._snapshots.append(snapshot)
        self._logger.info(
            "monitor snapshot",
            daily_pnl=snapshot.daily_pnl,
            open_positions=snapshot.open_positions,
            daily_trade_count=snapshot.daily_trade_count,
            win_streak=snapshot.win_streak,
            loss_streak=snapshot.loss_streak,
            metadata=snapshot.metadata,
        )
        return snapshot

    def alert(self, message: str, **context: str) -> None:
        """Emit an operational alert through the logger."""

        self._logger.warning("monitor alert", alert_message=message, **context)

    @property
    def snapshots(self) -> tuple[PerformanceSnapshot, ...]:
        """Return immutable monitoring history."""

        return tuple(self._snapshots)
