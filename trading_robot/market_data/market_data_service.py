"""Market data orchestration.

This service hides provider details from the strategy. Later phases can add
caching, data validation, broker time normalization, and gap detection here.
"""

from trading_robot.market_data.interfaces import MarketDataProvider
from trading_robot.types.enums import Timeframe
from trading_robot.types.models import MarketSnapshot


class MarketDataService:
    """Thin wrapper around a broker-neutral data provider."""

    def __init__(self, provider: MarketDataProvider) -> None:
        self._provider = provider

    def get_snapshot(self, symbol: str, timeframes: tuple[Timeframe, ...]) -> MarketSnapshot:
        """Fetch the multi-timeframe market snapshot used by the strategy."""

        return self._provider.get_snapshot(symbol=symbol, timeframes=timeframes)

