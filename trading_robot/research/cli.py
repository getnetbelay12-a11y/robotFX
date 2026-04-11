"""CLI entry points for historical research workflows."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from datetime import date

from trading_robot.research import BinanceDownloader, DukascopyDownloader, ResearchWorkflow
from trading_robot.research.data_pipeline import HistDataClient
from trading_robot.research.data_readiness import DataReadinessChecker


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run historical research workflows.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    xauaud = subparsers.add_parser("xauaud-5y", help="Run the XAUAUD five-year workflow.")
    xauaud.add_argument("--raw-data-dir", default="runtime/data/XAUAUD")
    xauaud.add_argument("--report-json", default="runtime/research/xauaud_five_year_report.json")
    xauaud.add_argument("--report-md", default="runtime/research/xauaud_five_year_report.md")
    xauaud.add_argument("--tuning-json", default="runtime/research/xauaud_tuning_recommendations.json")
    multi = subparsers.add_parser("multi-7y", help="Run a multi-symbol 7-year workflow.")
    multi.add_argument("--raw-root-dir", default="runtime/data")
    multi.add_argument("--report-json", default="runtime/research/multi_symbol_seven_year_report.json")
    multi.add_argument("--report-md", default="runtime/research/multi_symbol_seven_year_report.md")
    multi.add_argument("--symbols", nargs="*", default=["XAUUSD", "XAUAUD", "EURUSD", "NAS100", "US30", "BTCUSD"])
    core = subparsers.add_parser("core-4", help="Run focused research for EURUSD, XAUUSD, NAS100, and US30.")
    core.add_argument("--raw-root-dir", default="runtime/data")
    core.add_argument("--report-json", default="runtime/research/core_four_market_report.json")
    core.add_argument("--report-md", default="runtime/research/core_four_market_report.md")
    core5 = subparsers.add_parser("core-5", help="Run focused research for EURUSD, XAUUSD, NAS100, US30, and BTCUSD.")
    core5.add_argument("--raw-root-dir", default="runtime/data")
    core5.add_argument("--report-json", default="runtime/research/core_five_market_report.json")
    core5.add_argument("--report-md", default="runtime/research/core_five_market_report.md")
    readiness = subparsers.add_parser("check-xauaud-data", help="Check local XAUAUD file coverage.")
    readiness.add_argument("--raw-data-dir", default="runtime/data/XAUAUD")
    multi_readiness = subparsers.add_parser("check-multi-data", help="Check local 7-year file coverage for multiple symbols.")
    multi_readiness.add_argument("--raw-root-dir", default="runtime/data")
    multi_readiness.add_argument("--symbols", nargs="*", default=["XAUUSD", "XAUAUD", "EURUSD", "NAS100", "US30", "BTCUSD"])
    download = subparsers.add_parser("download-histdata", help="Download available HistData yearly files for a symbol range.")
    download.add_argument("--symbol", required=True)
    download.add_argument("--start-year", type=int, default=2019)
    download.add_argument("--end-year", type=int, default=2026)
    download.add_argument("--target-dir", default=None)
    duka = subparsers.add_parser("download-dukascopy", help="Download Dukascopy public M1 candles for supported symbols.")
    duka.add_argument("--symbol", required=True)
    duka.add_argument("--start-date", default="2019-01-01")
    duka.add_argument("--end-date", default=date.today().isoformat())
    duka.add_argument("--target-dir", default=None)
    binance = subparsers.add_parser("download-binance-crypto", help="Download public Binance monthly 1m crypto archives for supported symbols.")
    binance.add_argument("--symbol", default="BTCUSD")
    binance.add_argument("--start-year", type=int, default=2019)
    binance.add_argument("--end-year", type=int, default=date.today().year)
    binance.add_argument("--target-dir", default=None)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    workflow = ResearchWorkflow()

    if args.command == "xauaud-5y":
        result = workflow.run_xauaud_five_year_research(
            raw_data_dir=args.raw_data_dir,
            report_path=args.report_json,
            markdown_path=args.report_md,
        )
        tuning = build_tuning_payload(result)
        tuning_path = Path(args.tuning_json)
        tuning_path.parent.mkdir(parents=True, exist_ok=True)
        tuning_path.write_text(json.dumps(tuning, indent=2), encoding="utf-8")
        print(f"report_json={args.report_json}")
        print(f"report_md={args.report_md}")
        print(f"tuning_json={args.tuning_json}")
        return 0
    if args.command == "check-xauaud-data":
        report = DataReadinessChecker().check("XAUAUD", args.raw_data_dir, 2021, 2025)
        print(json.dumps(report.__dict__, indent=2))
        return 0
    if args.command == "multi-7y":
        result = workflow.run_multi_symbol_seven_year_research(
            symbols=tuple(args.symbols),
            raw_root_dir=args.raw_root_dir,
            report_path=args.report_json,
            markdown_path=args.report_md,
        )
        tuning = build_multi_symbol_tuning_payload(result)
        tuning_path = Path("runtime/research/multi_symbol_tuning_recommendations.json")
        tuning_path.parent.mkdir(parents=True, exist_ok=True)
        tuning_path.write_text(json.dumps(tuning, indent=2), encoding="utf-8")
        print(f"report_json={args.report_json}")
        print(f"report_md={args.report_md}")
        print(f"tuning_json={tuning_path}")
        return 0
    if args.command == "core-4":
        result = workflow.run_multi_symbol_seven_year_research(
            symbols=("EURUSD", "XAUUSD", "NAS100", "US30"),
            raw_root_dir=args.raw_root_dir,
            report_path=args.report_json,
            markdown_path=args.report_md,
        )
        tuning = build_multi_symbol_tuning_payload(result)
        tuning_path = Path("runtime/research/core_four_market_tuning.json")
        tuning_path.parent.mkdir(parents=True, exist_ok=True)
        tuning_path.write_text(json.dumps(tuning, indent=2), encoding="utf-8")
        print(f"report_json={args.report_json}")
        print(f"report_md={args.report_md}")
        print(f"tuning_json={tuning_path}")
        return 0
    if args.command == "core-5":
        result = workflow.run_multi_symbol_seven_year_research(
            symbols=("EURUSD", "XAUUSD", "NAS100", "US30", "BTCUSD"),
            raw_root_dir=args.raw_root_dir,
            report_path=args.report_json,
            markdown_path=args.report_md,
        )
        tuning = build_multi_symbol_tuning_payload(result)
        tuning_path = Path("runtime/research/core_five_market_tuning.json")
        tuning_path.parent.mkdir(parents=True, exist_ok=True)
        tuning_path.write_text(json.dumps(tuning, indent=2), encoding="utf-8")
        print(f"report_json={args.report_json}")
        print(f"report_md={args.report_md}")
        print(f"tuning_json={tuning_path}")
        return 0
    if args.command == "check-multi-data":
        payload = {}
        checker = DataReadinessChecker()
        for symbol in args.symbols:
            report = checker.check(symbol, Path(args.raw_root_dir) / symbol.upper(), 2019, 2026)
            payload[symbol.upper()] = report.__dict__
        print(json.dumps(payload, indent=2))
        return 0
    if args.command == "download-histdata":
        client = HistDataClient()
        symbol = args.symbol.upper()
        target_dir = args.target_dir or f"runtime/data/{symbol}"
        payload = {"symbol": symbol, "target_dir": target_dir, "downloaded": [], "skipped": []}
        for year in range(args.start_year, args.end_year + 1):
            manifest = client.fetch_manifest(symbol=symbol, year=year)
            if not client.is_downloadable(manifest):
                payload["skipped"].append({"year": year, "reason": "no_histdata_token"})
                continue
            path = client.try_download_year(manifest, target_dir)
            if path is None:
                payload["skipped"].append({"year": year, "reason": "download_unavailable"})
            else:
                payload["downloaded"].append(str(path))
        print(json.dumps(payload, indent=2))
        return 0
    if args.command == "download-dukascopy":
        downloader = DukascopyDownloader()
        symbol = args.symbol.upper()
        target_dir = args.target_dir or f"runtime/data/{symbol}"
        files = downloader.download_date_range(
            symbol=symbol,
            start_date=date.fromisoformat(args.start_date),
            end_date=date.fromisoformat(args.end_date),
            target_dir=target_dir,
        )
        print(json.dumps({"symbol": symbol, "target_dir": target_dir, "files": files}, indent=2))
        return 0
    if args.command == "download-binance-crypto":
        downloader = BinanceDownloader()
        symbol = args.symbol.upper()
        target_dir = args.target_dir or f"runtime/data/{symbol}"
        files = downloader.download_years(
            symbol=symbol,
            start_year=args.start_year,
            end_year=args.end_year,
            target_dir=target_dir,
        )
        print(json.dumps({"symbol": symbol, "target_dir": target_dir, "files": files}, indent=2))
        return 0

    return 1


def build_tuning_payload(result: dict[str, object]) -> dict[str, object]:
    recommendations = result.get("recommendations") or {}
    return {
        "symbol": result.get("symbol"),
        "preferred_sessions": recommendations.get("preferred_sessions", []),
        "avoided_sessions": recommendations.get("avoided_sessions", []),
        "preferred_patterns": recommendations.get("preferred_patterns", []),
        "score_threshold_bias": recommendations.get("score_threshold_bias", "conservative"),
        "notes": recommendations.get("notes", []),
    }


def build_multi_symbol_tuning_payload(result: dict[str, object]) -> dict[str, object]:
    payload: dict[str, object] = {"window_start": result.get("window_start"), "window_end": result.get("window_end"), "symbols": {}}
    for symbol, data in result.get("symbols", {}).items():
        recommendations = data.get("recommendations") or {}
        payload["symbols"][symbol] = {
            "preferred_sessions": recommendations.get("preferred_sessions", []),
            "avoided_sessions": recommendations.get("avoided_sessions", []),
            "preferred_patterns": recommendations.get("preferred_patterns", []),
            "score_threshold_bias": recommendations.get("score_threshold_bias", "conservative"),
            "notes": recommendations.get("notes", []),
        }
    return payload


if __name__ == "__main__":
    raise SystemExit(main())
