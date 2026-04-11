"""Historical data acquisition and normalization for research runs.

This module is intentionally stdlib-only so it can run on a clean VPS or local
MT5 box without Pandas or external download clients.
"""

from __future__ import annotations

import csv
import http.cookiejar
import io
import itertools
import re
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from trading_robot.journal.logger import TradingLogger


@dataclass(frozen=True)
class HistDataYearManifest:
    """Metadata for one HistData yearly file."""

    symbol: str
    year: int
    pair_label: str
    file_name: str
    status_name: str
    page_url: str
    download_form: dict[str, str]


@dataclass(frozen=True)
class MinuteBarRecord:
    """Normalized 1-minute bar record for research."""

    timestamp: datetime
    symbol: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


class HistDataClient:
    """Fetch HistData manifests and attempt official download POSTs."""

    def __init__(self, logger: TradingLogger | None = None) -> None:
        self._logger = logger or TradingLogger()
        self._cookie_jar = http.cookiejar.CookieJar()
        self._opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self._cookie_jar))
        self._headers = {"User-Agent": "Mozilla/5.0"}

    def fetch_manifest(self, symbol: str, year: int) -> HistDataYearManifest:
        """Scrape the official page for the yearly zip metadata."""

        page_url = f"https://www.histdata.com/download-free-forex-historical-data/?/metatrader/1-minute-bar-quotes/{symbol.upper()}/{year}"
        html = self._opener.open(urllib.request.Request(page_url, headers=self._headers), timeout=30).read().decode("utf-8", "ignore")
        file_name = self._extract_between(html, '<a id="a_file"', "</a>")
        status_name = self._extract_between(html, '<a id="a_status"', "</a>")
        pair_label = self._extract_label_value(html, "Forex Pair")
        form_body = self._extract_form_fields(html)
        if file_name is None or not form_body:
            raise ValueError(f"could not parse HistData manifest for {symbol} {year}")
        return HistDataYearManifest(
            symbol=symbol.upper(),
            year=year,
            pair_label=pair_label or symbol.upper(),
            file_name=re.sub(r"<[^>]+>", "", file_name).strip(),
            status_name=re.sub(r"<[^>]+>", "", status_name or "").strip(),
            page_url=page_url,
            download_form=form_body,
        )

    def is_downloadable(self, manifest: HistDataYearManifest) -> bool:
        """Return True when the page exposed a real HistData token."""

        return bool(manifest.download_form.get("tk"))

    def try_download_year(self, manifest: HistDataYearManifest, target_dir: str | Path) -> Path | None:
        """Attempt the official POST download; return path only on non-empty zip bytes."""

        target_path = Path(target_dir) / manifest.file_name
        target_path.parent.mkdir(parents=True, exist_ok=True)
        payload = urllib.parse.urlencode(manifest.download_form).encode("utf-8")
        request = urllib.request.Request(
            "https://www.histdata.com/get.php",
            data=payload,
            headers={**self._headers, "Referer": manifest.page_url, "Origin": "https://www.histdata.com"},
        )
        response = self._opener.open(request, timeout=60)
        body = response.read()
        content_type = response.headers.get("Content-Type", "")
        content_disposition = response.headers.get("Content-Disposition", "")
        is_zip = (
            body[:2] == b"PK"
            or "zip" in content_type.lower()
            or ".zip" in content_disposition.lower()
        )
        if not body or not is_zip:
            self._logger.warning(
                "histdata download unavailable from environment",
                symbol=manifest.symbol,
                year=manifest.year,
                file_name=manifest.file_name,
                content_type=content_type,
                content_disposition=content_disposition,
                content_length=len(body),
            )
            return None
        target_path.write_bytes(body)
        self._logger.info("histdata year downloaded", symbol=manifest.symbol, year=manifest.year, path=str(target_path))
        return target_path

    def fetch_manifest_range(self, symbol: str, start_year: int, end_year: int) -> tuple[HistDataYearManifest, ...]:
        """Fetch yearly manifests inclusive."""

        manifests = [self.fetch_manifest(symbol=symbol, year=year) for year in range(start_year, end_year + 1)]
        return tuple(manifests)

    def _extract_between(self, html: str, marker: str, end_marker: str) -> str | None:
        start = html.find(marker)
        if start < 0:
            return None
        sub = html[start:]
        end = sub.find(end_marker)
        if end < 0:
            return None
        return sub[: end + len(end_marker)]

    def _extract_label_value(self, html: str, label: str) -> str | None:
        pattern = re.compile(rf"<p><b>{re.escape(label)}</b>:\s*(.*?)</p>", re.IGNORECASE | re.DOTALL)
        match = pattern.search(html)
        return re.sub(r"<[^>]+>", "", match.group(1)).strip() if match else None

    def _extract_form_fields(self, html: str) -> dict[str, str]:
        start = html.find('<form id="file_down"')
        end = html.find("</form>", start)
        if start < 0 or end < 0:
            return {}
        form = html[start:end]
        fields: dict[str, str] = {}
        for name, value in re.findall(r'name="([^"]+)"[^>]+value="([^"]*)"', form):
            fields[name] = value
        return fields


class HistoricalDataLoader:
    """Load HistData yearly zips or plain CSV files into normalized minute bars."""

    def __init__(self, logger: TradingLogger | None = None) -> None:
        self._logger = logger or TradingLogger()

    def load_directory(self, symbol: str, directory: str | Path) -> list[MinuteBarRecord]:
        bars: list[MinuteBarRecord] = []
        for path in sorted(Path(directory).glob("*")):
            if path.suffix.lower() == ".zip":
                bars.extend(self.load_histdata_zip(symbol=symbol, path=path))
            elif path.suffix.lower() in {".csv", ".txt"}:
                bars.extend(self.load_auto(symbol=symbol, path=path))
        return bars

    def load_histdata_zip(self, symbol: str, path: str | Path) -> list[MinuteBarRecord]:
        with zipfile.ZipFile(path) as archive:
            bars: list[MinuteBarRecord] = []
            for name in archive.namelist():
                if name.lower().endswith((".csv", ".txt")):
                    with archive.open(name) as raw_handle:
                        text_handle = io.TextIOWrapper(raw_handle, encoding="utf-8")
                        bars.extend(self._load_stream_auto(symbol=symbol, handle=text_handle))
            self._logger.info("histdata zip loaded", symbol=symbol, path=str(path), bars=len(bars))
            return bars

    def load_histdata_csv(self, symbol: str, path: str | Path) -> list[MinuteBarRecord]:
        with open(path, "r", encoding="utf-8") as handle:
            bars = self._load_stream_auto(symbol=symbol, handle=handle)
        self._logger.info("histdata csv loaded", symbol=symbol, path=str(path), bars=len(bars))
        return bars

    def _load_stream_auto(self, symbol: str, handle) -> list[MinuteBarRecord]:
        preview_lines = list(itertools.islice(handle, 5))
        sample = "".join(preview_lines)
        if ";" in sample and re.search(r"\d{8}\s+\d{6};", sample):
            return self._load_histdata_stream(symbol=symbol, handle=io.StringIO(sample + handle.read()))
        if "," in sample:
            return self._load_histdata_comma_stream(symbol=symbol, handle=io.StringIO(sample + handle.read()))
        return []

    def _load_histdata_stream(self, symbol: str, handle) -> list[MinuteBarRecord]:
        records: list[MinuteBarRecord] = []
        reader = csv.reader(handle, delimiter=";")
        for row in reader:
            if len(row) < 6:
                continue
            timestamp = datetime.strptime(row[0], "%Y%m%d %H%M%S")
            records.append(
                MinuteBarRecord(
                    timestamp=timestamp,
                    symbol=symbol.upper(),
                    open=Decimal(row[1]),
                    high=Decimal(row[2]),
                    low=Decimal(row[3]),
                    close=Decimal(row[4]),
                    volume=Decimal(row[5]),
                )
            )
        return records

    def load_auto(self, symbol: str, path: str | Path) -> list[MinuteBarRecord]:
        """Load a CSV/TXT file using supported format auto-detection."""

        path = Path(path)
        with open(path, "r", encoding="utf-8") as handle:
            sample = handle.read(4096)
            handle.seek(0)
            if ";" in sample and re.search(r"\d{8}\s+\d{6};", sample):
                return self._load_histdata_stream(symbol=symbol, handle=handle)
            if "," in sample:
                first_line = next((line.strip() for line in sample.splitlines() if line.strip()), "")
                if re.match(r"\d{4}\.\d{2}\.\d{2},\d{2}:\d{2}", first_line):
                    return self._load_histdata_comma_stream(symbol=symbol, handle=handle)
                if re.match(r"\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2},", first_line):
                    return self._load_plain_csv(symbol=symbol, handle=handle)
                return self._load_generic_csv(symbol=symbol, handle=handle)
        return []

    def _load_histdata_comma_stream(self, symbol: str, handle) -> list[MinuteBarRecord]:
        """Load HistData zip csv with date,time,open,high,low,close,volume columns."""

        records: list[MinuteBarRecord] = []
        reader = csv.reader(handle, delimiter=",")
        for row in reader:
            if len(row) < 7:
                continue
            timestamp = datetime.strptime(f"{row[0]} {row[1]}", "%Y.%m.%d %H:%M")
            records.append(
                MinuteBarRecord(
                    timestamp=timestamp,
                    symbol=symbol.upper(),
                    open=Decimal(row[2]),
                    high=Decimal(row[3]),
                    low=Decimal(row[4]),
                    close=Decimal(row[5]),
                    volume=Decimal(row[6]),
                )
            )
        return records

    def _load_generic_csv(self, symbol: str, handle) -> list[MinuteBarRecord]:
        """Load generic MT5-style CSV with datetime/open/high/low/close/volume columns."""

        records: list[MinuteBarRecord] = []
        reader = csv.DictReader(handle)
        for row in reader:
            normalized = {key.lower().strip(): value for key, value in row.items() if key}
            timestamp_raw = normalized.get("timestamp") or normalized.get("time") or normalized.get("<date>")
            if timestamp_raw is None:
                date_value = normalized.get("date") or normalized.get("<date>")
                time_value = normalized.get("time") or normalized.get("<time>")
                if date_value and time_value:
                    timestamp_raw = f"{date_value} {time_value}"
            if timestamp_raw is None:
                continue

            timestamp = self._parse_timestamp(timestamp_raw)
            records.append(
                MinuteBarRecord(
                    timestamp=timestamp,
                    symbol=symbol.upper(),
                    open=Decimal(normalized.get("open") or normalized.get("<open>", "0")),
                    high=Decimal(normalized.get("high") or normalized.get("<high>", "0")),
                    low=Decimal(normalized.get("low") or normalized.get("<low>", "0")),
                    close=Decimal(normalized.get("close") or normalized.get("<close>", "0")),
                    volume=Decimal(normalized.get("volume") or normalized.get("tick_volume") or normalized.get("<tickvol>", "0")),
                )
            )
        return records

    def _load_plain_csv(self, symbol: str, handle) -> list[MinuteBarRecord]:
        """Load plain CSV rows without a header.

        Supported format:
        timestamp,open,high,low,close,volume
        """

        records: list[MinuteBarRecord] = []
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 6:
                continue
            records.append(
                MinuteBarRecord(
                    timestamp=self._parse_timestamp(row[0]),
                    symbol=symbol.upper(),
                    open=Decimal(row[1]),
                    high=Decimal(row[2]),
                    low=Decimal(row[3]),
                    close=Decimal(row[4]),
                    volume=Decimal(row[5]),
                )
            )
        return records

    def _parse_timestamp(self, value: str) -> datetime:
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y.%m.%d %H:%M:%S",
            "%Y.%m.%d %H:%M",
            "%Y-%m-%d %H:%M",
            "%Y%m%d %H%M%S",
        ):
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"unsupported timestamp format: {value}")
