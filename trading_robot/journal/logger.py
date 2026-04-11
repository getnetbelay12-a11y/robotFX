"""Journal and logging module.

The logger is production-oriented: it can write structured file logs for VPS
deployment while remaining lightweight enough for backtests and tests.
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any


class TradingLogger:
    """Structured logging facade for the robot."""

    def __init__(self, name: str = "trading_robot", log_file_path: str | None = None, level: int = logging.INFO) -> None:
        self._logger = logging.getLogger(name)
        if not self._logger.handlers:
            self._logger.setLevel(level)
            if log_file_path is not None:
                path = Path(log_file_path)
                path.parent.mkdir(parents=True, exist_ok=True)
                handler = RotatingFileHandler(path, maxBytes=2_000_000, backupCount=5, encoding="utf-8")
                handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
                self._logger.addHandler(handler)
            else:
                self._logger.addHandler(logging.NullHandler())
            self._logger.propagate = False

    def info(self, message: str, **context: Any) -> None:
        """Write an informational event with optional structured context."""

        self._logger.info("%s %s", message, context)

    def warning(self, message: str, **context: Any) -> None:
        """Write a warning event with optional structured context."""

        self._logger.warning("%s %s", message, context)

    def error(self, message: str, **context: Any) -> None:
        """Write an error event with optional structured context."""

        self._logger.error("%s %s", message, context)

    def exception(self, message: str, **context: Any) -> None:
        """Write an exception event with traceback and structured context."""

        self._logger.exception("%s %s", message, context)
