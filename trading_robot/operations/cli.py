"""Operational CLI for live readiness checks and strategy replay backtests."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from trading_robot.config import BrokerConfig, ProductionConfig, StrategyConfig, SystemConfig, TopstepXConfig
from trading_robot.operations.readiness import LiveReadinessChecker
from trading_robot.operations.validation import DEFAULT_SYMBOL_SPECS, ProductionValidationSuite
from trading_robot.backtesting import StrategyReplayBacktestEngine, aggregate_bars
from trading_robot.research.data_pipeline import HistoricalDataLoader
from trading_robot.types import Bar, BrokerType, Timeframe


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run production readiness checks and replay backtests.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    readiness = subparsers.add_parser("check-live-readiness", help="Evaluate deployment readiness for configured symbols.")
    readiness.add_argument("--symbols", nargs="+", default=["EURUSD", "XAUUSD", "NAS100", "US30", "BTCUSD"])
    readiness.add_argument("--data-root", default="runtime/data")
    readiness.add_argument("--output", default="runtime/production/live_readiness_report.json")
    readiness.add_argument("--tuning", nargs="*", default=["runtime/research/core_five_market_tuning.json", "runtime/research/index_clean_tuning_report.json"])
    readiness.add_argument("--live-enabled", action="store_true")
    readiness.add_argument("--telegram-bot-token", default=None)
    readiness.add_argument("--telegram-chat-id", default=None)
    readiness.add_argument("--broker-type", choices=[broker.value for broker in BrokerType], default=BrokerType.MT5.value)
    readiness.add_argument("--topstepx-username", default=None)
    readiness.add_argument("--topstepx-api-key", default=None)
    readiness.add_argument("--topstepx-account-id", type=int, default=None)
    readiness.add_argument("--topstepx-account-name", default=None)

    replay = subparsers.add_parser("run-replay", help="Run strategy-accurate replay on local historical data.")
    replay.add_argument("--symbol", required=True)
    replay.add_argument("--data-dir", default=None)
    replay.add_argument("--years", nargs="*", type=int, default=None)
    replay.add_argument("--start", default=None, help="Inclusive ISO timestamp/date filter.")
    replay.add_argument("--end", default=None, help="Inclusive ISO timestamp/date filter.")
    replay.add_argument("--minimum-score", type=int, default=7)
    replay.add_argument("--tuning", default="runtime/research/core_five_market_tuning.json")
    replay.add_argument("--output", default=None)

    suite = subparsers.add_parser("run-production-suite", help="Run readiness plus bounded replay samples across core symbols.")
    suite.add_argument("--symbols", nargs="+", default=["EURUSD", "XAUUSD", "NAS100", "US30", "BTCUSD"])
    suite.add_argument("--data-root", default="runtime/data")
    suite.add_argument("--output", default="runtime/production/production_validation_report.json")
    suite.add_argument("--replay-output-dir", default="runtime/production")
    suite.add_argument("--tuning", nargs="*", default=["runtime/research/core_five_market_tuning.json", "runtime/research/index_clean_tuning_report.json"])
    suite.add_argument("--start", default="2024-01-01")
    suite.add_argument("--end", default="2024-01-31")
    suite.add_argument("--live-enabled", action="store_true")
    suite.add_argument("--telegram-bot-token", default=None)
    suite.add_argument("--telegram-chat-id", default=None)
    suite.add_argument("--broker-type", choices=[broker.value for broker in BrokerType], default=BrokerType.MT5.value)
    suite.add_argument("--topstepx-username", default=None)
    suite.add_argument("--topstepx-api-key", default=None)
    suite.add_argument("--topstepx-account-id", type=int, default=None)
    suite.add_argument("--topstepx-account-name", default=None)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "check-live-readiness":
        config = SystemConfig(
            broker=BrokerConfig(broker_type=BrokerType(args.broker_type)),
            strategy=StrategyConfig(symbols=tuple(symbol.upper() for symbol in args.symbols)),
            production=ProductionConfig(live_trading_enabled=args.live_enabled),
            topstepx=TopstepXConfig(
                username=args.topstepx_username,
                api_key=args.topstepx_api_key,
                account_id=args.topstepx_account_id,
                account_name=args.topstepx_account_name,
            ),
        )
        if args.telegram_bot_token is not None or args.telegram_chat_id is not None:
            config = SystemConfig(
                broker=config.broker,
                strategy=config.strategy,
                risk=config.risk,
                trade_management=config.trade_management,
                market_state=config.market_state,
                prop_protection=config.prop_protection,
                risk_adaptation=config.risk_adaptation,
                session=config.session,
                news=config.news,
                backtest=config.backtest,
                production=config.production,
                live_optimization=config.live_optimization,
                monitoring=config.monitoring.__class__(
                    telegram_bot_token=args.telegram_bot_token,
                    telegram_chat_id=args.telegram_chat_id,
                    alerts_enabled=config.monitoring.alerts_enabled,
                    commands_enabled=config.monitoring.commands_enabled,
                    dashboard_enabled=config.monitoring.dashboard_enabled,
                    operations_log_path=config.monitoring.operations_log_path,
                ),
            )
        checker = LiveReadinessChecker()
        report = checker.evaluate(
            config=config,
            symbols=config.strategy.symbols,
            symbol_specs={symbol: DEFAULT_SYMBOL_SPECS[symbol] for symbol in config.strategy.symbols if symbol in DEFAULT_SYMBOL_SPECS},
            data_root=args.data_root,
            tuning_paths=tuple(args.tuning),
        )
        checker.write_report(report, args.output)
        print(json.dumps({"output": args.output, "ready": report.ready, "items": [asdict(item) for item in report.items]}, indent=2))
        return 0

    if args.command == "run-replay":
        symbol = args.symbol.upper()
        data_dir = Path(args.data_dir or f"runtime/data/{symbol}")
        records = HistoricalDataLoader().load_directory(symbol, data_dir)
        if args.years:
            allowed_years = set(args.years)
            records = [record for record in records if record.timestamp.year in allowed_years]
        if args.start:
            start = _parse_datetime(args.start)
            records = [record for record in records if record.timestamp >= start]
        if args.end:
            end = _parse_datetime(args.end)
            records = [record for record in records if record.timestamp <= end]
        if not records:
            raise SystemExit(f"no records available for {symbol} in {data_dir}")

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
        engine = StrategyReplayBacktestEngine(
            SystemConfig(
                strategy=StrategyConfig(minimum_setup_score=args.minimum_score),
                production=ProductionConfig(live_trading_enabled=True),
            ),
            tuning_path=args.tuning if args.tuning and Path(args.tuning).exists() else None,
        )
        result = engine.run_symbol(symbol, bars, symbol_spec=DEFAULT_SYMBOL_SPECS.get(symbol))
        report = {
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
        output = args.output or f"runtime/production/replay_{symbol.lower()}.json"
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        print(json.dumps({"output": output, "symbol": symbol, "records_loaded": len(records), "total_trades": result.stats.trades}, indent=2))
        return 0

    if args.command == "run-production-suite":
        suite = ProductionValidationSuite(
            SystemConfig(
                broker=BrokerConfig(broker_type=BrokerType(args.broker_type)),
                strategy=StrategyConfig(minimum_setup_score=7),
                production=ProductionConfig(live_trading_enabled=args.live_enabled),
                topstepx=TopstepXConfig(
                    username=args.topstepx_username,
                    api_key=args.topstepx_api_key,
                    account_id=args.topstepx_account_id,
                    account_name=args.topstepx_account_name,
                ),
            )
        )
        report = suite.run(
            symbols=tuple(symbol.upper() for symbol in args.symbols),
            data_root=args.data_root,
            tuning_paths=tuple(args.tuning),
            replay_start=_parse_datetime(args.start) if args.start else None,
            replay_end=_parse_datetime(args.end) if args.end else None,
            replay_output_dir=args.replay_output_dir,
            live_enabled=args.live_enabled,
            telegram_bot_token=args.telegram_bot_token,
            telegram_chat_id=args.telegram_chat_id,
        )
        suite.write_report(report, args.output)
        print(
            json.dumps(
                {
                    "output": args.output,
                    "ready_for_terminal_validation": report.ready_for_terminal_validation,
                    "blockers": list(report.blockers),
                    "warnings": list(report.warnings),
                    "replay_results": [asdict(result) for result in report.replay_results],
                },
                indent=2,
            )
        )
        return 0

    return 1


def _parse_datetime(raw: str) -> datetime:
    if len(raw) == 10:
        return datetime.fromisoformat(f"{raw}T00:00:00")
    return datetime.fromisoformat(raw)


if __name__ == "__main__":
    raise SystemExit(main())
