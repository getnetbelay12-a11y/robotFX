"""Tests for local historical-data readiness checks."""

from pathlib import Path
import tempfile
import unittest

from trading_robot.research import DataReadinessChecker


class DataReadinessTests(unittest.TestCase):
    def test_checker_reports_present_and_missing_years(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "HISTDATA_COM_MT_XAUAUD_M1_2021.zip").write_text("", encoding="utf-8")
            Path(tmp, "HISTDATA_COM_MT_XAUAUD_M1_2023.zip").write_text("", encoding="utf-8")

            report = DataReadinessChecker().check("XAUAUD", tmp, 2021, 2025)

            self.assertEqual(report.present_years, (2021, 2023))
            self.assertEqual(report.missing_years, (2022, 2024, 2025))
            self.assertFalse(report.ready)


if __name__ == "__main__":
    unittest.main()
