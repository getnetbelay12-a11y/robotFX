"""Operations exports with lazy loading to avoid package import cycles."""

from __future__ import annotations

from importlib import import_module

__all__ = [
    "AlertDispatcher",
    "AlertEvent",
    "CommandResult",
    "ControlCenter",
    "ControlDecision",
    "ControlState",
    "DashboardPosition",
    "DashboardService",
    "DashboardSnapshot",
    "DEFAULT_SYMBOL_SPECS",
    "LiveReadinessChecker",
    "LiveReadinessReport",
    "OperationsLogStore",
    "ProductionValidationReport",
    "ProductionValidationSuite",
    "ReadinessItem",
    "ReplayValidationResult",
    "TelegramBotClient",
]


def __getattr__(name: str):
    if name in {"AlertDispatcher", "AlertEvent", "TelegramBotClient"}:
        module = import_module("trading_robot.operations.alerts")
        return getattr(module, name)
    if name in {
        "CommandResult",
        "ControlCenter",
        "ControlDecision",
        "ControlState",
        "DashboardPosition",
        "DashboardService",
        "DashboardSnapshot",
        "OperationsLogStore",
    }:
        module = import_module("trading_robot.operations.control")
        return getattr(module, name)
    if name in {"LiveReadinessChecker", "LiveReadinessReport", "ReadinessItem"}:
        module = import_module("trading_robot.operations.readiness")
        return getattr(module, name)
    if name in {
        "DEFAULT_SYMBOL_SPECS",
        "ProductionValidationReport",
        "ProductionValidationSuite",
        "ReplayValidationResult",
    }:
        module = import_module("trading_robot.operations.validation")
        return getattr(module, name)
    raise AttributeError(name)
