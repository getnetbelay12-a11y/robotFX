"""Broker execution interfaces.

Execution adapters must implement this interface and translate between native
broker APIs and the robot's broker-neutral OrderRequest/OrderResult models.
"""

from abc import ABC, abstractmethod
from decimal import Decimal

from trading_robot.types.models import OrderRequest, OrderResult, Position


class ExecutionClient(ABC):
    """Broker-neutral execution client contract."""

    @abstractmethod
    def connect(self) -> None:
        """Connect to the broker or simulation engine."""

    @abstractmethod
    def disconnect(self) -> None:
        """Disconnect from the broker or simulation engine."""

    @abstractmethod
    def open_trade(self, request: OrderRequest) -> OrderResult:
        """OpenTrade placeholder for market, limit, or stop orders."""

    @abstractmethod
    def close_position(self, position: Position) -> OrderResult:
        """Close a full position."""

    @abstractmethod
    def partial_close_position(self, position: Position, volume: Decimal) -> OrderResult:
        """Close part of a position."""

    @abstractmethod
    def modify_position(self, position: Position) -> OrderResult:
        """Modify stop-loss, take-profit, or other supported attributes."""
