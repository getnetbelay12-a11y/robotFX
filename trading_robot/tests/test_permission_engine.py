"""Tests for Phase 4 session, news, and prop protection permissions."""

from datetime import datetime, timedelta
from decimal import Decimal
import unittest

from trading_robot.config import NewsFilterConfig, PropProtectionConfig, SessionConfig
from trading_robot.filters import NewsFilter, PermissionEngine, PropProtection, SessionFilter
from trading_robot.state import RobotState
from trading_robot.types import (
    AccountSnapshot,
    EntryReadiness,
    MarketState,
    MarketStateDecision,
    NewsEvent,
    NewsLockState,
    PropProtectionState,
    Regime,
    SessionQuality,
    SessionState,
    StructureState,
    VolatilityState,
)


class PermissionEngineTests(unittest.TestCase):
    """Validates session, news, prop, and final permission behavior."""

    def setUp(self) -> None:
        self.session_filter = SessionFilter(SessionConfig())
        self.news_filter = NewsFilter(NewsFilterConfig())
        self.prop = PropProtection(PropProtectionConfig())
        self.engine = PermissionEngine(
            session_filter=self.session_filter,
            news_filter=self.news_filter,
            prop_protection=self.prop,
        )
        self.account = AccountSnapshot(equity=Decimal("100000"), balance=Decimal("100000"))
        self.market_state = MarketState(
            symbol="EURUSD",
            regime=Regime.BULLISH,
            structure=StructureState.TRENDING_UP,
            volatility=VolatilityState.HIGH,
            entry_ready=EntryReadiness.READY,
            trade_allowed=MarketStateDecision.TRADE_ALLOWED,
        )

    def test_session_filter_london_and_new_york_quality(self) -> None:
        london = self.session_filter.evaluate_session(datetime(2026, 4, 10, 8, 0))
        new_york = self.session_filter.evaluate_session(datetime(2026, 4, 10, 14, 0))
        late_london = self.session_filter.evaluate_session(datetime(2026, 4, 10, 11, 0))
        closed = self.session_filter.evaluate_session(datetime(2026, 4, 10, 23, 0))

        self.assertTrue(london.session_valid)
        self.assertEqual(london.quality, SessionQuality.HIGH)
        self.assertTrue(new_york.session_valid)
        self.assertEqual(new_york.quality, SessionQuality.HIGH)
        self.assertEqual(late_london.quality, SessionQuality.NORMAL)
        self.assertFalse(closed.session_valid)
        self.assertEqual(closed.state, SessionState.CLOSED)

    def test_news_filter_blocks_before_during_and_hard_after_news(self) -> None:
        event = NewsEvent(
            event_id="nfp",
            timestamp=datetime(2026, 4, 10, 13, 30),
            currency="USD",
            impact="high",
            title="NFP",
        )

        before = self.news_filter.evaluate_news_window("EURUSD", datetime(2026, 4, 10, 13, 5), (event,), self.market_state)
        during = self.news_filter.evaluate_news_window("EURUSD", datetime(2026, 4, 10, 13, 30), (event,), self.market_state)
        after = self.news_filter.evaluate_news_window("EURUSD", datetime(2026, 4, 10, 13, 40), (event,), self.market_state)

        self.assertTrue(before.news_blocked)
        self.assertEqual(before.state, NewsLockState.LOCKED)
        self.assertTrue(during.news_blocked)
        self.assertTrue(after.news_blocked)

    def test_post_news_requires_volatility_and_structure_confirmation(self) -> None:
        event = NewsEvent(
            event_id="cpi",
            timestamp=datetime(2026, 4, 10, 13, 30),
            currency="USD",
            impact="high",
            title="CPI",
        )
        timestamp = datetime(2026, 4, 10, 13, 50)
        confirmed = self.news_filter.evaluate_news_window("EURUSD", timestamp, (event,), self.market_state)
        weak_state = MarketState(
            symbol="EURUSD",
            regime=Regime.BULLISH,
            structure=StructureState.RANGE,
            volatility=VolatilityState.NORMAL,
            entry_ready=EntryReadiness.NOT_READY,
            trade_allowed=MarketStateDecision.NO_TRADE,
        )
        blocked = self.news_filter.evaluate_news_window("EURUSD", timestamp, (event,), weak_state)

        self.assertFalse(confirmed.news_blocked)
        self.assertEqual(confirmed.state, NewsLockState.POST_NEWS)
        self.assertTrue(blocked.news_blocked)

    def test_prop_protection_blocks_daily_loss_target_trades_and_loss_streak(self) -> None:
        state = RobotState(daily_pnl=Decimal("-1500"), trading_day=datetime(2026, 4, 10).date())
        daily_loss = self.prop.evaluate(self.account, state, datetime(2026, 4, 10, 14, 0))

        self.assertFalse(daily_loss.prop_safe)
        self.assertEqual(daily_loss.state, PropProtectionState.VIOLATED)

        state = RobotState(daily_pnl=Decimal("3000"), trading_day=datetime(2026, 4, 10).date())
        daily_target = self.prop.evaluate(self.account, state, datetime(2026, 4, 10, 14, 0))
        self.assertFalse(daily_target.prop_safe)
        self.assertEqual(daily_target.reason, "daily profit target reached")

        state = RobotState(daily_trade_count=3, trading_day=datetime(2026, 4, 10).date())
        trade_count = self.prop.evaluate(self.account, state, datetime(2026, 4, 10, 14, 0))
        self.assertFalse(trade_count.prop_safe)
        self.assertEqual(trade_count.reason, "prop max trades per day reached")

        state = RobotState(loss_streak=2, trading_day=datetime(2026, 4, 10).date())
        cooldown = self.prop.evaluate(self.account, state, datetime(2026, 4, 10, 14, 0))
        self.assertFalse(cooldown.prop_safe)
        self.assertTrue(cooldown.cooldown_active)
        self.assertEqual(state.cooldown_until, datetime(2026, 4, 10, 16, 0))

    def test_can_trade_output_allows_and_blocks(self) -> None:
        allowed = self.engine.can_trade(
            symbol="EURUSD",
            timestamp=datetime(2026, 4, 10, 14, 0),
            account=self.account,
            state=RobotState(trading_day=datetime(2026, 4, 10).date()),
            market_state=self.market_state,
        )

        self.assertTrue(allowed.can_trade)
        self.assertEqual(
            allowed.as_output(),
            {
                "sessionValid": True,
                "newsBlocked": False,
                "cooldownActive": False,
                "propSafe": True,
                "canTrade": True,
            },
        )

        blocked = self.engine.can_trade(
            symbol="EURUSD",
            timestamp=datetime(2026, 4, 10, 23, 0),
            account=self.account,
            state=RobotState(trading_day=datetime(2026, 4, 10).date()),
            market_state=self.market_state,
        )

        self.assertFalse(blocked.can_trade)
        self.assertFalse(blocked.session_valid)

    def test_big_win_optional_pause(self) -> None:
        prop = PropProtection(PropProtectionConfig(pause_after_big_win=True, big_win_pct=Decimal("0.01")))
        state = RobotState(trading_day=datetime(2026, 4, 10).date())

        prop.apply_trade_outcome(
            pnl=Decimal("1000"),
            account=self.account,
            state=state,
            timestamp=datetime(2026, 4, 10, 14, 0),
        )

        self.assertEqual(state.cooldown_until, datetime(2026, 4, 10, 15, 0))


if __name__ == "__main__":
    unittest.main()

