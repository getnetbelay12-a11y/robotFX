"""Master signal generation from StrategyEngine signals."""

from __future__ import annotations

from decimal import Decimal

from trading_robot.accounts.models import MasterTradeSignal
from trading_robot.types.models import TradeSignal


class MasterSignalEngine:
    """Centralizes normalized signal output for all execution platforms."""

    def generate_trade_signal(self, signal: TradeSignal, default_risk_pct: Decimal = Decimal("0.005")) -> MasterTradeSignal | None:
        """GenerateTradeSignal from a StrategyEngine TradeSignal."""

        if signal.side is None or signal.entry_price is None or signal.stop_loss is None or signal.take_profit is None:
            return None
        strategy_type = str(signal.metadata.get("strategy_type", "unknown"))
        signal_id = self._signal_id(signal)
        risk_pct = min(default_risk_pct, Decimal("0.005"))
        return MasterTradeSignal(
            symbol=signal.symbol,
            direction=signal.side,
            entry=signal.entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            risk_pct=risk_pct,
            strategy_type=strategy_type,
            signal_id=signal_id,
        )

    def _signal_id(self, signal: TradeSignal) -> str:
        """Build stable duplicate-control signal ID."""

        return "|".join(
            str(part)
            for part in (
                signal.symbol,
                signal.side,
                signal.entry_price,
                signal.stop_loss,
                signal.take_profit,
                signal.metadata.get("strategy_type", "unknown"),
            )
        )

    def GenerateTradeSignal(self, signal: TradeSignal, default_risk_pct: Decimal = Decimal("0.005")) -> MasterTradeSignal | None:
        """Compatibility method using the requested PascalCase name."""

        return self.generate_trade_signal(signal=signal, default_risk_pct=default_risk_pct)

