"""Trade manager.

The trade manager owns post-entry behavior such as partial exits, breakeven
moves, and trailing stops. This keeps active trade management separate from
entry logic and broker execution plumbing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_FLOOR

from trading_robot.config.settings import TradeManagementConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.types.enums import OrderSide, OrderStatus
from trading_robot.types.models import MarketSnapshot, OrderResult, Position, SymbolSpec


@dataclass(frozen=True)
class TradeManagementAction:
    """One broker-neutral trade-management action attempted by the manager."""

    action: str
    result: OrderResult | None = None
    reason: str = ""


@dataclass(frozen=True)
class TradeManagementDecision:
    """Collection of management actions for one position evaluation."""

    position_id: str
    actions: tuple[TradeManagementAction, ...] = field(default_factory=tuple)


class TradeManager:
    """Manages lifecycle actions for open positions."""

    def __init__(
        self,
        execution_client: ExecutionClient,
        config: TradeManagementConfig | None = None,
    ) -> None:
        self._execution_client = execution_client
        self._config = config or TradeManagementConfig()

    def manage_trade(self, position: Position, market: MarketSnapshot) -> TradeManagementDecision:
        """Run partial close, breakeven, and trailing-stop management.

        The method is deterministic and depends only on position state, market
        snapshot, and config, making it suitable for live execution and backtest
        adapters that implement the same ExecutionClient interface.
        """

        actions: list[TradeManagementAction] = []
        if self._is_at_r(position=position, market=market, r_multiple=self._config.partial_close_at_r):
            actions.append(self.partial_close_at_1r(position=position, market=market))

        if self._is_at_r(position=position, market=market, r_multiple=self._config.breakeven_at_r):
            actions.append(self.move_to_breakeven(position=position, market=market))

        actions.append(self.trail_stop(position=position, market=market))
        return TradeManagementDecision(position_id=position.position_id, actions=tuple(actions))

    def partial_close_at_1r(self, position: Position, market: MarketSnapshot) -> TradeManagementAction:
        """PartialClose at configured 1R threshold."""

        if not self._config.partial_close_enabled:
            return TradeManagementAction(action="partial_close", reason="partial close disabled")
        if position.metadata.get("partial_closed_at_1r"):
            return TradeManagementAction(action="partial_close", reason="partial close already applied")

        symbol_spec = market.symbol_spec or SymbolSpec(symbol=position.symbol)
        volume = self._round_volume_down(
            volume=position.volume * self._config.partial_close_fraction,
            symbol_spec=symbol_spec,
        )
        if volume <= 0:
            return TradeManagementAction(action="partial_close", reason="partial close volume below minimum")
        if volume >= position.volume:
            volume = self._round_volume_down(volume=position.volume - symbol_spec.min_volume, symbol_spec=symbol_spec)
        if volume <= 0:
            return TradeManagementAction(action="partial_close", reason="partial close would fully close position")

        result = self.partial_close(position=position, volume=volume)
        if result.status in {OrderStatus.ACCEPTED, OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED}:
            position.metadata["partial_closed_at_1r"] = True
        return TradeManagementAction(action="partial_close", result=result)

    def partial_close(self, position: Position, volume: Decimal) -> OrderResult:
        """PartialClose through the broker-neutral execution interface."""

        return self._execution_client.partial_close_position(position=position, volume=volume)

    def move_to_breakeven(self, position: Position, market: MarketSnapshot) -> TradeManagementAction:
        """MoveToBreakeven at configured 1R threshold."""

        if not self._config.breakeven_enabled:
            return TradeManagementAction(action="move_to_breakeven", reason="breakeven disabled")
        if position.metadata.get("moved_to_breakeven"):
            return TradeManagementAction(action="move_to_breakeven", reason="breakeven already applied")

        breakeven_stop = self._breakeven_stop(position=position, market=market)
        if breakeven_stop is None or not self._is_stop_improvement(position=position, new_stop=breakeven_stop):
            return TradeManagementAction(action="move_to_breakeven", reason="breakeven stop is not an improvement")

        position.stop_loss = breakeven_stop
        result = self._execution_client.modify_position(position)
        if result.status in {OrderStatus.ACCEPTED, OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED}:
            position.metadata["moved_to_breakeven"] = True
        return TradeManagementAction(action="move_to_breakeven", result=result)

    def trail_stop(self, position: Position, market: MarketSnapshot) -> TradeManagementAction:
        """TrailStop using symbol-specific R-multiple presets."""

        if not self._config.trailing_enabled:
            return TradeManagementAction(action="trail_stop", reason="trailing disabled")

        preset = self._config.get_trailing_preset(position.symbol)
        if not self._is_at_r(position=position, market=market, r_multiple=preset.activation_r):
            return TradeManagementAction(action="trail_stop", reason="trailing activation not reached")

        current_price = self._current_exit_price(position=position, market=market)
        initial_risk = self._initial_risk(position)
        if current_price is None or initial_risk is None:
            return TradeManagementAction(action="trail_stop", reason="missing price or initial risk")

        if position.side == OrderSide.BUY:
            proposed_stop = current_price - (initial_risk * preset.trail_distance_r)
        else:
            proposed_stop = current_price + (initial_risk * preset.trail_distance_r)

        proposed_stop = self._round_price(proposed_stop, market.symbol_spec)
        if not self._is_stop_improvement(position=position, new_stop=proposed_stop):
            return TradeManagementAction(action="trail_stop", reason="trailing stop is not an improvement")
        if not self._meets_trailing_step(position=position, proposed_stop=proposed_stop, step_r=preset.step_r):
            return TradeManagementAction(action="trail_stop", reason="trailing step not reached")

        position.stop_loss = proposed_stop
        result = self._execution_client.modify_position(position)
        return TradeManagementAction(action="trail_stop", result=result)

    def _current_exit_price(self, position: Position, market: MarketSnapshot) -> Decimal | None:
        """Use bid for long exits and ask for short exits, falling back to close."""

        if position.side == OrderSide.BUY and market.bid is not None:
            return market.bid
        if position.side == OrderSide.SELL and market.ask is not None:
            return market.ask
        bars = next(iter(market.bars_by_timeframe.values()), [])
        return bars[-1].close if bars else None

    def _initial_risk(self, position: Position) -> Decimal | None:
        """Return the original 1R price distance."""

        initial_stop = position.initial_stop_loss
        if initial_stop is None:
            return None
        risk = abs(position.entry_price - initial_stop)
        return risk if risk > 0 else None

    def _is_at_r(self, position: Position, market: MarketSnapshot, r_multiple: Decimal) -> bool:
        """Check whether price has reached the requested R multiple."""

        current_price = self._current_exit_price(position=position, market=market)
        initial_risk = self._initial_risk(position)
        if current_price is None or initial_risk is None:
            return False
        if position.side == OrderSide.BUY:
            return current_price >= position.entry_price + (initial_risk * r_multiple)
        return current_price <= position.entry_price - (initial_risk * r_multiple)

    def _breakeven_stop(self, position: Position, market: MarketSnapshot) -> Decimal | None:
        """Calculate breakeven stop with optional symbol tick offset."""

        symbol_spec = market.symbol_spec or SymbolSpec(symbol=position.symbol)
        offset = self._config.breakeven_offset_points * symbol_spec.tick_size
        if position.side == OrderSide.BUY:
            return self._round_price(position.entry_price + offset, symbol_spec)
        return self._round_price(position.entry_price - offset, symbol_spec)

    def _is_stop_improvement(self, position: Position, new_stop: Decimal) -> bool:
        """Only move stops in the profitable direction."""

        if position.stop_loss is None:
            return True
        if position.side == OrderSide.BUY:
            return new_stop > position.stop_loss
        return new_stop < position.stop_loss

    def _meets_trailing_step(self, position: Position, proposed_stop: Decimal, step_r: Decimal) -> bool:
        """Avoid excessive stop updates until configured step distance is met."""

        initial_risk = self._initial_risk(position)
        if position.stop_loss is None or initial_risk is None:
            return True
        required_step = initial_risk * step_r
        if position.side == OrderSide.BUY:
            return proposed_stop - position.stop_loss >= required_step
        return position.stop_loss - proposed_stop >= required_step

    def _round_volume_down(self, volume: Decimal, symbol_spec: SymbolSpec) -> Decimal:
        """Round volume down to symbol volume step."""

        if symbol_spec.volume_step <= 0:
            return Decimal("0")
        return (volume / symbol_spec.volume_step).to_integral_value(rounding=ROUND_FLOOR) * symbol_spec.volume_step

    def _round_price(self, price: Decimal, symbol_spec: SymbolSpec | None) -> Decimal:
        """Round price to the nearest symbol tick when metadata is available."""

        if symbol_spec is None or symbol_spec.tick_size <= 0:
            return price
        ticks = (price / symbol_spec.tick_size).to_integral_value(rounding=ROUND_FLOOR)
        return ticks * symbol_spec.tick_size

    def ManageTrade(self, position: Position, market: MarketSnapshot) -> TradeManagementDecision:
        """Compatibility method using the requested PascalCase name."""

        return self.manage_trade(position=position, market=market)

    def PartialClose(self, position: Position, volume: Decimal) -> OrderResult:
        """Compatibility method using the requested PascalCase name."""

        return self.partial_close(position=position, volume=volume)

    def MoveToBreakeven(self, position: Position, market: MarketSnapshot) -> TradeManagementAction:
        """Compatibility method using the requested PascalCase name."""

        return self.move_to_breakeven(position=position, market=market)

    def TrailStop(self, position: Position, market: MarketSnapshot) -> TradeManagementAction:
        """Compatibility method using the requested PascalCase name."""

        return self.trail_stop(position=position, market=market)
