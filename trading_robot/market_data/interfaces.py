"""Market data provider interfaces."""

from abc import ABC, abstractmethod

from trading_robot.types.enums import Timeframe
from trading_robot.types.models import Bar, MarketSnapshot, SymbolSpec


class MarketDataProvider(ABC):
    """Interface for MT5, futures, CSV, or research data providers."""

    @abstractmethod
    def get_symbol_spec(self, symbol: str) -> SymbolSpec:
        """Return contract metadata for a symbol."""

    @abstractmethod
    def get_bars(self, symbol: str, timeframe: Timeframe, limit: int) -> list[Bar]:
        """Return historical bars for the requested symbol and timeframe."""

    @abstractmethod
    def get_snapshot(self, symbol: str, timeframes: tuple[Timeframe, ...]) -> MarketSnapshot:
        """Return a normalized market snapshot for strategy evaluation."""

