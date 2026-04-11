"""Binance public monthly BTC minute-bar downloader.

This is used as a practical research data source for BTC when broker-aligned
CFD history is not readily available. Files are normalized into the same
timestamp/open/high/low/close/volume CSV shape used elsewhere in the research
stack so the rest of the tooling stays unchanged.
"""

from __future__ import annotations

import csv
import io
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from trading_robot.journal.logger import TradingLogger
from trading_robot.research.data_pipeline import MinuteBarRecord


@dataclass(frozen=True)
class BinanceInstrument:
    """Public Binance instrument metadata used for archival downloads."""

    symbol: str
    binance_symbol: str


class BinanceDownloader:
    """Downloads public monthly Binance 1m archives and writes yearly CSV files."""

    def __init__(self, logger: TradingLogger | None = None) -> None:
        self._logger = logger or TradingLogger()
        self._headers = {"User-Agent": "Mozilla/5.0"}
        self._instruments = {
            "BTCUSD": BinanceInstrument(symbol="BTCUSD", binance_symbol="BTCUSDT"),
            "BTCUSDT": BinanceInstrument(symbol="BTCUSD", binance_symbol="BTCUSDT"),
        }

    def instrument(self, symbol: str) -> BinanceInstrument:
        normalized = symbol.upper()
        if normalized not in self._instruments:
            raise KeyError(f"unsupported Binance symbol: {symbol}")
        return self._instruments[normalized]

    def download_month_range(
        self,
        symbol: str,
        start_year: int,
        start_month: int,
        end_year: int,
        end_month: int,
        target_dir: str | Path,
    ) -> tuple[str, ...]:
        """Download monthly archives and append them into normalized yearly files."""

        instrument = self.instrument(symbol)
        target_root = Path(target_dir)
        target_root.mkdir(parents=True, exist_ok=True)
        written: dict[int, Path] = {}

        year = start_year
        month = start_month
        while (year, month) <= (end_year, end_month):
            bars = self.download_month(instrument=instrument, year=year, month=month)
            if bars:
                year_path = written.get(year)
                if year_path is None:
                    year_path = target_root / f"BINANCE_{instrument.symbol}_M1_{year}.csv"
                    if not year_path.exists():
                        self._write_header(year_path)
                    written[year] = year_path
                self._append_bars(year_path, bars)
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1

        return tuple(str(path) for _, path in sorted(written.items()))

    def download_years(
        self,
        symbol: str,
        start_year: int,
        end_year: int,
        target_dir: str | Path,
    ) -> tuple[str, ...]:
        """Convenience wrapper for whole-year ranges through the current month."""

        today = date.today()
        return self.download_month_range(
            symbol=symbol,
            start_year=start_year,
            start_month=1,
            end_year=end_year,
            end_month=12 if end_year < today.year else today.month,
            target_dir=target_dir,
        )

    def download_month(self, instrument: BinanceInstrument, year: int, month: int) -> list[MinuteBarRecord]:
        """Download and parse one public Binance monthly 1m archive."""

        url = self._monthly_url(instrument=instrument, year=year, month=month)
        request = urllib.request.Request(url, headers=self._headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
        if not raw:
            return []

        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            bars: list[MinuteBarRecord] = []
            for name in archive.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with archive.open(name) as handle:
                    text = io.TextIOWrapper(handle, encoding="utf-8")
                    bars.extend(self._parse_month_csv(symbol=instrument.symbol, handle=text))
        self._logger.info("binance month parsed", symbol=instrument.symbol, year=year, month=month, bars=len(bars))
        return bars

    def _monthly_url(self, instrument: BinanceInstrument, year: int, month: int) -> str:
        return (
            "https://data.binance.vision/data/spot/monthly/klines/"
            f"{instrument.binance_symbol}/1m/{instrument.binance_symbol}-1m-{year:04d}-{month:02d}.zip"
        )

    def _parse_month_csv(self, symbol: str, handle) -> list[MinuteBarRecord]:
        records: list[MinuteBarRecord] = []
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 6:
                continue
            opened_at = datetime.utcfromtimestamp(int(row[0]) / 1000)
            records.append(
                MinuteBarRecord(
                    timestamp=opened_at,
                    symbol=symbol,
                    open=Decimal(row[1]),
                    high=Decimal(row[2]),
                    low=Decimal(row[3]),
                    close=Decimal(row[4]),
                    volume=Decimal(row[5]),
                )
            )
        return records

    def _write_header(self, path: Path) -> None:
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["timestamp", "open", "high", "low", "close", "volume"])

    def _append_bars(self, path: Path, bars: list[MinuteBarRecord]) -> None:
        with path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            for bar in bars:
                writer.writerow(
                    [
                        bar.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        f"{bar.open}",
                        f"{bar.high}",
                        f"{bar.low}",
                        f"{bar.close}",
                        f"{bar.volume}",
                    ]
                )
