"""Final trading permission engine.

`PermissionEngine` composes the session filter, news filter, and prop-firm
protection rules into one lightweight `CanTrade()` decision. It accepts a
precomputed market state and preloaded news events so no heavy external API calls
are needed during `OnTick`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from trading_robot.filters.news_filter import NewsFilter
from trading_robot.filters.prop_protection import PropProtection
from trading_robot.filters.session_filter import SessionFilter
from trading_robot.journal.logger import TradingLogger
from trading_robot.state.robot_state import RobotState
from trading_robot.types.models import AccountSnapshot, MarketState, NewsEvent, TradePermission


@dataclass(frozen=True)
class _PermissionCacheKey:
    """Small cache key for repeated ticks in the same minute."""

    symbol: str
    minute: datetime
    daily_pnl: object
    daily_trade_count: int
    loss_streak: int
    cooldown_until: object | None
    market_state_key: object | None


class PermissionEngine:
    """Composes timing, news, cooldown, and prop-rule permissions."""

    def __init__(
        self,
        session_filter: SessionFilter,
        news_filter: NewsFilter,
        prop_protection: PropProtection,
        logger: TradingLogger | None = None,
    ) -> None:
        self._session_filter = session_filter
        self._news_filter = news_filter
        self._prop_protection = prop_protection
        self._logger = logger or TradingLogger()
        self._cache: dict[_PermissionCacheKey, TradePermission] = {}

    def can_trade(
        self,
        symbol: str,
        timestamp: datetime,
        account: AccountSnapshot,
        state: RobotState,
        market_state: MarketState | None = None,
        events: tuple[NewsEvent, ...] = (),
    ) -> TradePermission:
        """Return final trading permission for the current tick."""

        cache_key = self._cache_key(symbol=symbol, timestamp=timestamp, state=state, market_state=market_state)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        session = self._session_filter.evaluate_session(timestamp=timestamp)
        news = self._news_filter.evaluate_news_window(
            symbol=symbol,
            timestamp=timestamp,
            events=events,
            market_state=market_state,
        )
        prop = self._prop_protection.evaluate(account=account, state=state, timestamp=timestamp)

        reasons = tuple(
            reason
            for reason in (session.reason, news.reason, prop.reason)
            if reason
        )
        can_trade = session.session_valid and not news.news_blocked and not prop.cooldown_active and prop.prop_safe
        permission = TradePermission(
            session_valid=session.session_valid,
            news_blocked=news.news_blocked,
            cooldown_active=prop.cooldown_active,
            prop_safe=prop.prop_safe,
            can_trade=can_trade,
            reasons=reasons,
            session_quality=session.quality,
            news_state=news.state,
            active_session=session.active_session,
        )

        if can_trade:
            self._logger.info("trading allowed", symbol=symbol, reasons=reasons)
        else:
            self._logger.warning("trading blocked", symbol=symbol, reasons=reasons)

        self._cache = {cache_key: permission}
        return permission

    def _cache_key(
        self,
        symbol: str,
        timestamp: datetime,
        state: RobotState,
        market_state: MarketState | None,
    ) -> _PermissionCacheKey:
        """Build a cache key that changes when permission inputs change."""

        minute = timestamp.replace(second=0, microsecond=0)
        return _PermissionCacheKey(
            symbol=symbol,
            minute=minute,
            daily_pnl=state.daily_pnl,
            daily_trade_count=state.daily_trade_count,
            loss_streak=state.loss_streak,
            cooldown_until=state.cooldown_until,
            market_state_key=market_state.metadata.get("cache_key") if market_state is not None else None,
        )

    def CanTrade(
        self,
        symbol: str,
        timestamp: datetime,
        account: AccountSnapshot,
        state: RobotState,
        market_state: MarketState | None = None,
        events: tuple[NewsEvent, ...] = (),
    ) -> TradePermission:
        """Compatibility method using the requested PascalCase name."""

        return self.can_trade(
            symbol=symbol,
            timestamp=timestamp,
            account=account,
            state=state,
            market_state=market_state,
            events=events,
        )
