"""Tests for execution router aliases."""

from decimal import Decimal
import unittest

from trading_robot.config import ProductionConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.execution.router import ExecutionRouter
from trading_robot.types import OrderRequest, OrderResult, OrderSide, OrderStatus, OrderType


class RecordingClient(ExecutionClient):
    """Minimal execution fake."""

    def __init__(self) -> None:
        self.requests: list[OrderRequest] = []

    def connect(self) -> None:
        pass

    def disconnect(self) -> None:
        pass

    def open_trade(self, request: OrderRequest) -> OrderResult:
        self.requests.append(request)
        return OrderResult(order_id="1", status=OrderStatus.FILLED)

    def close_position(self, position):
        return OrderResult(order_id="close", status=OrderStatus.FILLED)

    def partial_close_position(self, position, volume: Decimal) -> OrderResult:
        return OrderResult(order_id="partial", status=OrderStatus.FILLED)

    def modify_position(self, position):
        return OrderResult(order_id="modify", status=OrderStatus.FILLED)


class FlakyClient(RecordingClient):
    """Execution fake that fails once before succeeding."""

    def __init__(self) -> None:
        super().__init__()
        self.attempts = 0

    def open_trade(self, request: OrderRequest) -> OrderResult:
        self.attempts += 1
        if self.attempts == 1:
            raise RuntimeError("temporary disconnect")
        return super().open_trade(request)


class ExecutionRouterTests(unittest.TestCase):
    """Validates Phase 7 ExecuteTrade alias."""

    def test_execute_trade_routes_to_client(self) -> None:
        client = RecordingClient()
        router = ExecutionRouter(client, production_config=ProductionConfig(live_trading_enabled=True))
        request = OrderRequest(
            symbol="EURUSD",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            volume=Decimal("1"),
        )

        result = router.ExecuteTrade(request)

        self.assertEqual(result.status, OrderStatus.FILLED)
        self.assertEqual(client.requests, [request])

    def test_router_retries_after_transient_failure(self) -> None:
        client = FlakyClient()
        router = ExecutionRouter(
            client,
            production_config=ProductionConfig(
                live_trading_enabled=True,
                order_retries=2,
                retry_delay_seconds=Decimal("0"),
            ),
        )
        request = OrderRequest(
            symbol="EURUSD",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            volume=Decimal("1"),
        )

        result = router.execute_trade(request)

        self.assertEqual(result.status, OrderStatus.FILLED)
        self.assertEqual(client.attempts, 2)


if __name__ == "__main__":
    unittest.main()
