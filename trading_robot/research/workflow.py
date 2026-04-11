"""End-to-end historical research workflow."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from trading_robot.journal.logger import TradingLogger
from trading_robot.research.data_readiness import DataReadinessChecker
from trading_robot.research.data_pipeline import HistDataClient, HistoricalDataLoader
from trading_robot.research.pattern_learning import PatternLearningEngine
from trading_robot.research.recommendations import ResearchRecommendationEngine


class ResearchWorkflow:
    """Fetch source manifests, load local data, and write a research report."""

    def __init__(self, logger: TradingLogger | None = None) -> None:
        self._logger = logger or TradingLogger()
        self._histdata = HistDataClient(logger=self._logger)
        self._loader = HistoricalDataLoader(logger=self._logger)
        self._patterns = PatternLearningEngine()
        self._recommendations = ResearchRecommendationEngine()
        self._readiness = DataReadinessChecker()

    def run_xauaud_five_year_research(
        self,
        raw_data_dir: str | Path = "runtime/data/XAUAUD",
        report_path: str | Path = "runtime/research/xauaud_five_year_report.json",
        markdown_path: str | Path = "runtime/research/xauaud_five_year_report.md",
    ) -> dict[str, object]:
        """Best-effort workflow for XAUAUD 2021-2025 using public HistData manifests."""

        manifests = self._histdata.fetch_manifest_range(symbol="XAUAUD", start_year=2021, end_year=2025)
        downloaded_files: list[str] = []
        for manifest in manifests:
            path = self._histdata.try_download_year(manifest, raw_data_dir)
            if path is not None:
                downloaded_files.append(str(path))

        readiness = self._readiness.check(symbol="XAUAUD", directory=raw_data_dir, start_year=2021, end_year=2025)
        bars = self._loader.load_directory(symbol="XAUAUD", directory=raw_data_dir)
        if not bars:
            result: dict[str, object] = {
                "symbol": "XAUAUD",
                "manifest_years": [manifest.year for manifest in manifests],
                "manifests": [asdict(manifest) for manifest in manifests],
                "downloaded_files": downloaded_files,
                "data_readiness": asdict(readiness),
                "report": None,
                "note": "No downloadable HistData zip was returned from this environment. Drop yearly zip/csv files into runtime/data/XAUAUD and rerun the workflow.",
            }
        else:
            report = self._patterns.analyze(symbol="XAUAUD", bars=bars)
            recommendations = self._recommendations.recommend(report)
            result = {
                "symbol": "XAUAUD",
                "manifest_years": [manifest.year for manifest in manifests],
                "manifests": [asdict(manifest) for manifest in manifests],
                "downloaded_files": downloaded_files,
                "data_readiness": asdict(readiness),
                "report": asdict(report),
                "recommendations": asdict(recommendations),
            }

        target = Path(report_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
        Path(markdown_path).write_text(self._markdown_summary(result), encoding="utf-8")
        self._logger.info("research workflow completed", symbol="XAUAUD", report_path=str(target), bars=len(bars))
        return result

    def run_multi_symbol_seven_year_research(
        self,
        symbols: tuple[str, ...] = ("XAUUSD", "XAUAUD", "EURUSD", "NAS100", "US30", "BTCUSD"),
        raw_root_dir: str | Path = "runtime/data",
        report_path: str | Path = "runtime/research/multi_symbol_seven_year_report.json",
        markdown_path: str | Path = "runtime/research/multi_symbol_seven_year_report.md",
    ) -> dict[str, object]:
        """Run a 7-year multi-symbol study through today's date.

        Uses exact window January 1, 2019 through the current UTC date.
        """

        today = datetime.utcnow().date()
        start_year = 2019
        end_year = today.year
        root = Path(raw_root_dir)
        output: dict[str, object] = {
            "window_start": f"{start_year}-01-01",
            "window_end": today.isoformat(),
            "symbols": {},
        }

        for symbol in symbols:
            symbol_dir = root / symbol.upper()
            readiness = self._readiness.check(symbol=symbol, directory=symbol_dir, start_year=start_year, end_year=end_year)
            manifests = []
            if symbol.upper() in {"EURUSD", "XAUAUD", "XAUUSD"}:
                try:
                    manifests = [asdict(item) for item in self._histdata.fetch_manifest_range(symbol=symbol, start_year=start_year, end_year=end_year)]
                except Exception as exc:
                    manifests = [{"error": str(exc)}]

            bars = self._loader.load_directory(symbol=symbol, directory=symbol_dir)
            if not bars:
                output["symbols"][symbol.upper()] = {
                    "data_readiness": asdict(readiness),
                    "manifests": manifests,
                    "report": None,
                    "recommendations": None,
                    "note": "No local data loaded for this symbol.",
                }
                continue

            report = self._patterns.analyze(symbol=symbol, bars=bars)
            recommendations = self._recommendations.recommend(report)
            output["symbols"][symbol.upper()] = {
                "data_readiness": asdict(readiness),
                "manifests": manifests,
                "report": asdict(report),
                "recommendations": asdict(recommendations),
            }

        target = Path(report_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")
        Path(markdown_path).write_text(self._multi_symbol_markdown(output), encoding="utf-8")
        self._logger.info("multi-symbol research workflow completed", report_path=str(target), symbols=symbols)
        return output

    def _markdown_summary(self, result: dict[str, object]) -> str:
        lines = ["# XAUAUD Five-Year Research", ""]
        lines.append(f"Symbol: {result['symbol']}")
        lines.append(f"Manifest years: {', '.join(str(year) for year in result['manifest_years'])}")
        lines.append(f"Downloaded files: {len(result.get('downloaded_files', []))}")
        readiness = result.get("data_readiness", {})
        if readiness:
            lines.append(f"Present years: {', '.join(str(year) for year in readiness.get('present_years', [])) or 'none'}")
            lines.append(f"Missing years: {', '.join(str(year) for year in readiness.get('missing_years', [])) or 'none'}")
        if result.get("report") is None:
            lines.extend(["", f"Note: {result.get('note', 'No report available.')}"])
            return "\n".join(lines) + "\n"

        report = result["report"]
        recommendations = result.get("recommendations", {})
        lines.extend(
            [
                "",
                "## Best Conditions",
                *(f"- {item}" for item in report.get("best_conditions", [])),
                "",
                "## Worst Conditions",
                *(f"- {item}" for item in report.get("worst_conditions", [])),
                "",
                "## Suggestions",
                *(f"- {item}" for item in report.get("suggestions", [])),
                "",
                "## Recommendations",
                f"- Preferred sessions: {', '.join(recommendations.get('preferred_sessions', [])) or 'none'}",
                f"- Avoided sessions: {', '.join(recommendations.get('avoided_sessions', [])) or 'none'}",
                f"- Preferred patterns: {', '.join(recommendations.get('preferred_patterns', [])) or 'none'}",
                f"- Score threshold bias: {recommendations.get('score_threshold_bias', 'unknown')}",
            ]
        )
        return "\n".join(lines) + "\n"

    def _multi_symbol_markdown(self, result: dict[str, object]) -> str:
        lines = [
            "# Multi-Symbol Seven-Year Research",
            "",
            f"Window start: {result['window_start']}",
            f"Window end: {result['window_end']}",
            "",
        ]
        for symbol, payload in result["symbols"].items():
            lines.extend([f"## {symbol}"])
            readiness = payload.get("data_readiness", {})
            lines.append(f"- Present years: {', '.join(str(year) for year in readiness.get('present_years', [])) or 'none'}")
            lines.append(f"- Missing years: {', '.join(str(year) for year in readiness.get('missing_years', [])) or 'none'}")
            if payload.get("report") is None:
                lines.append(f"- Note: {payload.get('note', 'No report available.')}")
                lines.append("")
                continue
            report = payload["report"]
            recommendations = payload.get("recommendations", {})
            lines.append(f"- Best conditions: {', '.join(report.get('best_conditions', [])) or 'none'}")
            lines.append(f"- Worst conditions: {', '.join(report.get('worst_conditions', [])) or 'none'}")
            lines.append(f"- Preferred patterns: {', '.join(recommendations.get('preferred_patterns', [])) or 'none'}")
            lines.append(f"- Score threshold bias: {recommendations.get('score_threshold_bias', 'unknown')}")
            top_sessions = self._top_metric_names(report.get("session_metrics", {}), limit=3)
            top_hours = self._top_metric_names(report.get("hour_metrics", {}), limit=3)
            top_candles = self._top_metric_names(report.get("candlestick_metrics", {}), limit=5)
            lines.append(f"- Top sessions: {', '.join(top_sessions) or 'none'}")
            lines.append(f"- Top hours: {', '.join(top_hours) or 'none'}")
            lines.append(f"- Top candlesticks: {', '.join(top_candles) or 'none'}")
            lines.append("")
        return "\n".join(lines) + "\n"

    def _top_metric_names(self, metric_map: dict[str, object], limit: int) -> tuple[str, ...]:
        ranked = sorted(
            (
                (name, Decimal(str(metric.get("expectancy", 0))))
                for name, metric in metric_map.items()
                if metric.get("trades", 0) > 0
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        return tuple(name for name, _ in ranked[:limit])
