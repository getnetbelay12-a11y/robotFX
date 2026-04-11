"""MetaTrader 5 execution adapter placeholder.

Future Exness deployment on MT5 should be implemented here or in sibling MT5
configuration modules. The rest of the robot should continue depending only on
ExecutionClient and not on the MetaTrader5 Python package or MQL5 details.
"""

from decimal import Decimal

from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.types.enums import OrderStatus
from trading_robot.types.models import OrderRequest, OrderResult, Position


class MT5ExecutionClient(ExecutionClient):
    """Phase 1 placeholder for MetaTrader 5 order execution."""

    def connect(self) -> None:
        """Connect to MT5 terminal/account in a later phase."""

    def disconnect(self) -> None:
        """Disconnect from MT5 terminal/account in a later phase."""

    def open_trade(self, request: OrderRequest) -> OrderResult:
        """OpenTrade placeholder for MT5 native order execution."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="MT5 execution not implemented in Phase 1")

    def close_position(self, position: Position) -> OrderResult:
        """Close an MT5 position in a later phase."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="MT5 close not implemented in Phase 1")

    def partial_close_position(self, position: Position, volume: Decimal) -> OrderResult:
        """Partially close an MT5 position in a later phase."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="MT5 partial close not implemented in Phase 2")

    def modify_position(self, position: Position) -> OrderResult:
        """Modify MT5 stops/targets in a later phase."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="MT5 modify not implemented in Phase 1")
