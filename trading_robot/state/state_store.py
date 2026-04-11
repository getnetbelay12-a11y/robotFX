"""Persistent runtime state storage for live deployment and restart recovery."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from trading_robot.state.robot_state import RobotState
from trading_robot.types.enums import CooldownState, NewsLockState, OrderSide, PositionStatus, Regime, SessionState
from trading_robot.types.models import Position


class RobotStateStore:
    """Serialize and restore RobotState to a local JSON file."""

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)

    def load(self) -> RobotState:
        """Return the restored state or a clean default when no file exists."""

        if not self._path.exists():
            return RobotState()
        data = json.loads(self._path.read_text(encoding="utf-8"))
        return RobotState(
            current_symbol=data.get("current_symbol"),
            current_regime=Regime(data.get("current_regime", Regime.UNKNOWN.value)),
            daily_pnl=Decimal(data.get("daily_pnl", "0")),
            open_positions={
                position_id: self._deserialize_position(position_data)
                for position_id, position_data in data.get("open_positions", {}).items()
            },
            daily_trade_count=int(data.get("daily_trade_count", 0)),
            trading_day=self._deserialize_date(data.get("trading_day")),
            loss_streak=int(data.get("loss_streak", 0)),
            win_streak=int(data.get("win_streak", 0)),
            cooldown_state=CooldownState(data.get("cooldown_state", CooldownState.NONE.value)),
            cooldown_until=self._deserialize_datetime(data.get("cooldown_until")),
            session_state=SessionState(data.get("session_state", SessionState.UNKNOWN.value)),
            news_lock_state=NewsLockState(data.get("news_lock_state", NewsLockState.UNKNOWN.value)),
            last_updated_at=self._deserialize_datetime(data.get("last_updated_at")),
        )

    def save(self, state: RobotState) -> None:
        """Persist the current runtime state."""

        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = asdict(state)
        payload["current_regime"] = state.current_regime.value
        payload["daily_pnl"] = str(state.daily_pnl)
        payload["open_positions"] = {
            position_id: self._serialize_position(position)
            for position_id, position in state.open_positions.items()
        }
        payload["trading_day"] = state.trading_day.isoformat() if state.trading_day is not None else None
        payload["cooldown_state"] = state.cooldown_state.value
        payload["cooldown_until"] = self._serialize_datetime(state.cooldown_until)
        payload["session_state"] = state.session_state.value
        payload["news_lock_state"] = state.news_lock_state.value
        payload["last_updated_at"] = self._serialize_datetime(state.last_updated_at)
        self._path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    def _serialize_position(self, position: Position) -> dict[str, Any]:
        return {
            "position_id": position.position_id,
            "symbol": position.symbol,
            "side": position.side.value,
            "volume": str(position.volume),
            "entry_price": str(position.entry_price),
            "stop_loss": str(position.stop_loss) if position.stop_loss is not None else None,
            "take_profit": str(position.take_profit) if position.take_profit is not None else None,
            "status": position.status.value,
            "opened_at": self._serialize_datetime(position.opened_at),
            "closed_at": self._serialize_datetime(position.closed_at),
            "metadata": self._serialize_mapping(position.metadata),
        }

    def _deserialize_position(self, data: dict[str, Any]) -> Position:
        return Position(
            position_id=str(data["position_id"]),
            symbol=str(data["symbol"]),
            side=OrderSide(data["side"]),
            volume=Decimal(str(data["volume"])),
            entry_price=Decimal(str(data["entry_price"])),
            stop_loss=Decimal(str(data["stop_loss"])) if data.get("stop_loss") is not None else None,
            take_profit=Decimal(str(data["take_profit"])) if data.get("take_profit") is not None else None,
            status=PositionStatus(data.get("status", PositionStatus.OPEN.value)),
            opened_at=self._deserialize_datetime(data.get("opened_at")),
            closed_at=self._deserialize_datetime(data.get("closed_at")),
            metadata=self._deserialize_mapping(data.get("metadata", {})),
        )

    def _serialize_mapping(self, mapping: dict[str, Any]) -> dict[str, Any]:
        serialized: dict[str, Any] = {}
        for key, value in mapping.items():
            if isinstance(value, Decimal):
                serialized[key] = {"__decimal__": str(value)}
            elif isinstance(value, datetime):
                serialized[key] = {"__datetime__": value.isoformat()}
            elif isinstance(value, date):
                serialized[key] = {"__date__": value.isoformat()}
            else:
                serialized[key] = value
        return serialized

    def _deserialize_mapping(self, mapping: dict[str, Any]) -> dict[str, Any]:
        deserialized: dict[str, Any] = {}
        for key, value in mapping.items():
            if isinstance(value, dict) and "__decimal__" in value:
                deserialized[key] = Decimal(value["__decimal__"])
            elif isinstance(value, dict) and "__datetime__" in value:
                deserialized[key] = datetime.fromisoformat(value["__datetime__"])
            elif isinstance(value, dict) and "__date__" in value:
                deserialized[key] = date.fromisoformat(value["__date__"])
            else:
                deserialized[key] = value
        return deserialized

    def _serialize_datetime(self, value: datetime | None) -> str | None:
        return value.isoformat() if value is not None else None

    def _deserialize_datetime(self, value: str | None) -> datetime | None:
        return datetime.fromisoformat(value) if value else None

    def _deserialize_date(self, value: str | None) -> date | None:
        return date.fromisoformat(value) if value else None
