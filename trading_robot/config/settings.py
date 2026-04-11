"""Central configuration objects.

Configuration is intentionally broker- and symbol-aware. Nothing in this file
assumes Gold, NQ, forex, futures, or one venue. Later phases can load these
dataclasses from YAML, TOML, environment variables, or a secrets manager.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from trading_robot.types.enums import BrokerType, Timeframe


@dataclass(frozen=True)
class TimeframeConfig:
    """Defines the multi-timeframe decision stack used by the strategy engine."""

    regime_timeframe: Timeframe = Timeframe.H1
    structure_timeframe: Timeframe = Timeframe.M15
    execution_timeframe: Timeframe = Timeframe.M5


@dataclass(frozen=True)
class RiskConfig:
    """Global risk controls shared by live trading and backtesting."""

    max_risk_per_trade_pct: Decimal = Decimal("0.005")
    max_daily_loss_pct: Decimal = Decimal("0.02")
    max_trades_per_day: int = 5
    max_open_positions: int = 3
    max_loss_streak_before_cooldown: int = 3
    cooldown_minutes: int = 60


@dataclass(frozen=True)
class SessionConfig:
    """Session filter settings.

    Sessions are represented as names in Phase 1. Later phases should map them
    to exchange calendars, broker server time, holidays, and DST behavior.
    """

    enabled: bool = True
    allowed_sessions: tuple[str, ...] = ("london", "new_york")


@dataclass(frozen=True)
class NewsFilterConfig:
    """High-impact news lockout settings."""

    enabled: bool = True
    minutes_before_event: int = 30
    minutes_after_event: int = 30
    hard_block_minutes_after_event: int = 15
    currencies: tuple[str, ...] = ()


@dataclass(frozen=True)
class TrailingStopPreset:
    """Symbol-specific trailing stop behavior.

    Distances are expressed as R multiples so the same rules can work across
    forex, CFDs, metals, and futures once SymbolSpec is correctly populated.
    """

    symbol: str
    activation_r: Decimal = Decimal("1.5")
    trail_distance_r: Decimal = Decimal("1")
    step_r: Decimal = Decimal("0.25")


@dataclass(frozen=True)
class TradeManagementConfig:
    """Post-entry management settings."""

    partial_close_enabled: bool = True
    partial_close_at_r: Decimal = Decimal("1")
    partial_close_fraction: Decimal = Decimal("0.5")
    breakeven_enabled: bool = True
    breakeven_at_r: Decimal = Decimal("1")
    breakeven_offset_points: Decimal = Decimal("0")
    trailing_enabled: bool = True
    default_trailing_preset: TrailingStopPreset = field(
        default_factory=lambda: TrailingStopPreset(symbol="*")
    )
    trailing_presets: dict[str, TrailingStopPreset] = field(
        default_factory=lambda: {
            "XAUUSD": TrailingStopPreset(symbol="XAUUSD", activation_r=Decimal("1.2")),
            "GOLD": TrailingStopPreset(symbol="GOLD", activation_r=Decimal("1.2")),
            "NQ": TrailingStopPreset(symbol="NQ", activation_r=Decimal("1.5")),
            "NAS100": TrailingStopPreset(symbol="NAS100", activation_r=Decimal("1.5")),
            "US100": TrailingStopPreset(symbol="US100", activation_r=Decimal("1.5")),
            "US30": TrailingStopPreset(symbol="US30", activation_r=Decimal("1.5")),
            "BTCUSD": TrailingStopPreset(symbol="BTCUSD", activation_r=Decimal("1.8"), trail_distance_r=Decimal("1.2")),
        }
    )

    def get_trailing_preset(self, symbol: str) -> TrailingStopPreset:
        """Return the exact symbol preset or the default wildcard preset."""

        return self.trailing_presets.get(symbol, self.default_trailing_preset)


@dataclass(frozen=True)
class MarketStateConfig:
    """Multi-timeframe market-state analysis settings.

    Defaults are intentionally conservative and can be adjusted per symbol
    family without tying the engine to one market such as XAUUSD or NQ.
    """

    ema_fast_period: int = 50
    ema_slow_period: int = 200
    ema_close_threshold_pct: Decimal = Decimal("0.001")
    ema_flat_slope_threshold_pct: Decimal = Decimal("0.0005")
    ema_slope_lookback: int = 5
    structure_lookback: int = 6
    structure_tolerance_points: Decimal = Decimal("0")
    entry_average_lookback: int = 10
    entry_min_range_vs_average: Decimal = Decimal("1.1")
    entry_min_body_to_range: Decimal = Decimal("0.6")
    doji_body_to_range: Decimal = Decimal("0.25")
    atr_period: int = 14
    atr_average_lookback: int = 50
    volatility_low_ratio: Decimal = Decimal("0.75")
    volatility_high_ratio: Decimal = Decimal("1.5")
    gold_symbols: tuple[str, ...] = ("XAUUSD", "GOLD")
    index_symbols: tuple[str, ...] = ("NQ", "NAS100", "US100", "US30", "DJ30", "SPX", "US500")
    crypto_symbols: tuple[str, ...] = ("BTCUSD", "BTCUSDT")
    gold_structure_tolerance_points: Decimal = Decimal("50")
    index_entry_min_range_vs_average: Decimal = Decimal("1.25")
    index_entry_min_body_to_range: Decimal = Decimal("0.65")


@dataclass(frozen=True)
class PropProtectionConfig:
    """Prop-firm style protection rules.

    Defaults match the Phase 4 rules: 1.5% daily loss stop, 3 trades per day,
    and a 2-hour cooldown after 2 consecutive losses.
    """

    enabled: bool = True
    max_daily_loss_pct: Decimal = Decimal("0.015")
    daily_target_pct: Decimal = Decimal("0.03")
    max_trades_per_day: int = 3
    max_loss_streak_before_cooldown: int = 2
    cooldown_minutes: int = 120
    pause_after_big_win: bool = False
    big_win_pct: Decimal = Decimal("0.01")
    big_win_cooldown_minutes: int = 60


@dataclass(frozen=True)
class RiskAdaptationConfig:
    """Lightweight AI-style risk adaptation settings."""

    default_risk_pct: Decimal = Decimal("0.005")
    reduced_risk_pct: Decimal = Decimal("0.0025")
    increased_risk_pct: Decimal = Decimal("0.0075")
    max_risk_pct: Decimal = Decimal("0.0075")
    high_volatility_multiplier: Decimal = Decimal("0.5")
    drawdown_reduce_threshold_pct: Decimal = Decimal("0.03")
    drawdown_stop_threshold_pct: Decimal = Decimal("0.05")
    daily_target_pct: Decimal = Decimal("0.02")
    loss_streak_reduce_threshold: int = 2
    loss_streak_stop_threshold: int = 3
    win_streak_increase_threshold: int = 2
    underperformance_min_trades: int = 3
    underperformance_profit_threshold: Decimal = Decimal("-1")
    abnormal_volatility_blocks: bool = True
    confidence_floor: Decimal = Decimal("0.1")


@dataclass(frozen=True)
class BrokerConfig:
    """Execution venue selection.

    MT5 is the first intended live venue for Phase 2+. TopstepX/futures support
    is represented as a future adapter behind the same execution interface.
    """

    broker_type: BrokerType = BrokerType.MT5
    account_id: str | None = None
    server: str | None = None
    base_currency: str = "USD"


@dataclass(frozen=True)
class TopstepXConfig:
    """ProjectX/TopstepX gateway configuration.

    The TopstepX adapter uses the official ProjectX Gateway API. Credentials
    should be supplied from the live host, never committed to source control.
    """

    api_base_url: str = "https://api.thefuturesdesk.projectx.com"
    user_hub_url: str = "https://rtc.thefuturesdesk.projectx.com/hubs/user"
    market_hub_url: str = "https://rtc.thefuturesdesk.projectx.com/hubs/market"
    username: str | None = None
    api_key: str | None = None
    account_id: int | None = None
    account_name: str | None = None
    live: bool = False
    order_tag_prefix: str = "robotfx"
    prefer_micro_contracts: bool = True
    symbol_aliases: dict[str, tuple[str, ...]] = field(
        default_factory=lambda: {
            "NAS100": ("MNQ", "NQ"),
            "NQ": ("MNQ", "NQ"),
            "US30": ("MYM", "YM"),
            "YM": ("MYM", "YM"),
            "XAUUSD": ("MGC", "GC"),
            "GOLD": ("MGC", "GC"),
            "EURUSD": ("M6E", "6E"),
            "BTCUSD": ("MBT", "BTC"),
            "BTC": ("MBT", "BTC"),
        }
    )
    request_timeout_seconds: int = 10
    validate_token_on_connect: bool = True


@dataclass(frozen=True)
class StrategyConfig:
    """Strategy-level configuration.

    Symbols are supplied externally so the robot can run on any supported market
    whose contract specifications and data adapters are implemented.
    """

    symbols: tuple[str, ...] = ()
    timeframes: TimeframeConfig = field(default_factory=TimeframeConfig)
    minimum_setup_score: int = 7
    max_selected_trades: int = 2


@dataclass(frozen=True)
class BacktestConfig:
    """Research and backtesting configuration placeholder."""

    starting_equity: Decimal = Decimal("100000")
    commission_per_side: Decimal = Decimal("0")
    slippage_points: Decimal = Decimal("0")


@dataclass(frozen=True)
class ProductionConfig:
    """Live deployment controls for safety, retry, state, and monitoring."""

    live_trading_enabled: bool = False
    order_retries: int = 3
    retry_delay_seconds: Decimal = Decimal("0.25")
    state_file_path: str = "runtime/robot_state.json"
    log_file_path: str = "runtime/trading_robot.log"
    alert_webhook_url: str | None = None
    heartbeat_interval_seconds: int = 60
    reconnect_on_failure: bool = True
    persist_state_on_decision: bool = True


@dataclass(frozen=True)
class LiveOptimizationConfig:
    """Live performance optimization settings."""

    min_trades_for_analysis: int = 5
    weak_win_rate_threshold: Decimal = Decimal("0.40")
    weak_profit_factor_threshold: Decimal = Decimal("1.00")
    weak_average_r_threshold: Decimal = Decimal("0")
    threshold_increase_step: int = 1
    min_score_threshold: int = 6
    max_score_threshold: int = 9
    risk_reduction_factor: Decimal = Decimal("0.75")
    database_path: str = "runtime/live_trades.jsonl"


@dataclass(frozen=True)
class MonitoringConfig:
    """Dashboard, alerting, and remote-control settings."""

    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    alerts_enabled: bool = True
    commands_enabled: bool = True
    dashboard_enabled: bool = True
    operations_log_path: str = "runtime/operations_log.jsonl"


@dataclass(frozen=True)
class SystemConfig:
    """Top-level configuration passed into the application container."""

    broker: BrokerConfig = field(default_factory=BrokerConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    trade_management: TradeManagementConfig = field(default_factory=TradeManagementConfig)
    market_state: MarketStateConfig = field(default_factory=MarketStateConfig)
    prop_protection: PropProtectionConfig = field(default_factory=PropProtectionConfig)
    risk_adaptation: RiskAdaptationConfig = field(default_factory=RiskAdaptationConfig)
    session: SessionConfig = field(default_factory=SessionConfig)
    news: NewsFilterConfig = field(default_factory=NewsFilterConfig)
    backtest: BacktestConfig = field(default_factory=BacktestConfig)
    production: ProductionConfig = field(default_factory=ProductionConfig)
    live_optimization: LiveOptimizationConfig = field(default_factory=LiveOptimizationConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    topstepx: TopstepXConfig = field(default_factory=TopstepXConfig)
