//+------------------------------------------------------------------+
//| ProfessionalTradingRobotEA.mq5                                   |
//| Phase 7: MT5 execution, position tracking, and trade management  |
//+------------------------------------------------------------------+
#property strict
#property version "0.7"
#property description "MT5 execution engine for StrategyEngine signals."

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>

CTrade trade;
CPositionInfo position_info;

enum TradeDirection
{
   DIRECTION_BUY = 0,
   DIRECTION_SELL = 1
};

struct ExecutionResult
{
   bool success;
   ulong ticket;
   string errorMessage;
};

input long InpMagicNumber = 2607001;
input double InpRiskPerTradePct = 0.50;      // Optimizer range: 0.25 to 1.00
input double InpTakeProfitMultiplierR = 2.0; // Optimizer range: 1.5 to 3.0
input double InpTrailingStartR = 1.5;        // Optimizer range: 1.0 to 2.0
input int InpEmaFastPeriod = 50;
input int InpEmaSlowPeriod = 200;
input int InpScoreThreshold = 7;             // Optimizer range: 6 to 9
input int InpSlippagePoints = 20;
input int InpMaxRetries = 3;
input int InpRetryDelayMs = 250;
input bool InpUseOrderSendFallback = true;
input bool InpLiveTradingEnabled = false;
input double InpMaxDailyLossPct = 1.5;
input int InpMaxTradesPerDay = 3;
input int InpMaxOpenTrades = 3;
input double InpMaxSpreadPoints = 30.0;
input double InpPartialCloseFraction = 0.50;
input double InpBreakevenAtR = 1.0;
input double InpGoldTrailStartR = 1.2;
input double InpIndexTrailStartR = 1.5;
input double InpDefaultTrailStartR = 1.5;
input double InpFixedTrailDistanceR = 1.0;
input int InpAtrPeriod = 14;
input double InpAtrTrailMultiplier = 1.5;
input int InpManageIntervalSeconds = 1;
input bool InpEnableTerminalAlerts = false;
input bool InpTelegramEnabled = true;
input string InpTelegramBotToken = "";      // Paste your Telegram bot token here.
input string InpTelegramChatId = "679534336";

#include "TelegramNotifier.mqh"

string g_signalSymbol = "";
TradeDirection g_signalDirection = DIRECTION_BUY;
double g_signalEntryPrice = 0.0;
double g_signalStopLoss = 0.0;
double g_signalTakeProfit = 0.0;
double g_signalLots = 0.0;
bool g_signalPending = false;
datetime g_currentTradingDay = 0;
double g_startOfDayEquity = 0.0;
int g_dailyTradeCount = 0;
datetime g_lastManageRun = 0;
bool g_robotPaused = false;
bool g_dailyLossAlertSent = false;

int OnInit()
{
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpSlippagePoints);
   RecoverRuntimeState();
   UpdateRobotPauseState(false, "");
   Print("ProfessionalTradingRobotEA initialized. Magic=", InpMagicNumber);
   return INIT_SUCCEEDED;
}

void OnTick()
{
   RefreshRuntimeState();

   if(g_signalPending)
   {
      string signalError = "";
      if(CanProcessSignals(signalError))
      {
         ExecutionResult result = ExecuteTrade(
            g_signalSymbol,
            g_signalDirection,
            g_signalEntryPrice,
            g_signalStopLoss,
            g_signalTakeProfit,
            g_signalLots
         );
         PrintExecutionResult(result);
      }
      else
      {
         Print("Signal blocked: ", signalError);
         if(InpEnableTerminalAlerts)
            Alert("PTR blocked signal: ", signalError);
      }
      g_signalPending = false;
   }

   if((int)(TimeCurrent() - g_lastManageRun) >= InpManageIntervalSeconds)
   {
      ManageOpenPositions();
      g_lastManageRun = TimeCurrent();
   }
}

// Use this function as the bridge point from an MT5 signal producer, file bridge,
// socket bridge, or manually adapted MQL5 strategy module.
void SubmitSignal(
   const string symbol,
   const TradeDirection direction,
   const double entryPrice,
   const double stopLoss,
   const double takeProfit,
   const double lots
)
{
   g_signalSymbol = symbol;
   g_signalDirection = direction;
   g_signalEntryPrice = entryPrice;
   g_signalStopLoss = stopLoss;
   g_signalTakeProfit = takeProfit;
   g_signalLots = lots;
   g_signalPending = true;
}

ExecutionResult ExecuteTrade(
   const string symbol,
   const TradeDirection direction,
   const double entryPrice,
   const double stopLoss,
   const double takeProfit,
   const double lots
)
{
   ExecutionResult result;
   result.success = false;
   result.ticket = 0;
   result.errorMessage = "";

   if(!ValidateOrderRequest(symbol, stopLoss, takeProfit, lots, result.errorMessage))
      return result;

   double normalizedLots = NormalizeVolume(symbol, lots);
   if(normalizedLots <= 0.0)
   {
      result.errorMessage = "Invalid normalized lot size";
      return result;
   }

   bool sent = false;
   for(int attempt = 1; attempt <= InpMaxRetries; attempt++)
   {
      ResetLastError();
      if(direction == DIRECTION_BUY)
      {
         double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
         sent = trade.Buy(normalizedLots, symbol, ask, stopLoss, takeProfit, "PTR sweep/breakout buy");
      }
      else
      {
         double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
         sent = trade.Sell(normalizedLots, symbol, bid, stopLoss, takeProfit, "PTR sweep/breakout sell");
      }

      if(sent)
      {
         result.success = true;
         result.ticket = trade.ResultOrder();
         g_dailyTradeCount++;
         PersistRuntimeState();
         Print("Order placed. Symbol=", symbol,
               " ticket=", result.ticket,
               " lots=", DoubleToString(normalizedLots, 2),
               " SL=", DoubleToString(stopLoss, DigitsForSymbol(symbol)),
               " TP=", DoubleToString(takeProfit, DigitsForSymbol(symbol)));
         AlertTradeOpened(
            symbol,
            direction == DIRECTION_BUY ? "BUY" : "SELL",
            entryPrice,
            stopLoss,
            takeProfit,
            InpRiskPerTradePct
         );
         return result;
      }

      int errorCode = GetLastError();
      result.errorMessage = StringFormat(
         "Order failed attempt %d/%d. retcode=%d comment=%s lastError=%d",
         attempt,
         InpMaxRetries,
         trade.ResultRetcode(),
         trade.ResultComment(),
         errorCode
      );
      Print(result.errorMessage);

      if(!IsRetryableTradeError(trade.ResultRetcode(), errorCode))
         break;

      Sleep(InpRetryDelayMs);
      RefreshRatesForSymbol(symbol);
   }

   if(InpUseOrderSendFallback)
   {
      Print("Trying raw OrderSend fallback. Symbol=", symbol);
      ulong fallbackTicket = 0;
      string fallbackError = "";
      if(SendWithOrderSend(symbol, direction, stopLoss, takeProfit, normalizedLots, fallbackTicket, fallbackError))
      {
         result.success = true;
         result.ticket = fallbackTicket;
         result.errorMessage = "";
         g_dailyTradeCount++;
         PersistRuntimeState();
         AlertTradeOpened(
            symbol,
            direction == DIRECTION_BUY ? "BUY" : "SELL",
            entryPrice,
            stopLoss,
            takeProfit,
            InpRiskPerTradePct
         );
         return result;
      }
      result.errorMessage = fallbackError;
   }

   return result;
}

bool SendWithOrderSend(
   const string symbol,
   const TradeDirection direction,
   const double stopLoss,
   const double takeProfit,
   const double lots,
   ulong &ticket,
   string &errorMessage
)
{
   MqlTradeRequest request;
   MqlTradeResult orderResult;
   ZeroMemory(request);
   ZeroMemory(orderResult);

   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = lots;
   request.magic = InpMagicNumber;
   request.deviation = InpSlippagePoints;
   request.sl = stopLoss;
   request.tp = takeProfit;
   request.comment = "PTR raw OrderSend fallback";
   request.type = direction == DIRECTION_BUY ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   request.price = direction == DIRECTION_BUY ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);
   request.type_filling = FillingMode(symbol);

   ResetLastError();
   if(OrderSend(request, orderResult))
   {
      ticket = orderResult.order;
      Print("OrderSend fallback placed. ticket=", ticket, " retcode=", orderResult.retcode);
      return true;
   }

   errorMessage = StringFormat(
      "OrderSend fallback failed. retcode=%d comment=%s lastError=%d",
      orderResult.retcode,
      orderResult.comment,
      GetLastError()
   );
   Print(errorMessage);
   return false;
}

ENUM_ORDER_TYPE_FILLING FillingMode(const string symbol)
{
   long filling = SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      return ORDER_FILLING_FOK;
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
}

bool ValidateOrderRequest(
   const string symbol,
   const double stopLoss,
   const double takeProfit,
   const double lots,
   string &errorMessage
)
{
   RefreshRuntimeState();

   if(symbol == "")
   {
      errorMessage = "Missing symbol";
      return false;
   }
   if(!InpLiveTradingEnabled)
   {
      errorMessage = "Live trading disabled by input";
      return false;
   }
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
   {
      errorMessage = "Terminal disconnected";
      return false;
   }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      errorMessage = "Terminal trading permissions are disabled";
      return false;
   }
   if(IsDailyLossLimitReached())
   {
      errorMessage = "Daily loss limit reached";
      return false;
   }
   if(g_dailyTradeCount >= InpMaxTradesPerDay)
   {
      errorMessage = "Max trades per day reached";
      return false;
   }
   if(!SymbolSelect(symbol, true))
   {
      errorMessage = "Symbol is not available: " + symbol;
      return false;
   }
   if(!IsTradeAllowedForSymbol(symbol))
   {
      errorMessage = "Trading is not allowed for symbol: " + symbol;
      return false;
   }
   if(IsPositionOpen(symbol))
   {
      errorMessage = "Duplicate trade blocked for symbol: " + symbol;
      return false;
   }
   if(CountOpenPositions() >= InpMaxOpenTrades)
   {
      errorMessage = "Max open trades reached";
      return false;
   }
   if(IsSpreadTooHigh(symbol))
   {
      errorMessage = "Spread too high for symbol: " + symbol;
      return false;
   }
   if(lots <= 0.0)
   {
      errorMessage = "Lot size must be greater than zero";
      return false;
   }
   if(stopLoss <= 0.0 || takeProfit <= 0.0)
   {
      errorMessage = "SL and TP must be set";
      return false;
   }
   return true;
}

bool IsTradeAllowedForSymbol(const string symbol)
{
   long tradeMode = SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
   return tradeMode == SYMBOL_TRADE_MODE_FULL || tradeMode == SYMBOL_TRADE_MODE_LONGONLY || tradeMode == SYMBOL_TRADE_MODE_SHORTONLY;
}

bool IsPositionOpen(const string symbol)
{
   for(int index = PositionsTotal() - 1; index >= 0; index--)
   {
      if(!position_info.SelectByIndex(index))
         continue;
      if(position_info.Symbol() == symbol && position_info.Magic() == InpMagicNumber)
         return true;
   }
   return false;
}

int CountOpenPositions()
{
   int count = 0;
   for(int index = PositionsTotal() - 1; index >= 0; index--)
   {
      if(!position_info.SelectByIndex(index))
         continue;
      if(position_info.Magic() == InpMagicNumber)
         count++;
   }
   return count;
}

void GetOpenPositions()
{
   for(int index = PositionsTotal() - 1; index >= 0; index--)
   {
      if(!position_info.SelectByIndex(index))
         continue;
      if(position_info.Magic() != InpMagicNumber)
         continue;

      Print("Open position ticket=", position_info.Ticket(),
            " symbol=", position_info.Symbol(),
            " volume=", DoubleToString(position_info.Volume(), 2),
            " entry=", DoubleToString(position_info.PriceOpen(), DigitsForSymbol(position_info.Symbol())),
            " SL=", DoubleToString(position_info.StopLoss(), DigitsForSymbol(position_info.Symbol())),
            " TP=", DoubleToString(position_info.TakeProfit(), DigitsForSymbol(position_info.Symbol())));
   }
}

void ManageOpenPositions()
{
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
      return;

   for(int index = PositionsTotal() - 1; index >= 0; index--)
   {
      if(!position_info.SelectByIndex(index))
         continue;
      if(position_info.Magic() != InpMagicNumber)
         continue;

      string symbol = position_info.Symbol();
      double rMultiple = CurrentRMultiple(symbol);
      if(rMultiple < 0.0)
         continue;

      if(rMultiple >= InpBreakevenAtR)
      {
         MoveToBreakeven(position_info.Ticket());
         PartialClose(position_info.Ticket(), InpPartialCloseFraction);
      }

      if(rMultiple >= TrailStartR(symbol))
         TrailStop(position_info.Ticket());
   }
}

double CurrentRMultiple(const string symbol)
{
   if(!PositionSelect(symbol))
      return -1.0;

   double entry = PositionGetDouble(POSITION_PRICE_OPEN);
   double stopLoss = PositionGetDouble(POSITION_SL);
   double initialStop = stopLoss;
   if(!GlobalVariableCheck(InitialStopKey(PositionGetInteger(POSITION_TICKET))))
      GlobalVariableSet(InitialStopKey(PositionGetInteger(POSITION_TICKET)), stopLoss);
   else
      initialStop = GlobalVariableGet(InitialStopKey(PositionGetInteger(POSITION_TICKET)));

   double risk = MathAbs(entry - initialStop);
   if(risk <= 0.0)
      return -1.0;

   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double currentPrice = type == POSITION_TYPE_BUY ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
   double profitDistance = type == POSITION_TYPE_BUY ? currentPrice - entry : entry - currentPrice;
   return profitDistance / risk;
}

void MoveToBreakeven(const ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
      return;

   string symbol = PositionGetString(POSITION_SYMBOL);
   double entry = PositionGetDouble(POSITION_PRICE_OPEN);
   double currentSl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);
   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   bool improves = (type == POSITION_TYPE_BUY && currentSl < entry) || (type == POSITION_TYPE_SELL && currentSl > entry);
   if(!improves)
      return;

   if(trade.PositionModify(ticket, NormalizeDouble(entry, DigitsForSymbol(symbol)), tp))
      Print("Moved SL to breakeven. ticket=", ticket, " entry=", DoubleToString(entry, DigitsForSymbol(symbol)));
   else
      Print("Breakeven modify failed. ticket=", ticket, " retcode=", trade.ResultRetcode(), " comment=", trade.ResultComment());
}

void PartialClose(const ulong ticket, const double closeFraction)
{
   if(!PositionSelectByTicket(ticket))
      return;
   if(GlobalVariableCheck(PartialCloseKey(ticket)))
      return;

   string symbol = PositionGetString(POSITION_SYMBOL);
   double volume = PositionGetDouble(POSITION_VOLUME);
   double closeVolume = NormalizeVolume(symbol, volume * closeFraction);
   double minVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   if(closeVolume < minVolume || closeVolume >= volume)
      return;

   if(trade.PositionClosePartial(ticket, closeVolume, InpSlippagePoints))
   {
      GlobalVariableSet(PartialCloseKey(ticket), 1.0);
      Print("Partial close executed. ticket=", ticket, " volume=", DoubleToString(closeVolume, 2));
   }
   else
   {
      Print("Partial close failed. ticket=", ticket, " retcode=", trade.ResultRetcode(), " comment=", trade.ResultComment());
   }
}

void TrailStop(const ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
      return;

   string symbol = PositionGetString(POSITION_SYMBOL);
   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double entry = PositionGetDouble(POSITION_PRICE_OPEN);
   double initialStop = GlobalVariableCheck(InitialStopKey(ticket)) ? GlobalVariableGet(InitialStopKey(ticket)) : PositionGetDouble(POSITION_SL);
   double risk = MathAbs(entry - initialStop);
   if(risk <= 0.0)
      return;

   double fixedStop = FixedDistanceTrailStop(symbol, type, risk);
   double atrStop = AtrTrailStop(symbol, type);
   double swingStop = SwingTrailStop(symbol, type);
   double proposedStop = SelectBestTrailingStop(type, fixedStop, atrStop, swingStop);
   if(proposedStop <= 0.0)
      return;

   double currentSl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);
   bool improves = (type == POSITION_TYPE_BUY && proposedStop > currentSl) || (type == POSITION_TYPE_SELL && proposedStop < currentSl);
   if(!improves)
      return;

   proposedStop = NormalizeDouble(proposedStop, DigitsForSymbol(symbol));
   if(trade.PositionModify(ticket, proposedStop, tp))
      Print("Trailing stop updated. ticket=", ticket, " newSL=", DoubleToString(proposedStop, DigitsForSymbol(symbol)));
   else
      Print("Trailing update failed. ticket=", ticket, " retcode=", trade.ResultRetcode(), " comment=", trade.ResultComment());
}

double FixedDistanceTrailStop(const string symbol, const ENUM_POSITION_TYPE type, const double risk)
{
   if(type == POSITION_TYPE_BUY)
      return SymbolInfoDouble(symbol, SYMBOL_BID) - (risk * InpFixedTrailDistanceR);
   return SymbolInfoDouble(symbol, SYMBOL_ASK) + (risk * InpFixedTrailDistanceR);
}

double AtrTrailStop(const string symbol, const ENUM_POSITION_TYPE type)
{
   int handle = iATR(symbol, PERIOD_M5, InpAtrPeriod);
   if(handle == INVALID_HANDLE)
      return 0.0;

   double atr[];
   ArraySetAsSeries(atr, true);
   if(CopyBuffer(handle, 0, 0, 1, atr) <= 0)
   {
      IndicatorRelease(handle);
      return 0.0;
   }
   IndicatorRelease(handle);

   if(type == POSITION_TYPE_BUY)
      return SymbolInfoDouble(symbol, SYMBOL_BID) - atr[0] * InpAtrTrailMultiplier;
   return SymbolInfoDouble(symbol, SYMBOL_ASK) + atr[0] * InpAtrTrailMultiplier;
}

double SwingTrailStop(const string symbol, const ENUM_POSITION_TYPE type)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(symbol, PERIOD_M5, 1, 8, rates) < 5)
      return 0.0;

   if(type == POSITION_TYPE_BUY)
   {
      double low = rates[0].low;
      for(int index = 1; index < ArraySize(rates); index++)
         low = MathMin(low, rates[index].low);
      return low;
   }

   double high = rates[0].high;
   for(int index = 1; index < ArraySize(rates); index++)
      high = MathMax(high, rates[index].high);
   return high;
}

double SelectBestTrailingStop(const ENUM_POSITION_TYPE type, const double fixedStop, const double atrStop, const double swingStop)
{
   double selected = fixedStop;
   if(type == POSITION_TYPE_BUY)
   {
      if(atrStop > selected)
         selected = atrStop;
      if(swingStop > selected)
         selected = swingStop;
      return selected;
   }

   if(selected <= 0.0 || (atrStop > 0.0 && atrStop < selected))
      selected = atrStop;
   if(selected <= 0.0 || (swingStop > 0.0 && swingStop < selected))
      selected = swingStop;
   return selected;
}

double TrailStartR(const string symbol)
{
   string normalized = symbol;
   StringToUpper(normalized);
   if(InpTrailingStartR > 0.0)
      return InpTrailingStartR;
   if(StringFind(normalized, "XAU") >= 0 || StringFind(normalized, "GOLD") >= 0)
      return InpGoldTrailStartR;
   if(StringFind(normalized, "NQ") >= 0 || StringFind(normalized, "NAS100") >= 0 ||
      StringFind(normalized, "US100") >= 0 || StringFind(normalized, "US30") >= 0)
      return InpIndexTrailStartR;
   return InpDefaultTrailStartR;
}

bool IsSpreadTooHigh(const string symbol)
{
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(point <= 0.0)
      return true;
   double spread = (SymbolInfoDouble(symbol, SYMBOL_ASK) - SymbolInfoDouble(symbol, SYMBOL_BID)) / point;
   return spread > InpMaxSpreadPoints;
}

double NormalizeVolume(const string symbol, const double volume)
{
   double minVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0.0)
      return 0.0;

   double normalized = MathFloor(volume / step) * step;
   normalized = MathMax(minVolume, MathMin(maxVolume, normalized));
   return NormalizeDouble(normalized, VolumeDigits(step));
}

int VolumeDigits(const double step)
{
   if(step >= 1.0)
      return 0;
   if(step >= 0.1)
      return 1;
   if(step >= 0.01)
      return 2;
   return 3;
}

int DigitsForSymbol(const string symbol)
{
   return (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
}

bool IsRetryableTradeError(const uint retcode, const int lastError)
{
   return retcode == TRADE_RETCODE_REQUOTE ||
          retcode == TRADE_RETCODE_PRICE_CHANGED ||
          retcode == TRADE_RETCODE_PRICE_OFF ||
          retcode == TRADE_RETCODE_TIMEOUT ||
          lastError == 4756;
}

void RefreshRatesForSymbol(const string symbol)
{
   MqlTick tick;
   SymbolInfoTick(symbol, tick);
}

string InitialStopKey(const ulong ticket)
{
   return StringFormat("PTR_INITIAL_SL_%I64u", ticket);
}

string PartialCloseKey(const ulong ticket)
{
   return StringFormat("PTR_PARTIAL_1R_%I64u", ticket);
}

void PrintExecutionResult(const ExecutionResult &result)
{
   if(result.success)
      Print("Execution success. ticket=", result.ticket);
   else
      Print("Execution failed. error=", result.errorMessage);
}

void RefreshRuntimeState()
{
   datetime currentDay = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   if(g_currentTradingDay == 0)
   {
      g_currentTradingDay = currentDay;
      if(g_startOfDayEquity <= 0.0)
         g_startOfDayEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      g_dailyLossAlertSent = false;
      PersistRuntimeState();
      return;
   }

   if(currentDay != g_currentTradingDay)
   {
      g_currentTradingDay = currentDay;
      g_startOfDayEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      g_dailyTradeCount = 0;
      g_dailyLossAlertSent = false;
      PersistRuntimeState();
   }
}

void RecoverRuntimeState()
{
   g_currentTradingDay = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   if(GlobalVariableCheck(DailyEquityKey()))
      g_startOfDayEquity = GlobalVariableGet(DailyEquityKey());
   else
      g_startOfDayEquity = AccountInfoDouble(ACCOUNT_EQUITY);

   if(GlobalVariableCheck(DailyTradeCountKey()))
      g_dailyTradeCount = (int)GlobalVariableGet(DailyTradeCountKey());
   else
      g_dailyTradeCount = 0;

   if(GlobalVariableCheck(TradingDayKey()))
   {
      datetime storedDay = (datetime)GlobalVariableGet(TradingDayKey());
      if(storedDay != g_currentTradingDay)
      {
         g_startOfDayEquity = AccountInfoDouble(ACCOUNT_EQUITY);
         g_dailyTradeCount = 0;
      }
   }

   PersistRuntimeState();
}

void PersistRuntimeState()
{
   GlobalVariableSet(DailyEquityKey(), g_startOfDayEquity);
   GlobalVariableSet(DailyTradeCountKey(), g_dailyTradeCount);
   GlobalVariableSet(TradingDayKey(), (double)g_currentTradingDay);
}

bool IsDailyLossLimitReached()
{
   if(g_startOfDayEquity <= 0.0)
      return false;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double lossPct = ((g_startOfDayEquity - equity) / g_startOfDayEquity) * 100.0;
   if(lossPct >= InpMaxDailyLossPct && !g_dailyLossAlertSent)
   {
      AlertDailyLossLimit(lossPct);
      g_dailyLossAlertSent = true;
   }
   return lossPct >= InpMaxDailyLossPct;
}

bool CanProcessSignals(string &errorMessage)
{
   if(!InpLiveTradingEnabled)
   {
      errorMessage = "Live trading disabled";
      UpdateRobotPauseState(true, errorMessage);
      return false;
   }
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
   {
      errorMessage = "Terminal disconnected";
      UpdateRobotPauseState(true, errorMessage);
      return false;
   }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      errorMessage = "Trading not allowed by terminal settings";
      UpdateRobotPauseState(true, errorMessage);
      return false;
   }
   if(IsDailyLossLimitReached())
   {
      errorMessage = "Daily loss limit reached";
      UpdateRobotPauseState(true, errorMessage);
      return false;
   }
   if(g_dailyTradeCount >= InpMaxTradesPerDay)
   {
      errorMessage = "Max trades per day reached";
      UpdateRobotPauseState(true, errorMessage);
      return false;
   }
   UpdateRobotPauseState(false, "");
   return true;
}

string DailyEquityKey()
{
   return StringFormat("PTR_DAY_EQUITY_%I64d", InpMagicNumber);
}

string DailyTradeCountKey()
{
   return StringFormat("PTR_DAY_TRADES_%I64d", InpMagicNumber);
}

string TradingDayKey()
{
   return StringFormat("PTR_DAY_KEY_%I64d", InpMagicNumber);
}

string PositionSideKey(const ulong positionId)
{
   return StringFormat("PTR_SIDE_%I64u", positionId);
}

string PositionEntryKey(const ulong positionId)
{
   return StringFormat("PTR_ENTRY_%I64u", positionId);
}

string PositionRiskKey(const ulong positionId)
{
   return StringFormat("PTR_RISK_%I64u", positionId);
}

void StorePositionMetadata(const ulong positionId, const ENUM_DEAL_TYPE dealType, const double entryPrice, const double stopLoss)
{
   string side = dealType == DEAL_TYPE_BUY ? "BUY" : "SELL";
   double risk = MathAbs(entryPrice - stopLoss);
   if(risk <= 0.0)
      risk = 0.0;

   GlobalVariableSet(PositionSideKey(positionId), StringCompare(side, "BUY") == 0 ? 1.0 : -1.0);
   GlobalVariableSet(PositionEntryKey(positionId), entryPrice);
   GlobalVariableSet(PositionRiskKey(positionId), risk);
}

string StoredPositionSide(const ulong positionId)
{
   if(!GlobalVariableCheck(PositionSideKey(positionId)))
      return "UNKNOWN";
   return GlobalVariableGet(PositionSideKey(positionId)) >= 0.0 ? "BUY" : "SELL";
}

double StoredPositionEntry(const ulong positionId)
{
   return GlobalVariableCheck(PositionEntryKey(positionId)) ? GlobalVariableGet(PositionEntryKey(positionId)) : 0.0;
}

double StoredPositionRisk(const ulong positionId)
{
   return GlobalVariableCheck(PositionRiskKey(positionId)) ? GlobalVariableGet(PositionRiskKey(positionId)) : 0.0;
}

void ClearPositionMetadata(const ulong positionId)
{
   GlobalVariableDel(PositionSideKey(positionId));
   GlobalVariableDel(PositionEntryKey(positionId));
   GlobalVariableDel(PositionRiskKey(positionId));
}

bool IsPositionStillOpenById(const ulong positionId)
{
   for(int index = PositionsTotal() - 1; index >= 0; index--)
   {
      if(!position_info.SelectByIndex(index))
         continue;
      if(position_info.Magic() != InpMagicNumber)
         continue;
      if((ulong)position_info.Identifier() == positionId)
         return true;
   }
   return false;
}

double CalculateResultR(const ulong positionId, const double closePrice)
{
   double risk = StoredPositionRisk(positionId);
   double entry = StoredPositionEntry(positionId);
   string side = StoredPositionSide(positionId);
   if(risk <= 0.0 || entry <= 0.0 || side == "UNKNOWN")
      return 0.0;

   if(side == "BUY")
      return (closePrice - entry) / risk;
   return (entry - closePrice) / risk;
}

string DealReasonLabel(const long reason)
{
   if(reason == DEAL_REASON_SL)
      return "Stop Loss";
   if(reason == DEAL_REASON_TP)
      return "Take Profit";
   if(reason == DEAL_REASON_SO)
      return "Stop Out";
   if(reason == DEAL_REASON_CLIENT)
      return "Manual";
   if(reason == DEAL_REASON_EXPERT)
      return "Expert";
   return "Closed";
}

void UpdateRobotPauseState(const bool paused, const string reason)
{
   if(paused == g_robotPaused)
      return;

   g_robotPaused = paused;
   if(paused)
      AlertRobotPaused(reason);
   else
      AlertRobotResumed();
}

void OnTradeTransaction(
   const MqlTradeTransaction &trans,
   const MqlTradeRequest &request,
   const MqlTradeResult &result
)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;
   if(!HistoryDealSelect(trans.deal))
      return;
   if((long)HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != InpMagicNumber)
      return;

   long entryType = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   ulong positionId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   string symbol = HistoryDealGetString(trans.deal, DEAL_SYMBOL);
   double price = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
   long dealType = HistoryDealGetInteger(trans.deal, DEAL_TYPE);

   if(entryType == DEAL_ENTRY_IN)
   {
      double stopLoss = HistoryDealGetDouble(trans.deal, DEAL_SL);
      StorePositionMetadata(positionId, (ENUM_DEAL_TYPE)dealType, price, stopLoss);
      return;
   }

   if(entryType == DEAL_ENTRY_OUT || entryType == DEAL_ENTRY_INOUT)
   {
      if(IsPositionStillOpenById(positionId))
         return;

      string side = StoredPositionSide(positionId);
      double resultR = CalculateResultR(positionId, price);
      long reason = HistoryDealGetInteger(trans.deal, DEAL_REASON);
      string reasonText = DealReasonLabel(reason);

      if(reason == DEAL_REASON_SL)
         AlertStopLoss(symbol, side, resultR);
      else if(reason == DEAL_REASON_TP)
         AlertTakeProfit(symbol, side, resultR);

      AlertTradeClosed(symbol, side, resultR, reasonText);
      ClearPositionMetadata(positionId);
   }
}
