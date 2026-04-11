"""Tests for historical data ingestion and pattern research."""

from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest
import zipfile

from trading_robot.research import (
    HistoricalDataLoader,
    MinuteBarRecord,
    PatternLearningEngine,
    ResearchRecommendationEngine,
)
from trading_robot.research.data_pipeline import HistDataClient


SAMPLE_HTML = """
<p><b>Forex Pair</b>: XAU/AUD</p>
<p><b>Download Historical Data Here</b>: <a id="a_file" title="Download the zip data file" href="javascript:return true;" target="nullDisplay">HISTDATA_COM_MT_XAUAUD_M1_2024.zip</a></p>
<p>File Status Report: <a id="a_status" title="Download the status file" href="javascript:return true;" target="nullDisplay">HISTDATA_COM_MT_XAUAUD_M1_2024.txt</a></p>
<form id="file_down" name="file_down" target="nullDisplay" method="POST" action="/get.php">
  <input type="hidden" name="tk" id="tk" value="" />
  <input type="hidden" name="date" id="date" value="2024" />
  <input type="hidden" name="datemonth" id="datemonth" value="2024" />
  <input type="hidden" name="platform" id="platform" value="MT" />
  <input type="hidden" name="timeframe" id="timeframe" value="M1" />
  <input type="hidden" name="fxpair" id="fxpair" value="XAUAUD" />
</form>
"""


class ResearchPipelineTests(unittest.TestCase):
    def test_histdata_client_parses_manifest_fields(self) -> None:
        client = HistDataClient()

        manifest = client._extract_form_fields(SAMPLE_HTML)

        self.assertEqual(manifest["platform"], "MT")
        self.assertEqual(manifest["fxpair"], "XAUAUD")
        self.assertEqual(client._extract_label_value(SAMPLE_HTML, "Forex Pair"), "XAU/AUD")

    def test_loader_reads_histdata_zip(self) -> None:
        loader = HistoricalDataLoader()
        content = "20240101 000000;10;11;9;10.5;100\n20240101 000100;10.5;11.2;10.4;11;120\n"

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("XAUAUD_2024.csv", content)
            bars = loader.load_histdata_zip("XAUAUD", path)

        self.assertEqual(len(bars), 2)
        self.assertEqual(bars[0].symbol, "XAUAUD")
        self.assertEqual(bars[1].close, Decimal("11"))

    def test_pattern_learning_produces_suggestions(self) -> None:
        engine = PatternLearningEngine()
        bars = []
        timestamp = datetime(2024, 1, 1, 7, 0)
        price = Decimal("100")
        for index in range(80):
            close = price + Decimal("0.2")
            high = close + Decimal("0.4")
            low = price - Decimal("0.1")
            if index % 10 == 0:
                high = close + Decimal("1.0")
                low = price - Decimal("0.6")
            bars.append(
                MinuteBarRecord(
                    timestamp=timestamp + timedelta(minutes=index),
                    symbol="XAUAUD",
                    open=price,
                    high=high,
                    low=low,
                    close=close,
                    volume=Decimal("100"),
                )
            )
            price = close

        report = engine.analyze(symbol="XAUAUD", bars=bars)

        self.assertEqual(report.symbol, "XAUAUD")
        self.assertGreater(report.total_bars, 50)
        self.assertTrue(report.best_conditions)
        self.assertTrue(report.suggestions)
        self.assertIn("bullish_pin_bar", report.candlestick_metrics)
        recommendations = ResearchRecommendationEngine().recommend(report)
        self.assertIn(recommendations.score_threshold_bias, {"raise", "normal", "conservative"})

    def test_loader_reads_mixed_directory_with_generic_csv(self) -> None:
        loader = HistoricalDataLoader()
        generic_csv = (
            "timestamp,open,high,low,close,volume\n"
            "2024-01-02 00:00:00,100,101,99,100.5,10\n"
            "2024-01-02 00:01:00,100.5,101.5,100,101,12\n"
        )

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "DUKASCOPY_NAS100_M1_2024.csv"
            path.write_text(generic_csv, encoding="utf-8")
            bars = loader.load_directory("NAS100", tmp)

        self.assertEqual(len(bars), 2)
        self.assertEqual(bars[0].symbol, "NAS100")
        self.assertEqual(bars[-1].close, Decimal("101"))

    def test_loader_reads_plain_csv_without_header(self) -> None:
        loader = HistoricalDataLoader()
        plain_csv = (
            "2024-01-25 00:00:00,37861.203,37866.227,37858.727,37866.227,0.0034\n"
            "2024-01-25 00:01:00,37865.715,37875.299,37865.227,37873.739,0.0027\n"
        )

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "DUKASCOPY_US30_M1_2024.csv"
            path.write_text(plain_csv, encoding="utf-8")
            bars = loader.load_directory("US30", tmp)

        self.assertEqual(len(bars), 2)
        self.assertEqual(bars[0].timestamp, datetime(2024, 1, 25, 0, 0))
        self.assertEqual(bars[-1].close, Decimal("37873.739"))


if __name__ == "__main__":
    unittest.main()
