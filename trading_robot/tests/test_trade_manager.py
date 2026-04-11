"""Tests for post-entry trade management."""

from decimal import Decimal
import unittest

from trading_robot.config import TradeManagementConfig, TrailingStopPreset
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.trade_management import TradeManager
from trading_robot.types import (
    MarketSnapshot,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderStatus,
    Position,
    SymbolSpec,
)


class RecordingExecutionClient(ExecutionClient):
    """Execution fake that records broker-neutral management requests."""

    def __init__(self) -> None:
        self.partial_closes: list[Decimal] = []
        self.modified_stops: list[Decimal | None] = []

    def connect(self) -> None:
        pass

    def disconnect(self) -> None:
        pass

    def open_trade(self, request: OrderRequest) -> OrderResult:
        return OrderResult(order_id="open", status=OrderStatus.FILLED)

    def close_position(self, position: Position) -> OrderResult:
        return OrderResult(order_id="close", status=OrderStatus.FILLED)

    def partial_close_position(self, position: Position, volume: Decimal) -> OrderResult:
        self.partial_closes.append(volume)
        return OrderResult(order_id="partial", status=OrderStatus.FILLED, filled_volume=volume)

    def modify_position(self, position: Position) -> OrderResult:
        self.modified_stops.append(position.stop_loss)
        return OrderResult(order_id="modify", status=OrderStatus.FILLED)


class TradeManagerTests(unittest.TestCase):
    """Validates 1R partials, breakeven moves, and trailing framework."""

    def test_manage_trade_partials_and_moves_to_breakeven_at_1r(self) -> None:
        client = RecordingExecutionClient()
        manager = TradeManager(execution_client=client, config=TradeManagementConfig(trailing_enabled=False))
        position = Position(
            position_id="p1",
            symbol="TEST",
            side=OrderSide.BUY,
            volume=Decimal("1.00"),
            entry_price=Decimal("100"),
            stop_loss=Decimal("99"),
            metadata={"initial_stop_loss": Decimal("99")},
        )
        market = MarketSnapshot(
            symbol="TEST",
            bars_by_timeframe={},
            bid=Decimal("101"),
            ask=Decimal("101.01"),
            symbol_spec=SymbolSpec(symbol="TEST", tick_size=Decimal("0.01"), volume_step=Decimal("0.01")),
        )

        decision = manager.manage_trade(position=position, market=market)

        self.assertEqual(client.partial_closes, [Decimal("0.50")])
        self.assertEqual(position.stop_loss, Decimal("100.00"))
        self.assertIn("partial_close", [action.action for action in decision.actions])
        self.assertTrue(position.metadata["partial_closed_at_1r"])
        self.assertTrue(position.metadata["moved_to_breakeven"])

    def test_trailing_stop_uses_symbol_specific_preset(self) -> None:
        client = RecordingExecutionClient()
        config = TradeManagementConfig(
            partial_close_enabled=False,
            breakeven_enabled=False,
            trailing_presets={
                "TEST": TrailingStopPreset(
                    symbol="TEST",
                    activation_r=Decimal("2"),
                    trail_distance_r=Decimal("1"),
                    step_r=Decimal("0.25"),
                )
            },
        )
        manager = TradeManager(execution_client=client, config=config)
        position = Position(
            position_id="p1",
            symbol="TEST",
            side=OrderSide.BUY,
            volume=Decimal("1"),
            entry_price=Decimal("100"),
            stop_loss=Decimal("100"),
            metadata={"initial_stop_loss": Decimal("99")},
        )
        market = MarketSnapshot(
            symbol="TEST",
            bars_by_timeframe={},
            bid=Decimal("102.50"),
            ask=Decimal("102.51"),
            symbol_spec=SymbolSpec(symbol="TEST", tick_size=Decimal("0.01"), volume_step=Decimal("0.01")),
        )

        action = manager.trail_stop(position=position, market=market)

        self.assertEqual(action.action, "trail_stop")
        self.assertEqual(position.stop_loss, Decimal("101.50"))
        self.assertEqual(client.modified_stops, [Decimal("101.50")])


if __name__ == "__main__":
    unittest.main()

