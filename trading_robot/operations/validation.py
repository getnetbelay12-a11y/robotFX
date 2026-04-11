"""Batch production validation utilities.

This module runs the code-side deployment gate:
- fail-closed readiness checks
- bounded strategy-accurate replay samples on real local data

It does not replace MT5 terminal validation or forward demo testing.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from trading_robot.backtesting import StrategyReplayBacktestEngine, aggregate_bars
from trading_robot.config import ProductionConfig, StrategyConfig, SystemConfig
from trading_robot.operations.readiness import LiveReadinessChecker, LiveReadinessReport
from trading_robot.research.data_pipeline import HistoricalDataLoader
from trading_robot.types import Bar, SymbolSpec, Timeframe


DEFAULT_SYMBOL_SPECS: dict[str, SymbolSpec] = {
    "EURUSD": SymbolSpec(symbol="EURUSD", tick_size=Decimal("0.0001"), tick_value=Decimal("10"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01")),
    "XAUUSD": SymbolSpec(symbol="XAUUSD", tick_size=Decimal("0.01"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01"), metadata={"max_spread_points": Decimal("50")}),
    "NAS100": SymbolSpec(symbol="NAS100", tick_size=Decimal("1"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01")),
    "US30": SymbolSpec(symbol="US30", tick_size=Decimal("1"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01")),
    "BTCUSD": SymbolSpec(symbol="BTCUSD", tick_size=Decimal("0.01"), tick_value=Decimal("1"), min_volume=Decimal("0.01"), volume_step=Decimal("0.01")),
}


@dataclass(frozen=True)
class ReplayValidationResult:
    """One bounded replay outcome for one symbol."""

    symbol: str
    status: str
    records_loaded: int
    start: str | None
    end: str | None
    total_trades: int
    win_rate: str
    profit_factor: str
    net_pnl: str
    average_r: str
    output_path: str | None
    reason: str = ""


@dataclass(frozen=True)
class ProductionValidationReport:
    """Combined code-side production validation output."""

    ready_for_terminal_validation: bool
    readiness: LiveReadinessReport
    replay_results: tuple[ReplayValidationResult, ...]
    blockers: tuple[str, ...]
    warnings: tuple[str, ...]


class ProductionValidationSuite:
    """Run readiness plus bounded replay checks for a set of symbols."""

    def __init__(self, config: SystemConfig | None = None) -> None:
        self._config = config or SystemConfig()
        self._loader = HistoricalDataLoader()
        self._checker = LiveReadinessChecker()

    def run(
        self,
        symbols: tuple[str, ...],
        data_root: str | Path = "runtime/data",
        tuning_paths: tuple[str | Path, ...] = (),
        replay_start: datetime | None = None,
        replay_end: datetime | None = None,
        replay_output_dir: str | Path = "runtime/production",
        live_enabled: bool = False,
        telegram_bot_token: str | None = None,
        telegram_chat_id: str | None = None,
    ) -> ProductionValidationReport:
        config = self._build_config(
            symbols=symbols,
            live_enabled=live_enabled,
            telegram_bot_token=telegram_bot_token,
            telegram_chat_id=telegram_chat_id,
        )
        readiness = self._checker.evaluate(
            config=config,
            symbols=symbols,
            symbol_specs={symbol: DEFAULT_SYMBOL_SPECS[symbol] for symbol in symbols if symbol in DEFAULT_SYMBOL_SPECS},
            data_root=data_root,
            tuning_paths=tuning_paths,
        )

        replay_results = tuple(
            self._run_symbol_replay(
                symbol=symbol,
                data_dir=Path(data_root) / symbol,
                tuning_paths=tuning_paths,
                replay_start=replay_start,
                replay_end=replay_end,
                output_dir=Path(replay_output_dir),
            )
            for symbol in symbols
        )
        blockers = tuple(item.detail for item in readiness.items if item.severity == "blocker" and not item.passed)
        warnings = tuple(item.detail for item in readiness.items if item.severity == "warning" and not item.passed)
        ready_for_terminal_validation = readiness.ready and all(result.status == "ok" for result in replay_results)
        return ProductionValidationReport(
            ready_for_terminal_validation=ready_for_terminal_validation,
            readiness=readiness,
            replay_results=replay_results,
            blockers=blockers,
            warnings=warnings,
        )

    def write_report(self, report: ProductionValidationReport, path: str | Path) -> None:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "ready_for_terminal_validation": report.ready_for_terminal_validation,
            "readiness": {
                "ready": report.readiness.ready,
                "items": [asdict(item) for item in report.readiness.items],
            },
            "replay_results": [asdict(result) for result in report.replay_results],
            "blockers": list(report.blockers),
            "warnings": list(report.warnings),
        }
        target.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _build_config(
        self,
        symbols: tuple[str, ...],
        live_enabled: bool,
        telegram_bot_token: str | None,
        telegram_chat_id: str | None,
    ) -> SystemConfig:
        monitoring = self._config.monitoring.__class__(
            telegram_bot_token=telegram_bot_token,
            telegram_chat_id=telegram_chat_id,
            alerts_enabled=self._config.monitoring.alerts_enabled,
            commands_enabled=self._config.monitoring.commands_enabled,
            dashboard_enabled=self._config.monitoring.dashboard_enabled,
            operations_log_path=self._config.monitoring.operations_log_path,
        )
        return SystemConfig(
            broker=self._config.broker,
            strategy=StrategyConfig(
                symbols=symbols,
                minimum_setup_score=self._config.strategy.minimum_setup_score,
                max_selected_trades=self._config.strategy.max_selected_trades,
                timeframes=self._config.strategy.timeframes,
            ),
            risk=self._config.risk,
            trade_management=self._config.trade_management,
            market_state=self._config.market_state,
            prop_protection=self._config.prop_protection,
            risk_adaptation=self._config.risk_adaptation,
            session=self._config.session,
            news=self._config.news,
            backtest=self._config.backtest,
            production=ProductionConfig(
                live_trading_enabled=live_enabled,
                order_retries=self._config.production.order_retries,
                retry_delay_seconds=self._config.production.retry_delay_seconds,
                state_file_path=self._config.production.state_file_path,
                log_file_path=self._config.production.log_file_path,
                alert_webhook_url=self._config.production.alert_webhook_url,
                heartbeat_interval_seconds=self._config.production.heartbeat_interval_seconds,
                reconnect_on_failure=self._config.production.reconnect_on_failure,
                persist_state_on_decision=self._config.production.persist_state_on_decision,
            ),
            live_optimization=self._config.live_optimization,
            monitoring=monitoring,
            topstepx=self._config.topstepx.__class__(
                api_base_url=self._config.topstepx.api_base_url,
                user_hub_url=self._config.topstepx.user_hub_url,
                market_hub_url=self._config.topstepx.market_hub_url,
                username=self._config.topstepx.username,
                api_key=self._config.topstepx.api_key,
                account_id=self._config.topstepx.account_id,
                account_name=self._config.topstepx.account_name,
                live=self._config.topstepx.live,
                order_tag_prefix=self._config.topstepx.order_tag_prefix,
                prefer_micro_contracts=self._config.topstepx.prefer_micro_contracts,
                symbol_aliases=dict(self._config.topstepx.symbol_aliases),
                request_timeout_seconds=self._config.topstepx.request_timeout_seconds,
                validate_token_on_connect=self._config.topstepx.validate_token_on_connect,
            ),
        )

    def _run_symbol_replay(
        self,
        symbol: str,
        data_dir: Path,
        tuning_paths: tuple[str | Path, ...],
        replay_start: datetime | None,
        replay_end: datetime | None,
        output_dir: Path,
    ) -> ReplayValidationResult:
        records = self._load_records(symbol, data_dir, replay_start, replay_end)
        if replay_start is not None:
            records = [record for record in records if record.timestamp >= replay_start]
        if replay_end is not None:
            records = [record for record in records if record.timestamp <= replay_end]
        if not records:
            return ReplayValidationResult(
                symbol=symbol,
                status="no_data",
                records_loaded=0,
                start=replay_start.isoformat() if replay_start is not None else None,
                end=replay_end.isoformat() if replay_end is not None else None,
                total_trades=0,
                win_rate="0",
                profit_factor="0",
                net_pnl="0",
                average_r="0",
                output_path=None,
                reason=f"no records found in {data_dir}",
            )

        m1 = [
            Bar(
                symbol=symbol,
                timeframe=Timeframe.M1,
                timestamp=record.timestamp,
                open=record.open,
                high=record.high,
                low=record.low,
                close=record.close,
                volume=record.volume,
            )
            for record in records
        ]
        bars = {
            Timeframe.M5: aggregate_bars(symbol, Timeframe.M5, m1),
            Timeframe.M15: aggregate_bars(symbol, Timeframe.M15, m1),
            Timeframe.H1: aggregate_bars(symbol, Timeframe.H1, m1),
        }
        tuning_path = next((Path(path) for path in tuning_paths if Path(path).exists() and "core_five_market_tuning" in str(path)), None)
        engine = StrategyReplayBacktestEngine(
            SystemConfig(
                strategy=StrategyConfig(minimum_setup_score=self._config.strategy.minimum_setup_score),
                production=ProductionConfig(live_trading_enabled=True),
            ),
            tuning_path=tuning_path,
        )
        result = engine.run_symbol(symbol, bars, symbol_spec=DEFAULT_SYMBOL_SPECS.get(symbol))
        payload = {
            "symbol": symbol,
            "records_loaded": len(records),
            "start": records[0].timestamp.isoformat(),
            "end": records[-1].timestamp.isoformat(),
            "stats": result.stats.as_report(),
            "trades": [
                {
                    "timestamp": record.timestamp.isoformat(),
                    "symbol": record.symbol,
                    "strategy_type": record.strategy_type,
                    "entry": str(record.entry),
                    "exit": str(record.exit),
                    "stop_loss": str(record.stop_loss),
                    "take_profit": str(record.take_profit),
                    "r_result": str(record.r_result),
                    "pnl": str(record.pnl),
                    "session": record.session,
                    "news_condition": record.news_condition,
                    "volatility": record.volatility,
                }
                for record in result.stats.records
            ],
        }
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"replay_validation_{symbol.lower()}.json"
        output_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        return ReplayValidationResult(
            symbol=symbol,
            status="ok",
            records_loaded=len(records),
            start=records[0].timestamp.isoformat(),
            end=records[-1].timestamp.isoformat(),
            total_trades=result.stats.trades,
            win_rate=str(result.stats.win_rate),
            profit_factor=str(result.stats.profit_factor),
            net_pnl=str(result.stats.net_pnl),
            average_r=str(result.stats.average_r),
            output_path=str(output_path),
        )

    def _load_records(
        self,
        symbol: str,
        data_dir: Path,
        replay_start: datetime | None,
        replay_end: datetime | None,
    ):
        if replay_start is None and replay_end is None:
            return self._loader.load_directory(symbol, data_dir)

        years = set()
        if replay_start is not None and replay_end is not None:
            years.update(range(replay_start.year, replay_end.year + 1))
        elif replay_start is not None:
            years.add(replay_start.year)
        elif replay_end is not None:
            years.add(replay_end.year)

        records = []
        for path in sorted(data_dir.glob("*")):
            if not path.is_file():
                continue
            if years and not any(str(year) in path.name for year in years):
                continue
            if path.suffix.lower() == ".zip":
                records.extend(self._loader.load_histdata_zip(symbol=symbol, path=path))
            elif path.suffix.lower() in {".csv", ".txt"}:
                records.extend(self._loader.load_auto(symbol=symbol, path=path))
        return records
