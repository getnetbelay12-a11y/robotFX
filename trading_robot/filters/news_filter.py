"""News filter.

The filter accepts manually supplied or API-provided economic-calendar events.
It performs no heavy calls on tick; callers pass the already-fetched event list
for live or backtest use.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from trading_robot.config.settings import NewsFilterConfig
from trading_robot.types.enums import EntryReadiness, NewsLockState, StructureState, VolatilityState
from trading_robot.types.models import MarketState, NewsDecision, NewsEvent


class NewsFilter:
    """Validates whether a symbol is tradable around scheduled news."""

    def __init__(self, config: NewsFilterConfig) -> None:
        self._config = config

    def is_news_time(
        self,
        symbol: str,
        timestamp: datetime,
        events: tuple[NewsEvent, ...] = (),
        market_state: MarketState | None = None,
    ) -> bool:
        """IsNewsTime: return true when the current timestamp should block trading."""

        return self.evaluate_news_window(
            symbol=symbol,
            timestamp=timestamp,
            events=events,
            market_state=market_state,
        ).news_blocked

    def evaluate_news_window(
        self,
        symbol: str,
        timestamp: datetime,
        events: tuple[NewsEvent, ...] = (),
        market_state: MarketState | None = None,
    ) -> NewsDecision:
        """Return news permission including post-news confirmation mode."""

        if not self._config.enabled:
            return NewsDecision(news_blocked=False, state=NewsLockState.CLEAR, reason="news filter disabled")

        for event in self._relevant_events(events):
            block_start = event.timestamp - timedelta(minutes=self._config.minutes_before_event)
            hard_block_end = event.timestamp + timedelta(minutes=self._config.hard_block_minutes_after_event)
            post_news_end = event.timestamp + timedelta(minutes=self._config.minutes_after_event)

            if block_start <= timestamp <= hard_block_end:
                return NewsDecision(
                    news_blocked=True,
                    state=NewsLockState.LOCKED,
                    reason=f"inside news lock window for {event.title}",
                    event=event,
                )

            if hard_block_end < timestamp <= post_news_end:
                if self._post_news_confirmed(market_state):
                    return NewsDecision(
                        news_blocked=False,
                        state=NewsLockState.POST_NEWS,
                        reason="post-news volatility and structure confirmed",
                        event=event,
                    )
                return NewsDecision(
                    news_blocked=True,
                    state=NewsLockState.POST_NEWS,
                    reason="post-news confirmation not formed",
                    event=event,
                )

        return NewsDecision(news_blocked=False, state=NewsLockState.CLEAR, reason="no active news lock")

    def validate_news_window(
        self,
        symbol: str,
        timestamp: datetime,
        events: tuple[NewsEvent, ...] = (),
        market_state: MarketState | None = None,
    ) -> NewsLockState:
        """ValidateNewsWindow compatibility method returning enum state."""

        return self.evaluate_news_window(
            symbol=symbol,
            timestamp=timestamp,
            events=events,
            market_state=market_state,
        ).state

    def _relevant_events(self, events: tuple[NewsEvent, ...]) -> tuple[NewsEvent, ...]:
        """Filter events by configured currencies when provided."""

        if not self._config.currencies:
            return events
        currencies = {currency.upper() for currency in self._config.currencies}
        return tuple(event for event in events if event.currency.upper() in currencies)

    def _post_news_confirmed(self, market_state: MarketState | None) -> bool:
        """Post-news mode requires volatility expansion and renewed structure."""

        if market_state is None:
            return False
        structure_formed = market_state.structure in {StructureState.TRENDING_UP, StructureState.TRENDING_DOWN}
        volatility_expanded = market_state.volatility == VolatilityState.HIGH
        entry_ready = market_state.entry_ready == EntryReadiness.READY
        return structure_formed and volatility_expanded and entry_ready

    def IsNewsTime(
        self,
        symbol: str,
        timestamp: datetime,
        events: tuple[NewsEvent, ...] = (),
        market_state: MarketState | None = None,
    ) -> bool:
        """Compatibility method using the requested PascalCase name."""

        return self.is_news_time(symbol=symbol, timestamp=timestamp, events=events, market_state=market_state)

    def ValidateNewsWindow(
        self,
        symbol: str,
        timestamp: datetime,
        events: tuple[NewsEvent, ...] = (),
        market_state: MarketState | None = None,
    ) -> NewsLockState:
        """Compatibility method using the requested PascalCase name."""

        return self.validate_news_window(
            symbol=symbol,
            timestamp=timestamp,
            events=events,
            market_state=market_state,
        )
