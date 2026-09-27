"""
Budget Optimizer — scores and sorts candidates by budget compatibility.

v2 redesign:
    Previously: hard price filtering → eliminated all candidates on low budgets → zero-cost.
    Now: SOFT scoring — candidates are never eliminated, only sorted by price fitness.
    This ensures GPT always has a full pool to select from, even on tight budgets.

    Score formula per candidate:
        score = rating_score + budget_fit_score
        rating_score    = (rating / 5.0) * 0.6      (60% weight on quality)
        budget_fit_score = fit * 0.4                  (40% weight on budget fit)
        fit = 1.0 if price == 0 (free)
            = 1.0 if price <= cap
            = cap / price if price > cap (penalized but not excluded)
"""

from typing import Any, Dict, List

from app.core.logging import get_logger
from app.schemas.itinerary import BudgetBreakdown

logger = get_logger(__name__)

# Scoring weights
_WEIGHT_RATING = 0.6
_WEIGHT_BUDGET = 0.4


def _budget_fit_score(price: float, cap: float) -> float:
    """
    Compute how well a price fits within the budget cap.

    Returns 1.0 for free or within-cap prices, < 1.0 for over-cap.
    Never returns 0 — expensive places are penalized, not excluded.
    """
    if price <= 0:
        return 1.0  # Free — perfect fit
    if cap <= 0:
        return 0.5  # No cap info — neutral
    if price <= cap:
        return 1.0
    return cap / price  # Diminishing penalty: 2× over cap → 0.5


def _score_candidate(candidate: dict, price_key: str, cap: float) -> float:
    """Compute composite score for a single candidate."""
    rating = float(candidate.get("rating") or 0.0)
    price = float(candidate.get(price_key) or 0.0)

    rating_score = (rating / 5.0) * _WEIGHT_RATING
    fit = _budget_fit_score(price, cap)
    budget_score = fit * _WEIGHT_BUDGET

    return rating_score + budget_score


class BudgetOptimizer:
    """
    Sorts candidates by budget-adjusted quality score.

    Called after retrieval, before GPT context construction.
    Candidates are NEVER eliminated — only reordered so that
    the best budget-compatible choices appear first in the GPT context.
    """

    def optimize(
        self,
        candidates: Dict[str, List[Dict[str, Any]]],
        breakdown: BudgetBreakdown,
        trip_duration_days: int,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Score and sort all candidate categories by budget fitness.

        Args:
            candidates:        Retrieval results (may now include 'markets').
            breakdown:         Budget split per category.
            trip_duration_days: Number of days in the trip.

        Returns:
            Same structure, with each list sorted by composite score DESC.
        """
        nights = max(trip_duration_days - 1, 1)
        per_night_cap = breakdown.accommodation / nights
        meals_total = 3 * trip_duration_days
        per_meal_cap = breakdown.food / max(meals_total, 1)
        per_attraction_cap = breakdown.attractions / max(trip_duration_days * 2, 1)

        hotels = self._score_and_sort(
            candidates.get("hotels", []), "price_per_night", per_night_cap
        )
        restaurants = self._score_and_sort(
            candidates.get("restaurants", []), "avg_price", per_meal_cap
        )
        attractions = self._score_and_sort(
            candidates.get("attractions", []), "ticket_price", per_attraction_cap
        )
        # Markets treated like attractions for budget purposes
        markets = self._score_and_sort(
            candidates.get("markets", []), "ticket_price", per_attraction_cap
        )

        logger.info(
            "budget_optimized",
            extra={
                "hotels": len(hotels),
                "restaurants": len(restaurants),
                "attractions": len(attractions),
                "markets": len(markets),
                "per_night_cap": per_night_cap,
                "per_meal_cap": per_meal_cap,
                "per_attraction_cap": per_attraction_cap,
            },
        )

        return {
            "hotels": hotels,
            "restaurants": restaurants,
            "attractions": attractions,
            "markets": markets,
        }

    def _score_and_sort(
        self,
        candidates: List[Dict[str, Any]],
        price_key: str,
        cap: float,
    ) -> List[Dict[str, Any]]:
        """
        Score each candidate and return them sorted by score DESC.

        Attaches '_budget_score' to each candidate dict for transparency
        (useful for debugging and future frontend affordability badges).
        """
        if not candidates:
            return []

        scored = []
        for c in candidates:
            score = _score_candidate(c, price_key, cap)
            c_copy = dict(c)
            c_copy["_budget_score"] = round(score, 4)
            scored.append((score, c_copy))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored]
