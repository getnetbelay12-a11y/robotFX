"""Execution router.

The router is the single place where strategy/risk output turns into broker
orders. It prevents the strategy engine from depending on MT5, TopstepX, or any
future broker SDK directly.
"""

from __future__ import annotations

import time

from trading_robot.config.settings import ProductionConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.journal.logger import TradingLogger
from trading_robot.operations.alerts import AlertDispatcher
from trading_robot.state import RobotState, RobotStateStore
from trading_robot.types.enums import OrderStatus
from trading_robot.types.models import OrderRequest, OrderResult


class ExecutionRouter:
    """Routes broker-neutral order requests to the configured execution client."""

    def __init__(
        self,
        client: ExecutionClient,
        production_config: ProductionConfig | None = None,
        logger: TradingLogger | None = None,
        state_store: RobotStateStore | None = None,
        state: RobotState | None = None,
        alert_dispatcher: AlertDispatcher | None = None,
    ) -> None:
        self._client = client
        self._config = production_config or ProductionConfig()
        self._logger = logger or TradingLogger(log_file_path=self._config.log_file_path)
        self._state_store = state_store or RobotStateStore(self._config.state_file_path)
        self._state = state
        self._connected = False
        self._alert_dispatcher = alert_dispatcher

    def open_trade(self, request: OrderRequest) -> OrderResult:
        """OpenTrade placeholder used by the strategy engine."""

        if not self._config.live_trading_enabled:
            self._logger.warning("live execution blocked by production config", symbol=request.symbol)
            return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="live trading is disabled")

        last_result = OrderResult(order_id=None, status=OrderStatus.REJECTED, message="execution not attempted")
        for attempt in range(1, self._config.order_retries + 1):
            try:
                self._ensure_connection()
                self._logger.info(
                    "execution attempt",
                    symbol=request.symbol,
                    side=request.side,
                    volume=request.volume,
                    attempt=attempt,
                )
                result = self._client.open_trade(request)
                last_result = result
                if result.status in {OrderStatus.ACCEPTED, OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED}:
                    self._logger.info(
                        "execution succeeded",
                        symbol=request.symbol,
                        order_id=result.order_id,
                        status=result.status,
                    )
                    if self._alert_dispatcher is not None:
                        self._alert_dispatcher.notify_trade_opened(
                            symbol=request.symbol,
                            entry_price=request.price,
                            stop_loss=request.stop_loss,
                            take_profit=request.take_profit,
                        )
                    self._persist_state()
                    return result

                self._logger.warning(
                    "execution rejected",
                    symbol=request.symbol,
                    order_id=result.order_id,
                    status=result.status,
                    message=result.message,
                    attempt=attempt,
                )
            except Exception as exc:
                self._connected = False
                self._logger.exception(
                    "execution attempt failed",
                    symbol=request.symbol,
                    attempt=attempt,
                    error=str(exc),
                )
                if self._config.reconnect_on_failure:
                    self._reconnect()

            if attempt < self._config.order_retries:
                time.sleep(float(self._config.retry_delay_seconds))

        return last_result

    def execute_trade(self, request: OrderRequest) -> OrderResult:
        """ExecuteTrade alias for Phase 7 execution flow."""

        return self.open_trade(request=request)

    def OpenTrade(self, request: OrderRequest) -> OrderResult:
        """Compatibility placeholder using the requested Phase 1 method name."""

        return self.open_trade(request=request)

    def ExecuteTrade(self, request: OrderRequest) -> OrderResult:
        """Compatibility method using the requested PascalCase name."""

        return self.execute_trade(request=request)

    def _ensure_connection(self) -> None:
        if self._connected:
            return
        self._client.connect()
        self._connected = True
        self._logger.info("execution client connected")

    def _reconnect(self) -> None:
        try:
            self._client.disconnect()
        except Exception as exc:
            self._logger.exception("execution disconnect failed", error=str(exc))
        self._ensure_connection()

    def _persist_state(self) -> None:
        if self._state is None or not self._config.persist_state_on_decision:
            return
        self._state_store.save(self._state)
