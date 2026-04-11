"""Validate local research data coverage before running analysis."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DataReadinessReport:
    """Coverage report for local historical files."""

    symbol: str
    expected_years: tuple[int, ...]
    present_years: tuple[int, ...]
    missing_years: tuple[int, ...]
    files: tuple[str, ...]
    ready: bool


class DataReadinessChecker:
    """Checks whether all expected yearly files are present locally."""

    def check(self, symbol: str, directory: str | Path, start_year: int, end_year: int) -> DataReadinessReport:
        expected_years = tuple(range(start_year, end_year + 1))
        directory = Path(directory)
        files = tuple(sorted(path.name for path in directory.glob("*") if path.is_file()))
        present_years = []
        for year in expected_years:
            year_text = str(year)
            if any(year_text in file_name for file_name in files):
                present_years.append(year)
        missing_years = tuple(year for year in expected_years if year not in present_years)
        return DataReadinessReport(
            symbol=symbol.upper(),
            expected_years=expected_years,
            present_years=tuple(present_years),
            missing_years=missing_years,
            files=files,
            ready=len(missing_years) == 0,
        )
