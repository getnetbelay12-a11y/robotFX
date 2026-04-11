"""Backtest statistics and reporting models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class TradeRecord:
    """One closed backtest trade."""

    timestamp: datetime
    symbol: str
    strategy_type: str
    entry: Decimal
    exit: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    r_result: Decimal
    pnl: Decimal
    session: str = "unknown"
    news_condition: str = "clear"
    volatility: str = "unknown"


@dataclass
class BacktestStats:
    """Performance metric accumulator for backtests and optimization."""

    starting_equity: Decimal = Decimal("100000")
    trades: int = 0
    wins: int = 0
    losses: int = 0
    gross_profit: Decimal = Decimal("0")
    gross_loss: Decimal = Decimal("0")
    net_pnl: Decimal = Decimal("0")
    max_drawdown: Decimal = Decimal("0")
    equity_curve: list[Decimal] = field(default_factory=list)
    drawdown_curve: list[Decimal] = field(default_factory=list)
    trade_distribution: dict[str, int] = field(default_factory=dict)
    session_pnl: dict[str, Decimal] = field(default_factory=dict)
    volatility_pnl: dict[str, Decimal] = field(default_factory=dict)
    near_news_trades: int = 0
    records: list[TradeRecord] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.equity_curve:
            self.equity_curve.append(self.starting_equity)
            self.drawdown_curve.append(Decimal("0"))

    @property
    def win_rate(self) -> Decimal:
        """Return win rate as a decimal fraction."""

        if self.trades == 0:
            return Decimal("0")
        return Decimal(self.wins) / Decimal(self.trades)

    @property
    def profit_factor(self) -> Decimal:
        """Return gross profit divided by absolute gross loss."""

        if self.gross_loss == 0:
            return Decimal("0") if self.gross_profit == 0 else Decimal("999")
        return self.gross_profit / abs(self.gross_loss)

    @property
    def average_r(self) -> Decimal:
        """Return average R result per trade."""

        if self.trades == 0:
            return Decimal("0")
        return sum((record.r_result for record in self.records), Decimal("0")) / Decimal(self.trades)

    @property
    def best_session(self) -> str:
        """Return the best session by net P&L."""

        if not self.session_pnl:
            return "unknown"
        return max(self.session_pnl.items(), key=lambda item: item[1])[0]

    @property
    def worst_session(self) -> str:
        """Return the worst session by net P&L."""

        if not self.session_pnl:
            return "unknown"
        return min(self.session_pnl.items(), key=lambda item: item[1])[0]

    def record_trade(self, pnl: Decimal, record: TradeRecord | None = None) -> None:
        """Record one closed trade for future reporting."""

        self.trades += 1
        self.net_pnl += pnl
        if pnl > 0:
            self.wins += 1
            self.gross_profit += pnl
        elif pnl < 0:
            self.losses += 1
            self.gross_loss += pnl

        if record is None:
            record = TradeRecord(
                timestamp=datetime.utcnow(),
                symbol="unknown",
                strategy_type="unknown",
                entry=Decimal("0"),
                exit=Decimal("0"),
                stop_loss=Decimal("0"),
                take_profit=Decimal("0"),
                r_result=Decimal("0"),
                pnl=pnl,
            )
        self.records.append(record)
        self.trade_distribution[record.strategy_type] = self.trade_distribution.get(record.strategy_type, 0) + 1
        self.session_pnl[record.session] = self.session_pnl.get(record.session, Decimal("0")) + pnl
        self.volatility_pnl[record.volatility] = self.volatility_pnl.get(record.volatility, Decimal("0")) + pnl
        if record.news_condition != "clear":
            self.near_news_trades += 1

        equity = self.starting_equity + self.net_pnl
        self.equity_curve.append(equity)
        peak = max(self.equity_curve)
        drawdown = peak - equity
        self.drawdown_curve.append(drawdown)
        self.max_drawdown = max(self.max_drawdown, drawdown)

    def as_report(self) -> dict[str, Any]:
        """Return a serializable result summary."""

        return {
            "total_trades": self.trades,
            "win_rate": self.win_rate,
            "profit_factor": self.profit_factor,
            "max_drawdown": self.max_drawdown,
            "average_r": self.average_r,
            "best_session": self.best_session,
            "worst_session": self.worst_session,
            "near_news_trades": self.near_news_trades,
            "equity_curve": tuple(self.equity_curve),
            "drawdown_curve": tuple(self.drawdown_curve),
            "trade_distribution": dict(self.trade_distribution),
            "volatility_pnl": dict(self.volatility_pnl),
        }

