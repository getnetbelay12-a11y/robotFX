"""Tests for Binance BTC downloader utilities."""

from decimal import Decimal
import io
import unittest
import zipfile

from trading_robot.research import BinanceDownloader


class BinancePipelineTests(unittest.TestCase):
    def test_monthly_url_uses_binance_archive_path(self) -> None:
        downloader = BinanceDownloader()
        instrument = downloader.instrument("BTCUSD")

        url = downloader._monthly_url(instrument, 2024, 1)

        self.assertIn("BTCUSDT", url)
        self.assertIn("2024-01", url)

    def test_parser_decodes_one_m1_candle(self) -> None:
        downloader = BinanceDownloader()
        csv_payload = (
            "1704067200000,42000.1,42010.2,41990.3,42005.4,12.5,1704067259999,0,0,0,0,0\n"
        ).encode("utf-8")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("BTCUSDT-1m-2024-01.csv", csv_payload)
        payload = buffer.getvalue()

        original_urlopen = __import__("urllib.request").request.urlopen

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return payload

        def fake_urlopen(request, timeout=60):
            return FakeResponse()

        try:
            __import__("urllib.request").request.urlopen = fake_urlopen
            bars = downloader.download_month(downloader.instrument("BTCUSD"), 2024, 1)
        finally:
            __import__("urllib.request").request.urlopen = original_urlopen

        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].symbol, "BTCUSD")
        self.assertEqual(bars[0].open, Decimal("42000.1"))
        self.assertEqual(bars[0].close, Decimal("42005.4"))
        self.assertEqual(bars[0].volume, Decimal("12.5"))


if __name__ == "__main__":
    unittest.main()
