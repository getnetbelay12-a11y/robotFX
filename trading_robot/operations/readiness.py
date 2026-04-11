"""Live readiness checks for deployment.

The checker is intentionally strict. It does not certify profitability; it only
verifies whether the configured system is in a sane, fail-closed state for live
or demo deployment.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from trading_robot.config.settings import SystemConfig
from trading_robot.research.data_readiness import DataReadinessChecker
from trading_robot.types.models import SymbolSpec


@dataclass(frozen=True)
class ReadinessItem:
    """One readiness outcome."""

    name: str
    passed: bool
    severity: str
    detail: str


@dataclass(frozen=True)
class LiveReadinessReport:
    """Serialized deployment-readiness report."""

    ready: bool
    items: tuple[ReadinessItem, ...]


class LiveReadinessChecker:
    """Performs deployment checks for symbols, config, paths, and telemetry."""

    def __init__(self) -> None:
        self._data_readiness = DataReadinessChecker()

    def evaluate(
        self,
        config: SystemConfig,
        symbols: tuple[str, ...],
        symbol_specs: dict[str, SymbolSpec] | None = None,
        data_root: str | Path = "runtime/data",
        tuning_paths: tuple[str | Path, ...] = (),
    ) -> LiveReadinessReport:
        symbol_specs = symbol_specs or {}
        items: list[ReadinessItem] = []

        items.append(
            ReadinessItem(
                name="live_trading_enabled",
                passed=config.production.live_trading_enabled,
                severity="blocker",
                detail="ProductionConfig.live_trading_enabled must be true on the live host.",
            )
        )
        items.append(
            ReadinessItem(
                name="state_path_parent",
                passed=self._ensure_parent(config.production.state_file_path),
                severity="blocker",
                detail=f"state path parent must exist or be creatable: {config.production.state_file_path}",
            )
        )
        items.append(
            ReadinessItem(
                name="log_path_parent",
                passed=self._ensure_parent(config.production.log_file_path),
                severity="blocker",
                detail=f"log path parent must exist or be creatable: {config.production.log_file_path}",
            )
        )
        items.append(
            ReadinessItem(
                name="telegram_configured",
                passed=(not config.monitoring.alerts_enabled) or bool(config.monitoring.telegram_bot_token and config.monitoring.telegram_chat_id),
                severity="warning",
                detail="Telegram token/chat id should be configured when alerts are enabled.",
            )
        )
        items.append(
            ReadinessItem(
                name="symbols_configured",
                passed=bool(symbols),
                severity="blocker",
                detail="At least one tradable symbol must be configured.",
            )
        )

        for symbol in symbols:
            spec = symbol_specs.get(symbol)
            items.append(
                ReadinessItem(
                    name=f"symbol_spec:{symbol}",
                    passed=spec is not None and spec.tick_size > 0 and spec.tick_value > 0,
                    severity="blocker",
                    detail=f"{symbol} must have a valid SymbolSpec with tick_size and tick_value.",
                )
            )

        for tuning_path in tuning_paths:
            path = Path(tuning_path)
            exists = path.exists()
            items.append(
                ReadinessItem(
                    name=f"tuning:{path.name}",
                    passed=exists,
                    severity="warning",
                    detail=f"recommended tuning file {'found' if exists else 'not found'}: {path}",
                )
            )

        root = Path(data_root)
        for symbol in symbols:
            report = self._data_readiness.check(symbol, root / symbol, 2019, 2026)
            present = ", ".join(str(year) for year in report.present_years) or "none"
            missing = ", ".join(str(year) for year in report.missing_years) or "none"
            items.append(
                ReadinessItem(
                    name=f"data:{symbol}",
                    passed=len(report.present_years) >= 4,
                    severity="warning",
                    detail=f"{symbol} local research coverage present=[{present}] missing=[{missing}]",
                )
            )

        ready = all(item.passed for item in items if item.severity == "blocker")
        return LiveReadinessReport(ready=ready, items=tuple(items))

    def write_report(self, report: LiveReadinessReport, path: str | Path) -> None:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps({"ready": report.ready, "items": [asdict(item) for item in report.items]}, indent=2),
            encoding="utf-8",
        )

    def _ensure_parent(self, path: str | Path) -> bool:
        try:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            return True
        except OSError:
            return False
