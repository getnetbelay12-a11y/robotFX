//+------------------------------------------------------------------+
//| TelegramNotifier.mqh                                             |
//| Telegram alerts for the ProfessionalTradingRobot EA              |
//+------------------------------------------------------------------+
#ifndef __PTR_TELEGRAM_NOTIFIER_MQH__
#define __PTR_TELEGRAM_NOTIFIER_MQH__

bool g_telegramTokenWarningLogged = false;
bool g_telegramChatIdWarningLogged = false;

// Paste your bot token into the EA input named InpTelegramBotToken.
// MT5 must also allow WebRequest access for https://api.telegram.org
// under Tools -> Options -> Expert Advisors -> Allow WebRequest.

string UrlEncode(const string text)
{
   uchar bytes[];
   StringToCharArray(text, bytes, 0, WHOLE_ARRAY, CP_UTF8);
   string encoded = "";
   int size = ArraySize(bytes);
   for(int index = 0; index < size; index++)
   {
      int value = bytes[index];
      if(value == 0)
         break;

      if((value >= 'A' && value <= 'Z') ||
         (value >= 'a' && value <= 'z') ||
         (value >= '0' && value <= '9') ||
         value == '-' || value == '_' || value == '.' || value == '~')
      {
         encoded += CharToString((ushort)value);
      }
      else if(value == ' ')
      {
         encoded += "%20";
      }
      else
      {
         encoded += StringFormat("%%%02X", value);
      }
   }
   return encoded;
}

bool SendTelegramMessage(string message)
{
   if(!InpTelegramEnabled)
      return false;

   if(InpTelegramBotToken == "")
   {
      if(!g_telegramTokenWarningLogged)
      {
         Print("Telegram notifier disabled: InpTelegramBotToken is empty.");
         g_telegramTokenWarningLogged = true;
      }
      return false;
   }

   if(InpTelegramChatId == "")
   {
      if(!g_telegramChatIdWarningLogged)
      {
         Print("Telegram notifier disabled: InpTelegramChatId is empty.");
         g_telegramChatIdWarningLogged = true;
      }
      return false;
   }

   string url = "https://api.telegram.org/bot" + InpTelegramBotToken + "/sendMessage";
   string payload = "chat_id=" + UrlEncode(InpTelegramChatId) + "&text=" + UrlEncode(message);

   char post[];
   StringToCharArray(payload, post, 0, StringLen(payload));

   char result[];
   string headers = "Content-Type: application/x-www-form-urlencoded\r\n";
   string response_headers = "";
   ResetLastError();
   int timeout = 5000;
   int status = WebRequest("POST", url, headers, timeout, post, result, response_headers);
   if(status == -1)
   {
      Print("Telegram WebRequest failed. lastError=", GetLastError(), " url=", url);
      return false;
   }
   if(status < 200 || status >= 300)
   {
      Print("Telegram request returned HTTP status ", status, ". responseHeaders=", response_headers);
      return false;
   }
   return true;
}

string FormatResultR(const double resultR)
{
   string prefix = resultR > 0.0 ? "+" : "";
   return prefix + DoubleToString(resultR, 2) + "R";
}

void AlertTradeOpened(string symbol, string side, double entry, double sl, double tp, double riskPercent)
{
   string message =
      "Trade Opened\n"
      "Symbol: " + symbol + "\n"
      "Side: " + side + "\n"
      "Entry: " + DoubleToString(entry, DigitsForSymbol(symbol)) + "\n"
      "SL: " + DoubleToString(sl, DigitsForSymbol(symbol)) + "\n"
      "TP: " + DoubleToString(tp, DigitsForSymbol(symbol)) + "\n"
      "Risk: " + DoubleToString(riskPercent, 2) + "%";
   SendTelegramMessage(message);
}

void AlertTradeClosed(string symbol, string side, double resultR, string reason)
{
   string message =
      "Trade Closed\n"
      "Symbol: " + symbol + "\n"
      "Side: " + side + "\n"
      "Result: " + FormatResultR(resultR) + "\n"
      "Reason: " + reason;
   SendTelegramMessage(message);
}

void AlertStopLoss(string symbol, string side, double resultR)
{
   string message =
      "Stop Loss Hit\n"
      "Symbol: " + symbol + "\n"
      "Side: " + side + "\n"
      "Result: " + FormatResultR(resultR);
   SendTelegramMessage(message);
}

void AlertTakeProfit(string symbol, string side, double resultR)
{
   string message =
      "Take Profit Hit\n"
      "Symbol: " + symbol + "\n"
      "Side: " + side + "\n"
      "Result: " + FormatResultR(resultR);
   SendTelegramMessage(message);
}

void AlertDailyLossLimit(double dailyPnLPercent)
{
   string message =
      "Daily Loss Limit Reached\n"
      "Daily PnL: -" + DoubleToString(dailyPnLPercent, 2) + "%";
   SendTelegramMessage(message);
}

void AlertRobotPaused(string reason)
{
   string message =
      "Robot Paused\n"
      "Reason: " + reason;
   SendTelegramMessage(message);
}

void AlertRobotResumed()
{
   SendTelegramMessage("Robot Resumed");
}

#endif
