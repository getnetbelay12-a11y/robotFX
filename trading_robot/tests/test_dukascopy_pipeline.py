"""Tests for Dukascopy downloader utilities."""

from datetime import date
from decimal import Decimal
import lzma
from pathlib import Path
import struct
import tempfile
import unittest

from trading_robot.research import DukascopyDownloader


class DukascopyPipelineTests(unittest.TestCase):
    def test_daily_url_uses_zero_based_month(self) -> None:
        downloader = DukascopyDownloader()
        instrument = downloader.instrument("US30")

        url = downloader._daily_url(instrument, date(2024, 1, 2))

        self.assertIn("/2024/00/02/", url)
        self.assertIn("USA30IDXUSD", url)

    def test_parser_decodes_one_m1_candle(self) -> None:
        downloader = DukascopyDownloader()
        instrument = downloader.instrument("EURUSD")
        payload = struct.pack(">5If", 0, 110366, 110374, 110366, 110376, 1.25)
        compressed = lzma.compress(payload)

        original_daily_url = downloader._daily_url
        original_urlopen = __import__("urllib.request").request.urlopen

        class FakeResponse:
            def read(self):
                return compressed

        def fake_urlopen(request, timeout=30):
            return FakeResponse()

        try:
            __import__("urllib.request").request.urlopen = fake_urlopen
            bars = downloader.download_day(instrument, date(2024, 1, 2))
        finally:
            __import__("urllib.request").request.urlopen = original_urlopen

        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].symbol, "EURUSD")
        self.assertEqual(bars[0].open, Decimal("1.10366"))
        self.assertEqual(bars[0].high, Decimal("1.10376"))
        self.assertEqual(bars[0].volume, Decimal("1.25"))

    def test_existing_last_dates_reads_resumable_coverage(self) -> None:
        downloader = DukascopyDownloader()
        instrument = downloader.instrument("US30")

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "DUKASCOPY_US30_M1_2019.csv"
            path.write_text(
                "timestamp,open,high,low,close,volume\n"
                "2019-04-05 23:58:00,1,1,1,1,0\n"
                "2019-04-05 23:59:00,1,1,1,1,0\n",
                encoding="utf-8",
            )
            coverage = downloader._existing_last_dates(instrument, Path(tmp), [2019, 2020])

        self.assertEqual(coverage[2019], date(2019, 4, 5))
        self.assertNotIn(2020, coverage)


if __name__ == "__main__":
    unittest.main()
