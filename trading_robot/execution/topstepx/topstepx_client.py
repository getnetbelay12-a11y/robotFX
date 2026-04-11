"""TopstepX execution adapter placeholder.

TopstepX/futures execution is intentionally separated from MT5. A future phase
can implement authentication, contract mapping, account rules, and REST/WebSocket
order routing here while the strategy continues using ExecutionClient.
"""

from decimal import Decimal

from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.types.enums import OrderStatus
from trading_robot.types.models import OrderRequest, OrderResult, Position


class TopstepXExecutionClient(ExecutionClient):
    """Phase 1 placeholder for future TopstepX/futures order execution."""

    def connect(self) -> None:
        """Connect to TopstepX in a later phase."""

    def disconnect(self) -> None:
        """Disconnect from TopstepX in a later phase."""

    def open_trade(self, request: OrderRequest) -> OrderResult:
        """OpenTrade placeholder for TopstepX/futures execution."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX execution not implemented in Phase 1")

    def close_position(self, position: Position) -> OrderResult:
        """Close a TopstepX/futures position in a later phase."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX close not implemented in Phase 1")

    def partial_close_position(self, position: Position, volume: Decimal) -> OrderResult:
        """Partially close a TopstepX/futures position in a later phase."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX partial close not implemented in Phase 2")

    def modify_position(self, position: Position) -> OrderResult:
        """Modify a TopstepX/futures position in a later phase."""

        return OrderResult(order_id=None, status=OrderStatus.REJECTED, message="TopstepX modify not implemented in Phase 1")
