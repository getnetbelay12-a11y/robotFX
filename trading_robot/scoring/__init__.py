"""Setup scoring module exports."""

from trading_robot.scoring.setup_scorer import SetupScorer
from trading_robot.scoring.trade_selection_engine import SetupCandidate, TradeSelectionEngine

__all__ = ["SetupCandidate", "SetupScorer", "TradeSelectionEngine"]
