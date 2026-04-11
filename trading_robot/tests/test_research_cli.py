"""Tests for research CLI helpers."""

import unittest

from trading_robot.research.cli import build_multi_symbol_tuning_payload, build_tuning_payload


class ResearchCliTests(unittest.TestCase):
    def test_build_tuning_payload_uses_recommendations(self) -> None:
        payload = build_tuning_payload(
            {
                "symbol": "XAUAUD",
                "recommendations": {
                    "preferred_sessions": ["london_open"],
                    "avoided_sessions": ["off_session"],
                    "preferred_patterns": ["sweep_reversal"],
                    "score_threshold_bias": "normal",
                    "notes": ["favor liquidity-sweep reversals"],
                },
            }
        )

        self.assertEqual(payload["symbol"], "XAUAUD")
        self.assertEqual(payload["preferred_sessions"], ["london_open"])
        self.assertEqual(payload["score_threshold_bias"], "normal")

    def test_build_multi_symbol_tuning_payload_uses_per_symbol_recommendations(self) -> None:
        payload = build_multi_symbol_tuning_payload(
            {
                "window_start": "2019-01-01",
                "window_end": "2026-04-10",
                "symbols": {
                    "US30": {
                        "recommendations": {
                            "preferred_sessions": ["new_york_open"],
                            "avoided_sessions": ["off_session"],
                            "preferred_patterns": ["expansion_continuation"],
                            "score_threshold_bias": "normal",
                            "notes": ["favor breakout continuation"],
                        }
                    }
                },
            }
        )

        self.assertEqual(payload["symbols"]["US30"]["preferred_sessions"], ["new_york_open"])
        self.assertEqual(payload["symbols"]["US30"]["score_threshold_bias"], "normal")


if __name__ == "__main__":
    unittest.main()
