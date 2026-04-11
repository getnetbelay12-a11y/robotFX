"""Tests for Phase 13 monitoring, alerts, and remote control."""

from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest

from trading_robot.backtesting import TradeRecord
from trading_robot.config import NewsFilterConfig, ProductionConfig, RiskConfig, SessionConfig, StrategyConfig
from trading_robot.execution.interfaces import ExecutionClient
from trading_robot.execution.router import ExecutionRouter
from trading_robot.filters.news_filter import NewsFilter
from trading_robot.filters.session_filter import SessionFilter
from trading_robot.operations import (
    AlertDispatcher,
    ControlCenter,
    DashboardService,
    OperationsLogStore,
    ProductionValidationSuite,
    TelegramBotClient,
)
from trading_robot.risk import RiskManager
from trading_robot.scoring import SetupScorer
from trading_robot.state import RobotState
from trading_robot.strategy import StrategyEngine
from trading_robot.types import (
    AccountSnapshot,
    Bar,
    EntryReadiness,
    MarketSnapshot,
    MarketState,
    MarketStateDecision,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderStatus,
    Position,
    Regime,
    SessionQuality,
    SignalDecision,
    StructureState,
    SymbolSpec,
    Timeframe,
    TradePermission,
    VolatilityState,
)


class RecordingExecutionClient(ExecutionClient):
    def connect(self) -> None:
        pass

    def disconnect(self) -> None:
        pass

    def open_trade(self, request: OrderRequest) -> OrderResult:
        return OrderResult(order_id="order-1", status=OrderStatus.FILLED, filled_volume=request.volume)

    def close_position(self, position):
        return OrderResult(order_id="close", status=OrderStatus.FILLED)

    def partial_close_position(self, position, volume: Decimal) -> OrderResult:
        return OrderResult(order_id="partial", status=OrderStatus.FILLED, filled_volume=volume)

    def modify_position(self, position):
        return OrderResult(order_id="modify", status=OrderStatus.FILLED)


class StaticMarketStateEngine:
    def __init__(self, symbol: str) -> None:
        self.market_state = MarketState(
            symbol=symbol,
            regime=Regime.BULLISH,
            structure=StructureState.TRENDING_UP,
            volatility=VolatilityState.HIGH,
            entry_ready=EntryReadiness.READY,
            trade_allowed=MarketStateDecision.TRADE_ALLOWED,
            metadata={"cache_key": symbol},
        )

    def get_market_state(self, market: MarketSnapshot) -> MarketState:
        return self.market_state

    def detect_trend(self, market: MarketSnapshot):
        return self.market_state.regime

    def detect_structure(self, market: MarketSnapshot):
        return self.market_state.structure

    def detect_entry_condition(self, market: MarketSnapshot):
        return self.market_state.entry_ready

    def detect_volatility(self, market: MarketSnapshot):
        return self.market_state.volatility


class AllowPermissionEngine:
    def can_trade(self, **kwargs):
        return TradePermission(
            session_valid=True,
            news_blocked=False,
            cooldown_active=False,
            prop_safe=True,
            can_trade=True,
            session_quality=SessionQuality.HIGH,
        )


def _bar(index: int, close: str) -> Bar:
    return Bar(
        symbol="XAUUSD",
        timeframe=Timeframe.M5,
        timestamp=datetime(2026, 4, 10, 14, 0) + timedelta(minutes=index * 5),
        open=Decimal(close) - Decimal("0.5"),
        high=Decimal(close) + Decimal("0.5"),
        low=Decimal(close) - Decimal("0.5"),
        close=Decimal(close),
        volume=Decimal("100"),
    )


class OperationsTests(unittest.TestCase):
    def test_production_validation_suite_runs_readiness_and_replay(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "runtime" / "data" / "XAUUSD"
            data_dir.mkdir(parents=True, exist_ok=True)
            csv_path = data_dir / "sample_2024.csv"
            rows = ["timestamp,open,high,low,close,volume"]
            start = datetime(2024, 1, 1, 7, 0)
            for index in range(60 * 24 * 3):
                ts = start + timedelta(minutes=index)
                close = Decimal("2300") + Decimal(index % 20) * Decimal("0.1")
                rows.append(
                    f"{ts.isoformat()},{close - Decimal('0.2')},{close + Decimal('0.3')},{close - Decimal('0.3')},{close},1"
                )
            csv_path.write_text("\n".join(rows), encoding="utf-8")

            suite = ProductionValidationSuite()
            report = suite.run(
                symbols=("XAUUSD",),
                data_root=Path(tmp) / "runtime" / "data",
                tuning_paths=(),
                replay_start=datetime(2024, 1, 1),
                replay_end=datetime(2024, 1, 3, 23, 59),
                replay_output_dir=Path(tmp) / "runtime" / "production",
            )

            self.assertFalse(report.ready_for_terminal_validation)
            self.assertEqual(report.replay_results[0].symbol, "XAUUSD")
            self.assertEqual(report.replay_results[0].status, "ok")
            self.assertGreater(report.replay_results[0].records_loaded, 0)

    def test_dashboard_snapshot_includes_positions_and_ratio(self) -> None:
        service = DashboardService()
        state = RobotState(daily_pnl=Decimal("125"))
        state.open_positions["1"] = Position(
            position_id="1",
            symbol="XAUUSD",
            side=OrderSide.BUY,
            volume=Decimal("1"),
            entry_price=Decimal("2300"),
            stop_loss=Decimal("2295"),
            take_profit=Decimal("2310"),
        )
        snapshot = service.build_snapshot(
            account=AccountSnapshot(equity=Decimal("10125"), balance=Decimal("10000")),
            state=state,
            trades=(
                TradeRecord(datetime(2026, 4, 10, 7, 0), "XAUUSD", "sweep", Decimal("1"), Decimal("2"), Decimal("0"), Decimal("0"), Decimal("2"), Decimal("100")),
                TradeRecord(datetime(2026, 4, 10, 8, 0), "XAUUSD", "sweep", Decimal("1"), Decimal("2"), Decimal("0"), Decimal("0"), Decimal("-1"), Decimal("-50")),
            ),
            prices_by_symbol={"XAUUSD": Decimal("2303")},
        )

        self.assertEqual(snapshot.account_balance, Decimal("10000"))
        self.assertEqual(snapshot.total_trades, 2)
        self.assertEqual(snapshot.win_loss_ratio, Decimal("1"))
        self.assertEqual(snapshot.open_positions[0].current_profit, Decimal("3"))

    def test_control_center_processes_commands_and_logs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = OperationsLogStore(Path(tmp) / "operations.jsonl")
            control = ControlCenter(log_store=store)

            pause = control.ProcessCommand("/pause")
            risk = control.ProcessCommand("/risk 0.5")
            disable = control.ProcessCommand("/disable XAUUSD")
            status = control.ProcessCommand("/status")

            self.assertTrue(pause.success)
            self.assertEqual(risk.payload["risk_override_pct"], Decimal("0.005"))
            self.assertTrue("XAUUSD" in control.state.disabled_symbols)
            self.assertTrue(status.success)
            content = (Path(tmp) / "operations.jsonl").read_text(encoding="utf-8")
            self.assertIn("command_received", content)

    def test_alert_dispatcher_sends_telegram_and_logs(self) -> None:
        sent_messages: list[str] = []

        def transport(url: str, payload: bytes) -> None:
            sent_messages.append(payload.decode("utf-8"))

        with tempfile.TemporaryDirectory() as tmp:
            dispatcher = AlertDispatcher(
                telegram_client=TelegramBotClient("token", "chat", transport=transport),
                log_store=OperationsLogStore(Path(tmp) / "operations.jsonl"),
            )
            dispatcher.notify_trade_opened("XAUUSD", Decimal("2300"), Decimal("2295"), Decimal("2310"))
            dispatcher.flush()
            dispatcher.stop()

            self.assertEqual(len(sent_messages), 1)
            self.assertIn("Trade+opened", sent_messages[0])
            content = (Path(tmp) / "operations.jsonl").read_text(encoding="utf-8")
            self.assertIn("alert_sent", content)

    def test_strategy_engine_respects_pause_command(self) -> None:
        control = ControlCenter()
        control.pause()
        engine = StrategyEngine(
            config=StrategyConfig(minimum_setup_score=7),
            session_filter=SessionFilter(SessionConfig()),
            news_filter=NewsFilter(NewsFilterConfig()),
            risk_manager=RiskManager(RiskConfig(max_risk_per_trade_pct=Decimal("0.01"))),
            setup_scorer=SetupScorer(minimum_score=7),
            execution_router=ExecutionRouter(RecordingExecutionClient(), production_config=ProductionConfig(live_trading_enabled=True)),
            market_state_engine=StaticMarketStateEngine("XAUUSD"),
            permission_engine=AllowPermissionEngine(),
            control_center=control,
        )
        market = MarketSnapshot(
            symbol="XAUUSD",
            bars_by_timeframe={Timeframe.M5: [_bar(0, "2300"), _bar(1, "2301"), _bar(2, "2302")]},
            bid=Decimal("2301.9"),
            ask=Decimal("2302.0"),
            symbol_spec=SymbolSpec(symbol="XAUUSD", tick_size=Decimal("0.01"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01")),
        )

        signal = engine.evaluate(
            symbol="XAUUSD",
            market=market,
            account=AccountSnapshot(equity=Decimal("10000"), balance=Decimal("10000")),
            state=RobotState(trading_day=datetime(2026, 4, 10).date()),
            timestamp=datetime(2026, 4, 10, 14, 0),
        )

        self.assertEqual(signal.decision, SignalDecision.BLOCKED)
        self.assertIn("control_decision", signal.metadata)


if __name__ == "__main__":
    unittest.main()
