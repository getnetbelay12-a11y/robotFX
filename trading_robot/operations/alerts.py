"""Non-blocking alerts and Telegram integration."""

from __future__ import annotations

import json
import queue
import threading
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from trading_robot.journal.logger import TradingLogger
from trading_robot.operations.control import OperationsLogStore


@dataclass(frozen=True)
class AlertEvent:
    """One outbound alert event."""

    event_type: str
    message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = field(default_factory=dict)


class TelegramBotClient:
    """Minimal Telegram Bot API sender."""

    def __init__(
        self,
        bot_token: str | None,
        chat_id: str | None,
        transport: Callable[[str, bytes], None] | None = None,
    ) -> None:
        self._bot_token = bot_token
        self._chat_id = chat_id
        self._transport = transport or self._default_transport

    def send_message(self, message: str) -> bool:
        """Send one message; return False when config is missing or transport fails."""

        if not self._bot_token or not self._chat_id:
            return False
        url = f"https://api.telegram.org/bot{self._bot_token}/sendMessage"
        payload = urllib.parse.urlencode({"chat_id": self._chat_id, "text": message}).encode("utf-8")
        try:
            self._transport(url, payload)
            return True
        except (OSError, urllib.error.URLError):
            return False

    def _default_transport(self, url: str, payload: bytes) -> None:
        request = urllib.request.Request(url, data=payload, method="POST")
        request.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(request, timeout=5) as response:
            json.loads(response.read().decode("utf-8"))


class AlertDispatcher:
    """Background alert dispatcher with optional Telegram delivery."""

    def __init__(
        self,
        logger: TradingLogger | None = None,
        telegram_client: TelegramBotClient | None = None,
        log_store: OperationsLogStore | None = None,
    ) -> None:
        self._logger = logger or TradingLogger()
        self._telegram = telegram_client
        self._log_store = log_store
        self._queue: queue.Queue[AlertEvent | None] = queue.Queue()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def dispatch(self, event_type: str, message: str, **metadata: Any) -> None:
        """Enqueue an alert without blocking the caller."""

        self._queue.put(AlertEvent(event_type=event_type, message=message, metadata=metadata))

    def notify_trade_opened(self, symbol: str, entry_price, stop_loss, take_profit) -> None:
        self.dispatch(
            "trade_opened",
            f"Trade opened: {symbol} entry={entry_price} SL={stop_loss} TP={take_profit}",
            symbol=symbol,
        )

    def notify_trade_closed(self, symbol: str, pnl, reason: str) -> None:
        self.dispatch("trade_closed", f"Trade closed: {symbol} pnl={pnl} reason={reason}", symbol=symbol, pnl=pnl, reason=reason)

    def notify_sl_tp_hit(self, symbol: str, reason: str) -> None:
        self.dispatch("sl_tp_hit", f"{symbol} {reason}", symbol=symbol, reason=reason)

    def notify_daily_loss_reached(self, amount) -> None:
        self.dispatch("daily_loss_reached", f"Daily loss reached: {amount}", amount=amount)

    def notify_system_stopped(self, reason: str) -> None:
        self.dispatch("system_stopped", f"System stopped: {reason}", reason=reason)

    def flush(self, timeout: float = 1.0) -> None:
        """Wait until the current queue is empty. Useful in tests."""

        self._queue.join()

    def stop(self) -> None:
        """Stop the worker thread."""

        self._queue.put(None)
        self._thread.join(timeout=1.0)

    def _worker(self) -> None:
        while True:
            event = self._queue.get()
            if event is None:
                self._queue.task_done()
                break
            try:
                self._logger.info("alert dispatched", event_type=event.event_type, alert_message=event.message, **event.metadata)
                sent = self._telegram.send_message(event.message) if self._telegram is not None else False
                if self._log_store is not None:
                    self._log_store.record(
                        "alert_sent",
                        {
                            "event_type": event.event_type,
                            "alert_message": event.message,
                            "sent": sent,
                            **event.metadata,
                        },
                    )
            finally:
                self._queue.task_done()
