"""Dukascopy public M1 candle downloader and parser."""

from __future__ import annotations

import csv
import lzma
import socket
import struct
import urllib.error
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from trading_robot.journal.logger import TradingLogger
from trading_robot.research.data_pipeline import MinuteBarRecord


@dataclass(frozen=True)
class DukascopyInstrument:
    """Public Dukascopy instrument metadata."""

    symbol: str
    dukascopy_symbol: str
    price_scale: Decimal


class DukascopyDownloader:
    """Downloads Dukascopy public M1 BID candle files and writes normalized CSV."""

    def __init__(self, logger: TradingLogger | None = None) -> None:
        self._logger = logger or TradingLogger()
        self._headers = {"User-Agent": "Mozilla/5.0"}
        self._max_retries = 3
        self._instruments = {
            "EURUSD": DukascopyInstrument("EURUSD", "EURUSD", Decimal("100000")),
            "XAUUSD": DukascopyInstrument("XAUUSD", "XAUUSD", Decimal("1000")),
            "NAS100": DukascopyInstrument("NAS100", "USATECHIDXUSD", Decimal("1000")),
            "US30": DukascopyInstrument("US30", "USA30IDXUSD", Decimal("1000")),
        }

    def instrument(self, symbol: str) -> DukascopyInstrument:
        normalized = symbol.upper()
        if normalized not in self._instruments:
            raise KeyError(f"unsupported Dukascopy symbol: {symbol}")
        return self._instruments[normalized]

    def download_date_range(
        self,
        symbol: str,
        start_date: date,
        end_date: date,
        target_dir: str | Path,
    ) -> tuple[str, ...]:
        """Download one daily candle file at a time and write yearly CSV outputs."""

        instrument = self.instrument(symbol)
        target_root = Path(target_dir)
        target_root.mkdir(parents=True, exist_ok=True)
        written: dict[int, Path] = {}
        existing_last_dates = self._existing_last_dates(instrument=instrument, target_root=target_root, years=range(start_date.year, end_date.year + 1))
        current = start_date
        while current <= end_date:
            if current <= existing_last_dates.get(current.year, date.min):
                current += timedelta(days=1)
                continue
            bars = self.download_day(instrument=instrument, trading_date=current)
            if bars:
                year_path = written.get(current.year)
                if year_path is None:
                    year_path = target_root / f"DUKASCOPY_{instrument.symbol}_M1_{current.year}.csv"
                    if not year_path.exists():
                        self._write_header(year_path)
                    written[current.year] = year_path
                self._append_bars(year_path, bars)
            current += timedelta(days=1)
        all_paths = {
            year: target_root / f"DUKASCOPY_{instrument.symbol}_M1_{year}.csv"
            for year in range(start_date.year, end_date.year + 1)
        }
        return tuple(str(path) for year, path in sorted(all_paths.items()) if path.exists())

    def download_day(self, instrument: DukascopyInstrument, trading_date: date) -> list[MinuteBarRecord]:
        """Download and parse one daily BID_candles_min_1.bi5 file."""

        url = self._daily_url(instrument=instrument, trading_date=trading_date)
        request = urllib.request.Request(url, headers=self._headers)
        raw = b""
        for attempt in range(1, self._max_retries + 1):
            try:
                raw = urllib.request.urlopen(request, timeout=30).read()
                decoded = lzma.decompress(raw)
                break
            except urllib.error.HTTPError as exc:
                if exc.code == 404:
                    return []
                if attempt == self._max_retries:
                    self._logger.warning(
                        "dukascopy day failed",
                        symbol=instrument.symbol,
                        trading_date=trading_date.isoformat(),
                        error=str(exc),
                    )
                    return []
            except (urllib.error.URLError, TimeoutError, socket.timeout, EOFError, lzma.LZMAError) as exc:
                if attempt == self._max_retries:
                    self._logger.warning(
                        "dukascopy day failed",
                        symbol=instrument.symbol,
                        trading_date=trading_date.isoformat(),
                        error=str(exc),
                    )
                    return []
        else:
            return []
        if not raw:
            return []
        bars: list[MinuteBarRecord] = []
        for index in range(0, len(decoded), 24):
            chunk = decoded[index : index + 24]
            if len(chunk) < 24:
                continue
            offset_seconds, open_raw, close_raw, low_raw, high_raw, volume_raw = struct.unpack(">5If", chunk)
            timestamp = datetime.combine(trading_date, time(0, 0)) + timedelta(seconds=offset_seconds)
            scale = instrument.price_scale
            bars.append(
                MinuteBarRecord(
                    timestamp=timestamp,
                    symbol=instrument.symbol,
                    open=(Decimal(open_raw) / scale),
                    high=(Decimal(high_raw) / scale),
                    low=(Decimal(low_raw) / scale),
                    close=(Decimal(close_raw) / scale),
                    volume=Decimal(str(volume_raw)),
                )
            )
        self._logger.info("dukascopy day parsed", symbol=instrument.symbol, trading_date=trading_date.isoformat(), bars=len(bars))
        return bars

    def _daily_url(self, instrument: DukascopyInstrument, trading_date: date) -> str:
        month_zero_based = trading_date.month - 1
        return (
            f"https://datafeed.dukascopy.com/datafeed/{instrument.dukascopy_symbol}/"
            f"{trading_date.year}/{month_zero_based:02d}/{trading_date.day:02d}/BID_candles_min_1.bi5"
        )

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

    def _existing_last_dates(
        self,
        instrument: DukascopyInstrument,
        target_root: Path,
        years: Iterable[int],
    ) -> dict[int, date]:
        """Read the last timestamp in each yearly csv so interrupted runs can resume."""

        coverage: dict[int, date] = {}
        for year in years:
            path = target_root / f"DUKASCOPY_{instrument.symbol}_M1_{year}.csv"
            if not path.exists():
                continue
            last_line = self._read_last_line(path)
            if not last_line or last_line.startswith("timestamp,"):
                continue
            timestamp_text = last_line.split(",", 1)[0]
            try:
                coverage[year] = datetime.strptime(timestamp_text, "%Y-%m-%d %H:%M:%S").date()
            except ValueError:
                continue
        return coverage

    def _read_last_line(self, path: Path) -> str:
        with path.open("rb") as handle:
            handle.seek(0, 2)
            end = handle.tell()
            if end == 0:
                return ""
            chunk = bytearray()
            position = end - 1
            while position >= 0:
                handle.seek(position)
                byte = handle.read(1)
                if byte == b"\n" and chunk:
                    break
                if byte != b"\n":
                    chunk.extend(byte)
                position -= 1
            return bytes(reversed(chunk)).decode("utf-8", "ignore")
