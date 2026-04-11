"""UTC trading-session filter.

The filter is intentionally deterministic and API-free so it can run on every
tick in live trading and inside a backtest loop. Session definitions are kept in
UTC for Phase 4; later phases can replace these windows with exchange calendars.
"""

from datetime import datetime, time, timezone

from trading_robot.config.settings import SessionConfig
from trading_robot.types.enums import SessionQuality, SessionState
from trading_robot.types.models import SessionDecision


class SessionFilter:
    """Validates whether trading is allowed for the symbol at a given time."""

    def __init__(self, config: SessionConfig) -> None:
        self._config = config

    def is_trading_session(self, timestamp: datetime) -> bool:
        """IsTradingSession: return true during London or New York UTC hours."""

        return self.evaluate_session(timestamp=timestamp).session_valid

    def evaluate_session(self, timestamp: datetime) -> SessionDecision:
        """Return session validity and session quality."""

        if not self._config.enabled:
            return SessionDecision(
                session_valid=True,
                state=SessionState.OPEN,
                quality=SessionQuality.NORMAL,
                reason="session filter disabled",
            )

        utc_time = self._utc_time(timestamp)
        active_sessions: list[str] = []
        if self._within(utc_time, time(7, 0), time(16, 0)):
            active_sessions.append("london")
        if self._within(utc_time, time(13, 0), time(22, 0)):
            active_sessions.append("new_york")

        active_sessions = [name for name in active_sessions if name in self._config.allowed_sessions]
        if not active_sessions:
            return SessionDecision(
                session_valid=False,
                state=SessionState.CLOSED,
                quality=SessionQuality.LOW,
                reason="outside London and New York session windows",
            )

        quality = SessionQuality.NORMAL
        if self._within(utc_time, time(7, 0), time(10, 0)) or self._within(utc_time, time(13, 0), time(16, 0)):
            quality = SessionQuality.HIGH

        return SessionDecision(
            session_valid=True,
            state=SessionState.OPEN,
            quality=quality,
            active_session="+".join(active_sessions),
            reason="inside trading session",
        )

    def validate_session(self, symbol: str, timestamp: datetime) -> SessionState:
        """ValidateSession compatibility method returning enum state."""

        return self.evaluate_session(timestamp=timestamp).state

    def _utc_time(self, timestamp: datetime) -> time:
        """Normalize aware or naive datetimes to UTC time."""

        if timestamp.tzinfo is None:
            return timestamp.time()
        return timestamp.astimezone(timezone.utc).time()

    def _within(self, value: time, start: time, end: time) -> bool:
        """Return whether a UTC time is inside a same-day half-open interval."""

        return start <= value < end

    def IsTradingSession(self, timestamp: datetime) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.is_trading_session(timestamp=timestamp)

    def ValidateSession(self, symbol: str, timestamp: datetime) -> SessionState:
        """Compatibility method using the requested PascalCase name."""

        return self.validate_session(symbol=symbol, timestamp=timestamp)
