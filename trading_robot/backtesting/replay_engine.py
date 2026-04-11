"""Strategy-accurate replay backtester.

Unlike the lightweight proxy backtester, this runner replays historical bars
through the real StrategyEngine, RiskManager, filters, and trade-management
logic. It is deterministic and broker-neutral, but still much closer to the
live decision path than the optimization proxy.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from trading_robot.backtesting.stats import BacktestStats, TradeRecord
from trading_robot.config.settings import ProductionConfig, SystemConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.execution.router import ExecutionRouter
from trading_robot.filters.news_filter import NewsFilter
from trading_robot.filters.permission_engine import PermissionEngine
from trading_robot.filters.prop_protection import PropProtection
from trading_robot.filters.session_filter import SessionFilter
from trading_robot.market_data.market_state_engine import MarketStateEngine
from trading_robot.operations.control import ControlCenter
from trading_robot.research.tuning_engine import ResearchTuningEngine
from trading_robot.risk.adaptation_engine import RiskAdaptationEngine
from trading_robot.risk.risk_manager import RiskManager
from trading_robot.scoring.setup_scorer import SetupScorer
from trading_robot.state.robot_state import RobotState
from trading_robot.strategy.strategy_engine import StrategyEngine
from trading_robot.trade_management.trade_manager import TradeManager
from trading_robot.types.enums import OrderSide, OrderStatus, PositionStatus, Timeframe
from trading_robot.types.models import AccountSnapshot, Bar, MarketSnapshot, OrderRequest, OrderResult, Position, SymbolSpec


@dataclass(frozen=True)
class StrategyReplayResult:
    """Result of one strategy-accurate replay run."""

    symbol: str
    stats: BacktestStats


class _BacktestExecutionClient(ExecutionClient):
    """Minimal in-memory execution adapter for deterministic replay."""

    def __init__(self) -> None:
        self._sequence = 0

    def connect(self) -> None:
        return None

    def disconnect(self) -> None:
        return None

    def open_trade(self, request: OrderRequest) -> OrderResult:
        self._sequence += 1
        return OrderResult(
            order_id=f"bt-order-{self._sequence}",
            status=OrderStatus.FILLED,
            filled_volume=request.volume,
            average_price=request.price,
        )

    def close_position(self, position: Position) -> OrderResult:
        self._sequence += 1
        return OrderResult(order_id=f"bt-close-{self._sequence}", status=OrderStatus.FILLED, filled_volume=position.volume)

    def partial_close_position(self, position: Position, volume: Decimal) -> OrderResult:
        self._sequence += 1
        return OrderResult(order_id=f"bt-partial-{self._sequence}", status=OrderStatus.FILLED, filled_volume=volume)

    def modify_position(self, position: Position) -> OrderResult:
        self._sequence += 1
        return OrderResult(order_id=f"bt-modify-{self._sequence}", status=OrderStatus.FILLED)


class StrategyReplayBacktestEngine:
    """Replay historical candles through the real live-decision stack."""

    def __init__(
        self,
        system_config: SystemConfig | None = None,
        tuning_path: str | Path | None = None,
    ) -> None:
        self._config = system_config or SystemConfig()
        self._tuning_engine = None
        if tuning_path is not None and Path(tuning_path).exists():
            self._tuning_engine = ResearchTuningEngine.from_json_file(tuning_path)

    def run_symbol(
        self,
        symbol: str,
        bars_by_timeframe: dict[Timeframe, list[Bar]],
        symbol_spec: SymbolSpec | None = None,
    ) -> StrategyReplayResult:
        """Replay one symbol using the real strategy/risk/filter stack."""

        if Timeframe.M5 not in bars_by_timeframe:
            raise ValueError("M5 bars are required for replay backtests")

        execution_client = _BacktestExecutionClient()
        state = RobotState()
        session_filter = SessionFilter(self._config.session)
        news_filter = NewsFilter(self._config.news)
        permission_engine = PermissionEngine(
            session_filter=session_filter,
            news_filter=news_filter,
            prop_protection=PropProtection(self._config.prop_protection),
        )
        risk_manager = RiskManager(self._config.risk)
        setup_scorer = SetupScorer(minimum_score=self._config.strategy.minimum_setup_score, tuning_engine=self._tuning_engine)
        execution_router = ExecutionRouter(
            execution_client,
            production_config=ProductionConfig(live_trading_enabled=True, persist_state_on_decision=False),
            state=state,
        )
        strategy = StrategyEngine(
            config=self._config.strategy,
            session_filter=session_filter,
            news_filter=news_filter,
            risk_manager=risk_manager,
            setup_scorer=setup_scorer,
            execution_router=execution_router,
            market_state_engine=MarketStateEngine(self._config.market_state),
            permission_engine=permission_engine,
            risk_adaptation_engine=RiskAdaptationEngine(self._config.risk_adaptation),
            research_tuning_engine=self._tuning_engine,
            control_center=ControlCenter(),
        )
        trade_manager = TradeManager(execution_client, self._config.trade_management)
        stats = BacktestStats(starting_equity=self._config.backtest.starting_equity)
        account_balance = self._config.backtest.starting_equity
        positions: dict[str, Position] = {}
        account_balance_ref = [account_balance]

        m5_bars = bars_by_timeframe[Timeframe.M5]
        h1_index = 0
        m15_index = 0
        h1_bars = bars_by_timeframe.get(Timeframe.H1, [])
        m15_bars = bars_by_timeframe.get(Timeframe.M15, [])
        default_spec = symbol_spec or self._default_symbol_spec(symbol)

        for m5_index, current_bar in enumerate(m5_bars):
            while h1_index + 1 < len(h1_bars) and h1_bars[h1_index + 1].timestamp <= current_bar.timestamp:
                h1_index += 1
            while m15_index + 1 < len(m15_bars) and m15_bars[m15_index + 1].timestamp <= current_bar.timestamp:
                m15_index += 1

            snapshot = MarketSnapshot(
                symbol=symbol,
                bars_by_timeframe={
                    Timeframe.M5: m5_bars[: m5_index + 1],
                    Timeframe.M15: m15_bars[: m15_index + 1],
                    Timeframe.H1: h1_bars[: h1_index + 1],
                },
                bid=current_bar.close,
                ask=current_bar.close,
                symbol_spec=default_spec,
            )

            account = AccountSnapshot(equity=account_balance_ref[0], balance=account_balance_ref[0])
            self._process_open_positions(
                symbol=symbol,
                timestamp=current_bar.timestamp,
                current_bar=current_bar,
                market=snapshot,
                positions=positions,
                state=state,
                stats=stats,
                account_balance_ref=account_balance_ref,
                trade_manager=trade_manager,
            )
            account = AccountSnapshot(equity=account_balance_ref[0], balance=account_balance_ref[0])

            if any(position.symbol == symbol and position.status == PositionStatus.OPEN for position in positions.values()):
                continue

            signal = strategy.evaluate(
                symbol=symbol,
                market=snapshot,
                account=account,
                state=state,
                timestamp=current_bar.timestamp,
            )
            order_result = signal.metadata.get("order_result")
            risk_decision = signal.metadata.get("risk_decision")
            if order_result is None or risk_decision is None:
                continue
            if getattr(order_result, "status", None) != OrderStatus.FILLED:
                continue

            position = Position(
                position_id=str(order_result.order_id),
                symbol=symbol,
                side=signal.side,
                volume=risk_decision.volume,
                entry_price=signal.entry_price or current_bar.close,
                stop_loss=signal.stop_loss,
                take_profit=signal.take_profit,
                opened_at=current_bar.timestamp,
                metadata={
                    **signal.metadata,
                    "initial_stop_loss": signal.stop_loss,
                    "initial_volume": risk_decision.volume,
                    "realized_pnl": Decimal("0"),
                    "risk_cash": self._risk_cash(signal.entry_price or current_bar.close, signal.stop_loss, risk_decision.volume, default_spec),
                    "entry_session": self._session_name(current_bar.timestamp.hour),
                    "entry_volatility": str(signal.metadata.get("market_state").volatility if signal.metadata.get("market_state") is not None else "unknown"),
                },
            )
            positions[position.position_id] = position
            state.register_position(position)

        for position in tuple(positions.values()):
            if position.status == PositionStatus.OPEN:
                self._close_position(
                    position=position,
                    exit_price=m5_bars[-1].close,
                    exit_time=m5_bars[-1].timestamp,
                    reason="end_of_data",
                    state=state,
                    stats=stats,
                    account_balance_ref=account_balance_ref,
                    symbol_spec=default_spec,
                )
        return StrategyReplayResult(symbol=symbol, stats=stats)

    def run(
        self,
        historical_data: dict[str, dict[Timeframe, list[Bar]]],
        symbol_specs: dict[str, SymbolSpec] | None = None,
    ) -> dict[str, StrategyReplayResult]:
        """Replay a set of symbols through the live decision stack."""

        symbol_specs = symbol_specs or {}
        return {
            symbol: self.run_symbol(symbol, bars_by_timeframe, symbol_specs.get(symbol))
            for symbol, bars_by_timeframe in historical_data.items()
        }

    def _process_open_positions(
        self,
        symbol: str,
        timestamp: datetime,
        current_bar: Bar,
        market: MarketSnapshot,
        positions: dict[str, Position],
        state: RobotState,
        stats: BacktestStats,
        account_balance_ref: list[Decimal],
        trade_manager: TradeManager,
    ) -> None:
        open_positions = [position for position in positions.values() if position.symbol == symbol and position.status == PositionStatus.OPEN]
        for position in open_positions:
            if self._stop_hit(position, current_bar):
                self._close_position(
                    position=position,
                    exit_price=position.stop_loss or current_bar.close,
                    exit_time=timestamp,
                    reason="stop_loss",
                    state=state,
                    stats=stats,
                    account_balance_ref=account_balance_ref,
                    symbol_spec=market.symbol_spec or self._default_symbol_spec(symbol),
                )
                continue

            if self._tp1_hit(position, current_bar):
                self._partial_take_profit(
                    position=position,
                    exit_price=position.take_profit or current_bar.close,
                    symbol_spec=market.symbol_spec or self._default_symbol_spec(symbol),
                )

            if position.status == PositionStatus.OPEN:
                trade_manager.manage_trade(position, market)

    def _partial_take_profit(self, position: Position, exit_price: Decimal, symbol_spec: SymbolSpec) -> None:
        if position.metadata.get("partial_closed_at_1r"):
            return
        close_volume = position.volume * Decimal("0.5")
        if close_volume <= 0:
            return
        pnl = self._pnl(position.side, position.entry_price, exit_price, close_volume, symbol_spec)
        position.metadata["realized_pnl"] = position.metadata.get("realized_pnl", Decimal("0")) + pnl
        position.metadata["partial_closed_at_1r"] = True
        position.metadata["moved_to_breakeven"] = True
        position.volume -= close_volume
        position.stop_loss = position.entry_price
        position.take_profit = None

    def _close_position(
        self,
        position: Position,
        exit_price: Decimal,
        exit_time: datetime,
        reason: str,
        state: RobotState,
        stats: BacktestStats,
        account_balance_ref: list[Decimal],
        symbol_spec: SymbolSpec,
    ) -> None:
        remaining_pnl = self._pnl(position.side, position.entry_price, exit_price, position.volume, symbol_spec)
        total_pnl = position.metadata.get("realized_pnl", Decimal("0")) + remaining_pnl
        risk_cash = position.metadata.get("risk_cash", Decimal("1")) or Decimal("1")
        r_result = total_pnl / risk_cash if risk_cash != 0 else Decimal("0")
        position.status = PositionStatus.CLOSED
        position.closed_at = exit_time
        position.volume = Decimal("0")
        account_balance_ref[0] += total_pnl
        state.apply_trade_outcome(
            pnl=total_pnl,
            max_loss_streak_before_cooldown=self._config.risk.max_loss_streak_before_cooldown,
            cooldown_minutes=self._config.risk.cooldown_minutes,
            timestamp=exit_time,
        )
        state.remove_position(position.position_id)
        stats.record_trade(
            total_pnl,
            TradeRecord(
                timestamp=position.opened_at or exit_time,
                symbol=position.symbol,
                strategy_type=str(position.metadata.get("strategy_type", "unknown")),
                entry=position.entry_price,
                exit=exit_price,
                stop_loss=position.initial_stop_loss or position.entry_price,
                take_profit=position.metadata.get("tp1", position.entry_price),
                r_result=r_result,
                pnl=total_pnl,
                session=position.metadata.get("entry_session", "unknown"),
                news_condition="clear",
                volatility=position.metadata.get("entry_volatility", "unknown"),
            ),
        )

    def _risk_cash(self, entry: Decimal, stop: Decimal | None, volume: Decimal, symbol_spec: SymbolSpec) -> Decimal:
        if stop is None or symbol_spec.tick_size <= 0 or symbol_spec.tick_value <= 0:
            return Decimal("1")
        return (abs(entry - stop) / symbol_spec.tick_size) * symbol_spec.tick_value * volume

    def _pnl(self, side: OrderSide, entry: Decimal, exit_price: Decimal, volume: Decimal, symbol_spec: SymbolSpec) -> Decimal:
        direction = Decimal("1") if side == OrderSide.BUY else Decimal("-1")
        price_move = (exit_price - entry) * direction
        if symbol_spec.tick_size <= 0:
            return price_move * volume
        return (price_move / symbol_spec.tick_size) * symbol_spec.tick_value * volume

    def _stop_hit(self, position: Position, bar: Bar) -> bool:
        if position.stop_loss is None:
            return False
        if position.side == OrderSide.BUY:
            return bar.low <= position.stop_loss
        return bar.high >= position.stop_loss

    def _tp1_hit(self, position: Position, bar: Bar) -> bool:
        if position.take_profit is None or position.metadata.get("partial_closed_at_1r"):
            return False
        if position.side == OrderSide.BUY:
            return bar.high >= position.take_profit
        return bar.low <= position.take_profit

    def _default_symbol_spec(self, symbol: str) -> SymbolSpec:
        normalized = symbol.upper()
        if normalized in {"EURUSD", "GBPUSD", "AUDUSD", "USDJPY"}:
            return SymbolSpec(symbol=symbol, tick_size=Decimal("0.0001"), tick_value=Decimal("10"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01"))
        if "XAU" in normalized:
            return SymbolSpec(symbol=symbol, tick_size=Decimal("0.01"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01"))
        if "BTC" in normalized:
            return SymbolSpec(symbol=symbol, tick_size=Decimal("0.01"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01"))
        return SymbolSpec(symbol=symbol, tick_size=Decimal("1"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01"))

    def _session_name(self, hour: int) -> str:
        if 7 <= hour < 16:
            return "london_open" if hour < 10 else "london"
        if 13 <= hour < 22:
            return "new_york_open" if hour < 16 else "new_york"
        return "off_session"


def aggregate_bars(symbol: str, timeframe: Timeframe, minute_bars: list[Bar]) -> list[Bar]:
    """Aggregate M1 bars into higher timeframes."""

    if timeframe == Timeframe.M1:
        return minute_bars
    step_minutes = {
        Timeframe.M5: 5,
        Timeframe.M15: 15,
        Timeframe.H1: 60,
    }.get(timeframe)
    if step_minutes is None:
        raise ValueError(f"unsupported timeframe aggregation: {timeframe}")

    buckets: list[list[Bar]] = []
    current_bucket: list[Bar] = []
    current_anchor = None
    for bar in minute_bars:
        anchor = bar.timestamp.replace(minute=(bar.timestamp.minute // step_minutes) * step_minutes, second=0, microsecond=0)
        if timeframe == Timeframe.H1:
            anchor = bar.timestamp.replace(minute=0, second=0, microsecond=0)
        if current_anchor != anchor:
            if current_bucket:
                buckets.append(current_bucket)
            current_bucket = [bar]
            current_anchor = anchor
        else:
            current_bucket.append(bar)
    if current_bucket:
        buckets.append(current_bucket)

    aggregated: list[Bar] = []
    for bucket in buckets:
        aggregated.append(
            Bar(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=bucket[0].timestamp.replace(
                    minute=(bucket[0].timestamp.minute // step_minutes) * step_minutes if timeframe != Timeframe.H1 else 0,
                    second=0,
                    microsecond=0,
                ),
                open=bucket[0].open,
                high=max(bar.high for bar in bucket),
                low=min(bar.low for bar in bucket),
                close=bucket[-1].close,
                volume=sum((bar.volume for bar in bucket), Decimal("0")),
            )
        )
    return aggregated
