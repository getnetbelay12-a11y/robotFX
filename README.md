# Professional Trading Robot

Phase 12 is a production-style scaffold for a symbol-aware trading robot. It prepares the project for MetaTrader 5 execution, future Exness deployment on MT5, a later TopstepX/futures adapter, strict risk management, adaptive risk control, live performance optimization, news/session filtering, setup scoring, strategy execution, multi-account copying, research, optimization, and backtesting.

This phase implements broker-neutral risk sizing, post-entry trade management, market-state intelligence, a final session/news/prop permission engine, a 0-10 setup scoring and trade selection engine, two entry strategies, an MT5 Expert Advisor execution engine, deterministic backtesting plus optimization tooling, a multi-account cross-platform execution system, lightweight AI-style risk adaptation, production deployment hardening, and a live performance optimization system.

## Architecture

```text
mql5/                  MT5 Expert Advisor execution engine
trading_robot/
  accounts/            Master signals, account manager, adapters, trade copier
  config/              Central configuration dataclasses
  types/               Broker-neutral enums and domain models
  market_data/         Market data provider interfaces and services
    market_state_engine.py
  operations/          Dashboard, alerts, Telegram, and remote control
  filters/             SessionFilter, NewsFilter, PropProtection, PermissionEngine
  risk/                RiskManager, RiskAdaptationEngine, and risk decision objects
  scoring/             SetupScorer and TradeSelectionEngine
  trade_management/    TradeManager for partials, breakeven, and trailing stops
  execution/           ExecutionRouter plus broker adapter interfaces
    mt5/               MetaTrader 5 Python-side placeholder adapter
    topstepx/          Future TopstepX/futures adapter
  strategy/            StrategyEngine orchestration layer
  journal/             Logger and future audit journal
  backtesting/         BacktestEngine, OptimizationEngine, reporting, and stats
  state/               Central RobotState runtime object
  research/            Live optimization, trade database, and research utilities
  utils/               Shared utility placeholder
  tests/               Scaffold smoke tests
```

## Core Flow

1. `MarketDataService` receives normalized symbol data from a `MarketDataProvider`.
2. `StrategyEngine` evaluates the multi-timeframe stack:
   - H1 regime through `detect_trend()`
   - M15 structure through `detect_structure()`
   - M5 execution context reserved for later entry logic
3. `MarketStateEngine` analyzes H1 regime, M15 structure, M5 entry readiness, and M5 ATR volatility.
4. `PermissionEngine` runs `CanTrade()` using session, news, cooldown, and prop protection checks.
5. `SetupScorer` runs `score_setup()` and returns a 0-10 setup score.
6. `TradeSelectionEngine` can rank multiple symbols and select only the best one or two valid setups.
7. `StrategyEngine` detects liquidity sweep reversal or breakout plus retest entries.
8. `RiskAdaptationEngine` runs `AdjustRisk()` using streaks, daily P&L, drawdown, volatility, session performance, and strategy performance.
9. `RiskManager` runs `calculate_risk()` and enforces adapted risk per trade, daily loss cap, max trades per day, max open positions, and loss-streak cooldown.
10. `ExecutionRouter` sends approved `OrderRequest` objects to the configured `ExecutionClient` or the MQL5 bridge layer.
11. `MasterSignalEngine` normalizes StrategyEngine output into one shared signal format.
12. `TradeCopier` distributes that signal to active accounts through platform adapters.
13. `TradeManager` manages open positions through 1R partial close, 1R breakeven, and symbol-specific trailing-stop presets.
14. `BacktestEngine` can replay historical bars for deterministic research and optimization.
15. `TradingLogger` and future journal storage record decisions, orders, fills, modifications, scoring, permission decisions, and adaptation decisions.

## Market State Engine

`MarketStateEngine` returns a structured market-state object:

```python
{
    "symbol": symbol,
    "regime": regime,
    "structure": structure,
    "volatility": volatility,
    "entryReady": entry_ready,
    "tradeAllowed": trade_allowed,
}
```

Rules:

- H1 regime uses EMA 50 and EMA 200: bullish, bearish, or sideways.
- M15 structure detects higher highs/lows, lower highs/lows, or range.
- M5 entry readiness checks current candle size against recent average range and rejects doji/weak candles.
- Volatility uses ATR versus historical ATR average: high, normal, or low.
- Trading is blocked when regime is sideways, structure is range, volatility is low, or M5 is not ready.
- Gold symbols tolerate short-term structure breaks by allowing range structure when H1 and M5 are valid.
- Index symbols such as NQ and US30 use stricter M5 momentum thresholds.
- Results are cached by symbol and latest H1/M15/M5 candle timestamps for efficient `OnTick` execution.

## Central State

`RobotState` tracks:

- current symbol
- current regime
- daily P&L
- open positions
- daily trade count
- trading day
- loss streak
- win streak
- cooldown state
- session state
- news lock state

The state object is intentionally small and serializable. Later phases should persist critical state through the journal/database layer for restart safety.

## Execution Design

Execution is isolated behind `ExecutionClient`.

`MT5ExecutionClient` is the placeholder for MetaTrader 5 native order execution and future Exness MT5 deployment. MT5 SDK-specific code should stay inside `trading_robot/execution/mt5/`.

`TopstepXExecutionClient` is the placeholder for a future TopstepX/futures adapter. Authentication, contract mapping, futures-specific rules, and REST/WebSocket routing should stay inside `trading_robot/execution/topstepx/`.

The strategy, risk, scoring, and trade-management modules should never import broker SDKs directly.

## MT5 Execution Engine

Phase 7 adds [ProfessionalTradingRobotEA.mq5](mql5/ProfessionalTradingRobotEA.mq5), a clean MQL5 Expert Advisor execution layer.

Core functions:

- `ExecuteTrade(symbol, direction, entryPrice, stopLoss, takeProfit, lots)`
- `SubmitSignal(...)`
- `IsPositionOpen(symbol)`
- `GetOpenPositions()`
- `ManageOpenPositions()`
- `MoveToBreakeven(ticket)`
- `PartialClose(ticket, fraction)`
- `TrailStop(ticket)`

Execution behavior:

- Uses `CTrade.Buy()` and `CTrade.Sell()`, which wrap MT5 order placement.
- Uses raw `OrderSend()` as an optional fallback after limited `CTrade` retry failures.
- Accepts lot size from the already-approved risk calculation.
- Applies slippage control through `SetDeviationInPoints()`.
- Checks symbol availability with `SymbolSelect()`.
- Blocks duplicate trades on the same symbol and magic number.
- Blocks orders when max open trades is reached.
- Blocks orders when spread exceeds `InpMaxSpreadPoints`.
- Retries limited failures such as requotes, price changes, price off, and timeouts.
- Returns `success`, `ticket`, and `errorMessage` through the `ExecutionResult` struct.

OnTick management:

- Tracks open positions by magic number and ticket.
- Stores original stop-loss per ticket in terminal global variables.
- Moves SL to breakeven at 1R.
- Partially closes 50% once at 1R.
- Starts trailing at 1.2R for Gold and 1.5R for indices.
- Supports fixed-distance, ATR-based, and swing high/low trailing candidates.
- Logs order placement, SL/TP, partial closes, trailing updates, and errors.

The Python [ExecutionRouter](trading_robot/execution/router.py) now also exposes `ExecuteTrade()` as an alias for broker-neutral routing.

## Symbol Awareness

The project uses `SymbolSpec` for contract metadata:

- symbol
- base and quote currency
- tick size
- tick value
- minimum volume
- volume step
- maximum volume
- metadata

Risk and execution logic should use `SymbolSpec` instead of hardcoded assumptions about Gold, NQ, forex, CFDs, or futures.

## Risk Management

`RiskManager` is broker-neutral and backtest-friendly. It calculates volume from:

- account equity
- configured `max_risk_per_trade_pct`
- entry price
- stop-loss distance
- symbol tick size
- symbol tick value
- symbol min/max volume
- symbol volume step

It blocks new trades when:

- daily loss cap is reached
- max trades per day is reached
- max open positions is reached
- cooldown is active
- consecutive loss threshold is reached
- required signal, price, stop, or symbol metadata is missing

`RiskAdaptationEngine` returns the Phase 10 dynamic-risk output:

```python
{
    "adjustedRisk": adjusted_risk,
    "tradingAllowed": trading_allowed,
    "reason": reason,
    "confidenceLevel": confidence_level,
}
```

Adaptation rules:

- default risk is `0.5%`
- after 2 losses, risk reduces to `0.25%`
- after 3 losses, trading is stopped by cooldown logic
- after 2 wins, risk can increase to `0.75%`
- high volatility reduces risk by the configured volatility multiplier
- drawdown above the reduce threshold cuts risk, and drawdown above the stop threshold blocks trading
- daily target hit blocks trading for the day
- underperforming London/NY session buckets reduce risk
- underperforming sweep or breakout strategy buckets reduce risk

`StrategyEngine` attaches the adaptation decision to each actionable signal, and `RiskManager` uses it to cap position size or block execution before broker routing. The logic is intentionally lightweight and deterministic so it remains compatible with backtests and MT5 Strategy Tester-style workflows.

## Trade Management

`TradeManager` runs after entry and stays behind the `ExecutionClient` interface so live trading and backtesting can share the same behavior.

Implemented management hooks:

- partial close at configured 1R threshold
- breakeven stop move at configured 1R threshold
- trailing stop framework using `TrailingStopPreset`
- exact symbol trailing presets with a default wildcard preset

The manager records applied management steps in `Position.metadata` to avoid repeating one-time actions such as the 1R partial close and breakeven move.

## Permission Engine

`PermissionEngine` returns the final Phase 4 gate:

```python
{
    "sessionValid": session_valid,
    "newsBlocked": news_blocked,
    "cooldownActive": cooldown_active,
    "propSafe": prop_safe,
    "canTrade": can_trade,
}
```

Session rules:

- London: 07:00 to 16:00 UTC
- New York: 13:00 to 22:00 UTC
- London open quality: 07:00 to 10:00 UTC is high
- New York open quality: 13:00 to 16:00 UTC is high
- Other valid session times are normal quality

News rules:

- Blocks 30 minutes before scheduled news
- Blocks during the event timestamp
- Blocks the first 15 minutes after news
- From 15 to 30 minutes after news, trading is allowed only when volatility is high, M15 structure has formed again, and M5 entry readiness is ready
- Calendar events can be supplied manually or by a future API adapter; the filter does not fetch data on every tick

Prop protection rules:

- Stop trading if daily loss reaches 1.5%
- Stop trading after daily target is hit
- Max trades per day is 3
- Stop after 2 consecutive losses
- Cooldown after 2 losses is 2 hours
- Optional big-win pause is available in `PropProtectionConfig`

`PermissionEngine` caches by symbol, minute, market-state key, and current state counters so repeated `OnTick` calls avoid repeated work.

## Setup Scoring

`SetupScorer` returns:

```python
{
    "symbol": symbol,
    "score": score,
    "valid": valid,
    "reason": reason,
    "priorityRank": priority_rank,
}
```

Scoring is 0 to 10:

- H1 trend alignment: +2
- M15 structure alignment: +2
- M5 strong entry candle: +2
- London/New York open quality: +2
- acceptable volatility: +1
- no active cooldown / recent-loss block: +1

Minimum valid score is 7.

Symbol-specific adjustments:

- Gold emphasizes volatility and can receive partial structure credit for high-volatility reversal context.
- NQ and indices emphasize trend and breakout quality.
- Forex emphasizes clean M15 structure.

Penalties:

- near recent news
- spread above optional `SymbolSpec.metadata["max_spread_points"]`
- weak M5 candle
- choppy/range M15 structure

`TradeSelectionEngine` scores all available candidates, sorts them by score descending, assigns `priorityRank`, rejects below-threshold setups, and selects only the top one or two valid setups.

## Strategy Engine

`StrategyEngine` now detects two entry families:

- Liquidity sweep reversal
- Breakout plus retest

Pattern methods:

- `DetectLiquiditySweep()`
- `DetectRejection()`
- `DetectEngulfing()`
- `DetectBreakout()`
- `DetectRetest()`
- `DetectMomentumCandle()`

Liquidity sweep reversal:

- Buy: price sweeps below previous lows, sweep candle rejects with a long lower wick, next candle confirms with bullish engulfing.
- Sell: price sweeps above previous highs, sweep candle rejects with a long upper wick, next candle confirms with bearish engulfing.
- Stop-loss is placed one tick beyond the sweep candle.

Breakout plus retest:

- Buy: candle breaks above resistance, pullback retests the broken level, next candle confirms with bullish momentum.
- Sell: candle breaks below support, pullback retests the broken level, next candle confirms with bearish momentum.
- Stop-loss is placed one tick beyond the retest level.

Symbol routing:

- `XAUUSD` / Gold prioritizes liquidity sweep reversal.
- `NQ`, `NAS100`, `US100`, and index symbols prioritize breakout plus retest.
- Other symbols allow both strategies but require one extra setup score point.

Trade signal output:

```python
{
    "symbol": symbol,
    "direction": direction,
    "entryPrice": entry_price,
    "stopLoss": stop_loss,
    "takeProfit": take_profit,
    "strategyType": strategy_type,
}
```

Take-profit and management metadata:

- TP1 is set at 1R for 50% partial close.
- TP2 is represented as a runner managed by trailing stop logic.
- Breakeven is enabled at 1R.
- Gold trailing activation defaults to 1.2R.
- Index trailing activation defaults to 1.5R.
- Duplicate signals are suppressed using symbol, direction, entry, stop, strategy type, and pattern.

## Backtesting and Optimization

Phase 8 adds deterministic Python research tooling:

- `BacktestEngine`
- `BacktestParameters`
- `OptimizationEngine`
- `BacktestReporter`
- `BacktestStats`
- `TradeRecord`

Adjustable parameters:

- risk per trade: `0.25%` to `1%`
- TP multiplier: `1.5R` to `3R`
- trailing start: `1R` to `2R`
- EMA fast/slow periods, default `50/200`
- ATR period
- score threshold: `6` to `9`

Supported scenario testing:

- `XAUUSD`
- `NQ` / `NAS100`
- `EURUSD`
- any other symbol represented by normalized `Bar` data

Tracked metrics:

- total trades
- win rate
- profit factor
- max drawdown
- average R per trade
- best session
- worst session
- equity curve
- drawdown curve
- trade distribution
- trades near news
- session performance
- high vs low volatility performance

Trade logging:

- timestamp
- symbol
- strategy type
- entry/exit
- SL/TP
- R result
- P&L
- session
- news condition
- volatility condition

Optimization:

- grid-search parameter sweeps
- default ranges for risk, TP, trailing start, EMA periods, ATR period, and score threshold
- 70% training / 30% validation split for out-of-sample testing
- best parameter set
- stable parameter ranges
- worst-case drawdown across training and validation

Visual output is returned as data series rather than rendered charts:

- `equity_curve`
- `drawdown_curve`
- `trade_distribution`

The MT5 EA also exposes Strategy Tester inputs:

- `InpRiskPerTradePct`
- `InpTakeProfitMultiplierR`
- `InpTrailingStartR`
- `InpEmaFastPeriod`
- `InpEmaSlowPeriod`
- `InpAtrPeriod`
- `InpScoreThreshold`

## Multi-Account Execution

Phase 9 adds `trading_robot/accounts/` for cross-platform account fanout:

- `MasterSignalEngine` converts `TradeSignal` into one shared signal shape: symbol, direction, entry, SL, TP, and risk percent.
- `AccountManager` tracks account ID, broker type, balance/equity, risk allocation, active/paused status, daily P&L, trade count, loss streak, cooldown, and consistency P&L.
- `MT5Adapter` sends normalized signals through the broker-neutral `ExecutionClient`.
- `TopstepAdapter` is a futures/Topstep-style placeholder that accepts the same signal format.
- `TradeCopier` sends each signal to all active accounts, adjusts volume per account, blocks duplicates, and isolates failures by disabling only the failed account.

Per-account protection:

- max risk is capped at `0.5%`
- daily drawdown is tracked independently
- max trades per day is enforced independently
- loss streak cooldown is enforced independently
- one failed account does not stop execution on other accounts

## Production Deployment

Production hardening is split between the Python runtime and the MT5 Expert Advisor:

- `ProductionConfig` controls live enablement, retry count, retry delay, state file path, log file path, reconnect behavior, and heartbeat cadence.
- `ExecutionRouter` now enforces safe-off live execution by default, reconnects on transient failures, retries rejected/exceptions up to the configured limit, and persists runtime state after successful decisions.
- `RobotStateStore` writes `RobotState` to JSON so VPS or process restarts can recover daily counters, streaks, cooldowns, and tracked positions.
- `TradingLogger` writes rotating file logs for execution, risk, monitoring, and error events.
- `OperationalMonitor` records runtime P&L, trade count, open positions, and streak metrics, and can emit warning-level alerts.

MT5 live-safety controls in [ProfessionalTradingRobotEA.mq5](/Users/getnetbelay/Documents/New%20project/mql5/ProfessionalTradingRobotEA.mq5):

- daily loss limit enforced locally at the terminal edge
- max trades per day enforced locally
- max open positions enforced locally
- terminal connection and trading-permission checks before execution
- limited retry handling with raw `OrderSend()` fallback
- runtime recovery from terminal global variables after restart
- throttled position-management loop for low CPU usage on VPS

Recommended live deployment steps:

1. Set `ProductionConfig.live_trading_enabled=True` only on the target live environment.
2. Point `ProductionConfig.state_file_path` and `ProductionConfig.log_file_path` to persistent VPS storage.
3. Enable MT5 AutoTrading and set `InpLiveTradingEnabled=true` in the EA inputs.
4. Configure `InpMaxDailyLossPct`, `InpMaxTradesPerDay`, `InpMaxOpenTrades`, spread limits, and retry settings for the funded account profile.
5. Keep the Python runtime and MT5 terminal on the same VPS when using a signal bridge so restart recovery and logs stay local and deterministic.

## Live Performance Optimization

Phase 12 adds a live optimization layer in [live_optimization.py](/Users/getnetbelay/Documents/New%20project/trading_robot/research/live_optimization.py).

Core components:

- `LiveTradeDatabase` stores closed trades as JSONL with timestamp, symbol, setup type, session, news condition, entry, exit, SL, TP, and `R` result.
- `LivePerformanceOptimizer` analyzes those trades in one pass and calculates:
  - win rate per setup
  - win rate per session
  - profit factor per symbol
  - average `R`
- `AdaptiveRules` returns recommended score threshold, risk percent, allowed setups, and disabled sessions.

Output focus:

- best conditions
- worst conditions
- improvement suggestions
- adaptive rules for threshold, risk, and setup rotation

Suggestion logic:

- disable bad sessions when they have enough trades and underperform
- disable weak setups when they have enough trades and underperform
- increase score threshold when average `R` is weak
- reduce risk when live results are deteriorating

The calculations are lightweight, deterministic, and designed to run after a trade closes or on a periodic VPS job rather than on every tick.

## Monitoring and Control

Phase 13 adds an operations layer in `trading_robot/operations/`.

Core services:

- `DashboardService` builds real-time snapshots with:
  - account balance
  - daily P&L
  - total trades
  - win/loss ratio
  - drawdown
  - open positions
- `AlertDispatcher` sends non-blocking alerts for:
  - trade opened
  - trade closed
  - SL/TP hit
  - daily loss reached
  - system stopped
- `TelegramBotClient` sends messages through a configurable bot token and chat ID.
- `ControlCenter` handles operator commands and runtime controls:
  - pause/resume trading
  - change risk percent
  - enable/disable symbols
  - status snapshots

Supported commands:

- `/pause`
- `/resume`
- `/status`
- `/risk 0.5`
- `/disable XAUUSD`
- `/enable XAUUSD`

Integration points:

- `StrategyEngine` checks the control layer before evaluating a symbol.
- `RiskManager` applies remote risk overrides and emits daily-loss alerts.
- `ExecutionRouter` emits trade-opened alerts after accepted orders.

Alert and command events are stored through `OperationsLogStore` so production monitoring remains auditable.

## Historical Research

The project now includes a stdlib-only historical research stack in `trading_robot/research/`:

- `HistDataClient` scrapes official HistData yearly manifests for MT4/MT5 M1 files
- `DukascopyDownloader` downloads public Dukascopy daily M1 BID candle files for supported symbols
- `HistoricalDataLoader` normalizes HistData zip/csv files into minute bars
- `PatternLearningEngine` studies:
  - session behavior
  - hour-of-day behavior
  - expansion continuation
  - expansion reversal
  - sweep-reversal proxies
- `ResearchWorkflow` orchestrates a five-year XAUAUD research run and writes a JSON report
- `ResearchWorkflow` also supports a 7-year multi-symbol run for `XAUUSD`, `XAUAUD`, `EURUSD`, `NAS100`, `US30`, and `BTCUSD`

Important limits:

- HistData official pages are public, but the actual zip download endpoint may reject automated requests from some environments.
- TrueFX requires account access, TickData is commercial, and TradingHeroes is a tutorial rather than a data vendor.
- The research stack is designed to work with official downloads when available and with manual file drops when automation is blocked.

Default workflow output:

- raw data directory: `runtime/data/XAUAUD`
- research report: `runtime/research/xauaud_five_year_report.json`

Run the workflow:

```bash
python3 -m trading_robot.research.cli xauaud-5y
```

Run the 7-year multi-symbol workflow:

```bash
python3 -m trading_robot.research.cli multi-7y
```

Run focused research for the four core markets:

```bash
python3 -m trading_robot.research.cli core-4
```

Run focused research for the five core markets including BTC:

```bash
python3 -m trading_robot.research.cli core-5
```

Intended source plan:

- `EURUSD`, `XAUUSD`: HistData yearly M1 zip files
- `NAS100`, `US30`: MT5 broker terminal M1 CSV exports
- `BTCUSD`: Binance public monthly BTCUSDT 1m archives normalized into local BTCUSD yearly CSVs

Download supported Dukascopy symbols:

```bash
python3 -m trading_robot.research.cli download-dukascopy --symbol NAS100 --start-date 2019-01-01 --end-date 2026-04-10
python3 -m trading_robot.research.cli download-dukascopy --symbol US30 --start-date 2019-01-01 --end-date 2026-04-10
```

Download BTC minute data:

```bash
python3 -m trading_robot.research.cli download-binance-crypto --symbol BTCUSD --start-year 2019 --end-year 2026
```

Check local coverage first:

```bash
python3 -m trading_robot.research.cli check-xauaud-data
```

It also writes:

- tuning summary: `runtime/research/xauaud_tuning_recommendations.json`

## Phase Plan

Phase 1: Foundation

- Create clean modular architecture
- Add broker-neutral types and interfaces
- Add central runtime state
- Add placeholders for trend, structure, filters, scoring, risk, execution, and trade management
- Add README and smoke tests

Phase 2: Risk and Trade Management

- Implement symbol-aware position sizing
- Add configurable risk per trade
- Add daily loss cap
- Add max trades per day
- Add max open positions
- Add cooldown after consecutive losses
- Add partial close at 1R
- Add breakeven at 1R
- Add symbol-specific trailing stop framework
- Add focused unit tests

Phase 3: Market State Engine

- Implement H1 EMA regime detection
- Implement M15 structure detection
- Implement M5 entry readiness
- Implement ATR volatility classification
- Add symbol-aware behavior for Gold and indices
- Wire market state into StrategyEngine, SetupScorer, and RiskManager

Phase 4: Session, News, and Prop Protection

- Implement London and New York UTC session filtering
- Add session quality scoring
- Add manual/API-ready news event filtering
- Add post-news confirmation mode
- Add prop-firm protection rules
- Add final `CanTrade()` permission object
- Wire permission into StrategyEngine and RiskManager

Phase 5: Setup Scoring and Trade Selection

- Implement 0-10 setup scoring
- Add minimum score threshold of 7
- Add symbol-specific weighting for Gold, indices, and forex
- Add penalties for news proximity, spread, weak candles, and choppy structure
- Add multi-market setup ranking and top one or two selection
- Wire score validity into StrategyEngine and RiskManager

Phase 6: Strategy Engine and Trade Execution

- Implement liquidity sweep reversal detection
- Implement rejection and engulfing confirmation
- Implement breakout plus retest detection
- Implement momentum candle confirmation
- Add symbol-specific strategy routing
- Add 1R TP1 and runner metadata
- Route approved signals through RiskManager and ExecutionRouter
- Suppress duplicate signals

Phase 7: MT5 Execution Engine

- Add MQL5 Expert Advisor execution module
- Implement `ExecuteTrade()` with symbol, direction, entry, SL, TP, and lots
- Use `CTrade.Buy()` and `CTrade.Sell()`
- Add raw `OrderSend()` fallback
- Add symbol availability, spread, duplicate, and max-open-trade checks
- Track open positions by magic number and ticket
- Add OnTick trade management loop
- Add 1R breakeven and 50% partial close
- Add fixed, ATR, and swing trailing options
- Add limited retry handling and execution logging

Phase 8: Backtesting and Optimization

- Add deterministic backtest mode
- Add parameter objects for risk, TP, trailing, EMA, ATR, and score threshold
- Add multi-symbol testing for XAUUSD, NQ/NAS100, and EURUSD
- Add performance metrics and filter analysis
- Add CSV trade logging
- Add grid-search optimization
- Add 70/30 training-validation split for overfitting protection
- Add report outputs for best parameters, stable ranges, and worst-case drawdown
- Add MT5 Strategy Tester inputs for optimization

Phase 9: Multi-Account and Cross-Platform Execution

- Add master signal format and `GenerateTradeSignal()`
- Add MT5 adapter and Topstep-style placeholder adapter
- Add account manager with active/paused status
- Add trade copier fanout to active accounts
- Add per-account risk, drawdown, trade count, loss streak, and cooldown rules
- Add account isolation on execution failure
- Add duplicate execution prevention
- Add dynamic account add/remove/enable/disable support

Phase 10: AI Risk Adaptation and Smart Optimization

- Add `RiskAdaptationEngine`
- Track win streak, loss streak, daily P&L, volatility, and drawdown
- Adjust risk dynamically between `0.25%`, `0.5%`, and `0.75%`
- Stop trading after 3 losses, daily target hit, or drawdown stop threshold
- Reduce risk for high volatility and underperforming sessions or strategies
- Wire adaptation decisions into `StrategyEngine` and `RiskManager`
- Log adjusted risk, trading permission, reason, and confidence level

Phase 11: Production Deployment Hardening

- Add safe-off live trading controls
- Add retry and reconnect handling
- Add restart-safe state persistence
- Add operational logging and monitoring
- Add MT5 local guardrails for live deployment

Phase 12: Live Performance Optimization

- Store live trades in a dedicated trade database
- Calculate setup, session, symbol, and average-R performance
- Suggest session/setup disabling and threshold increases
- Recommend adaptive rules for score threshold, risk, and setup rotation
- Log optimization analysis and decision outputs

Phase 13: Monitoring Dashboard, Alerts, and Control

- Add real-time dashboard snapshots for balance, P&L, trades, ratio, drawdown, and positions
- Add non-blocking alert dispatch for trade lifecycle and system events
- Add Telegram bot integration with configurable chat ID
- Add operator command handling for pause, resume, status, and risk updates
- Add symbol enable/disable controls
- Log alerts sent and commands received
- Wire monitoring and control into strategy, risk, and execution

Phase 14: MT5 Integration Expansion

- Implement MT5 market data provider
- Implement `MT5ExecutionClient`
- Add symbol spec mapping from MT5
- Add Exness account/server configuration
- Add connection health checks and order result validation

Phase 15: Filters Expansion

- Add session calendar logic
- Add high-impact news provider integration
- Add correlation controls

Phase 16: Strategy Expansion

- Implement H1 regime detection
- Implement M15 structure detection
- Implement M5 execution trigger evaluation
- Add setup scoring rules and rejection reasons
- Add strategy-level unit tests

Phase 17: Trade Management Expansion

- Add broker-side modification handling
- Add advanced scale-out rules
- Add volatility-adjusted trailing presets
- Add lifecycle tests for open positions

Phase 18: Research and Backtesting Expansion

- Implement historical data adapters
- Add event-driven backtest loop
- Expand `BacktestStats`
- Add parameter sweeps and report generation
- Compare live and backtest behavior through shared interfaces

Phase 19: TopstepX Adapter

- Implement `TopstepXExecutionClient`
- Add futures contract metadata mapping
- Add TopstepX account/risk rules
- Add separate integration tests for futures execution

## Operational Validation

Use the operational CLI for two concrete checks before any live deployment claim:

1. Live-readiness evaluation:

```bash
python3 -m trading_robot.operations.cli check-live-readiness
```

This writes:

- `runtime/production/live_readiness_report.json`

The report is strict about fail-closed requirements such as live-enable state, symbol specs, writable state/log paths, Telegram alert configuration, and local research coverage.

2. Strategy-accurate replay backtest:

```bash
python3 -m trading_robot.operations.cli run-replay --symbol XAUUSD --start 2024-01-01 --end 2024-01-31
```

This replays local historical bars through the real `StrategyEngine`, `RiskManager`, filters, and trade-management rules rather than the lightweight proxy backtester. Output is written under `runtime/production/`.

These checks do not replace MT5 Strategy Tester or demo forward testing. They are the code-side gate before terminal-side validation.

3. Consolidated production validation run:

```bash
python3 -m trading_robot.operations.cli run-production-suite --start 2024-01-01 --end 2024-01-31
```

This writes:

- `runtime/production/production_validation_report.json`
- per-symbol bounded replay artifacts such as `runtime/production/replay_validation_xauusd.json`

Use this report as the final code-side handoff before Windows MT5 Strategy Tester and demo validation.

## Development

Run smoke tests:

```bash
python3 -m unittest discover -s trading_robot/tests
```

The Python scaffold has no broker package dependencies. The MT5 execution layer is isolated in `mql5/ProfessionalTradingRobotEA.mq5`; add Python MT5, TopstepX, calendar, and news-provider dependencies only when those integration phases begin.
