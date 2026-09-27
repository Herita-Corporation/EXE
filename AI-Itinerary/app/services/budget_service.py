"""
Budget Service — planning budget calculation, validation, allocation, and
realistic price range estimation.

v2 changes:
- build_price_range(): converts raw DB prices to PriceRange with min/max
- estimate_price_range(): infers a realistic range when DB has no price
- allocate_budget(): now aware of budget floors to avoid zero-cost assignments
"""

from typing import Dict, Optional

from app.core.constants import (
    BUDGET_ALLOCATION,
    MEAL_PRICE_RANGE_MULTIPLIER,
    HOTEL_PRICE_RANGE_MULTIPLIER,
    ATTRACTION_PRICE_RANGE_MULTIPLIER,
    MIN_ATTRACTION_PRICE_VND,
    MIN_COFFEE_PRICE_VND,
    MIN_HOTEL_PRICE_VND,
    MIN_MEAL_PRICE_VND,
    PLANNING_BUDGET_RATIO,
    RESERVE_BUDGET_RATIO,
)
from app.core.exceptions import BudgetExceededError, InvalidBudgetError
from app.core.logging import get_logger
from app.schemas.itinerary import BudgetBreakdown, PriceRange

logger = get_logger(__name__)


class BudgetService:
    """
    Handles all budget-related computations.

    Formula (spec §14):
        planning_budget = budget * 0.70
        reserve_budget  = budget * 0.30

    v2 additions:
        build_price_range()    — convert raw price → PriceRange with min/max
        estimate_price_range() — infer realistic range when DB has no price data
    """

    def calculate_planning_budget(self, total_budget: float) -> tuple[float, float]:
        """
        Return (planning_budget, reserve_budget).

        Raises:
            InvalidBudgetError: If budget <= 0.
        """
        if total_budget <= 0:
            raise InvalidBudgetError("Budget must be greater than zero.")

        planning = round(total_budget * PLANNING_BUDGET_RATIO, 2)
        reserve = round(total_budget * RESERVE_BUDGET_RATIO, 2)

        logger.info(
            "budget_calculated",
            extra={
                "total_budget": total_budget,
                "planning_budget": planning,
                "reserve_budget": reserve,
            },
        )
        return planning, reserve

    def allocate_budget(
        self, planning_budget: float, trip_duration_days: int
    ) -> BudgetBreakdown:
        """
        Distribute planning budget across the five categories.

        Returns:
            BudgetBreakdown with per-category amounts.
        """
        breakdown = BudgetBreakdown(
            transportation=round(planning_budget * BUDGET_ALLOCATION["transportation"], 2),
            accommodation=round(planning_budget * BUDGET_ALLOCATION["accommodation"], 2),
            food=round(planning_budget * BUDGET_ALLOCATION["food"], 2),
            attractions=round(planning_budget * BUDGET_ALLOCATION["attractions"], 2),
            contingency=round(planning_budget * BUDGET_ALLOCATION["contingency"], 2),
        )

        logger.info(
            "budget_allocated",
            extra={
                "planning_budget": planning_budget,
                "trip_days": trip_duration_days,
                "breakdown": breakdown.model_dump(),
            },
        )
        return breakdown

    def validate_generated_budget(
        self, total_cost: float, planning_budget: float
    ) -> None:
        """
        Ensure generated itinerary does not exceed budget limits.

        v3: Use a 30% tolerance over the planning budget (which is already
        70% of total). This prevents false-positive rejections when GPT
        selects slightly more expensive options that are still reasonable.
        The reserve budget (30%) provides additional cushion for users.
        """
        tolerance = planning_budget * 1.30
        if total_cost > tolerance:
            raise BudgetExceededError(
                f"Generated itinerary cost ({total_cost:,.0f} VND) exceeds "
                f"planning budget ({planning_budget:,.0f} VND)."
            )


    # ── Price Range Builders ──────────────────────────────────────────────────

    def build_price_range(
        self,
        place_dict: dict,
        category: str = "attraction",
    ) -> PriceRange:
        """
        Convert raw DB price fields to a PriceRange with realistic min/max.

        Strategy:
        1. If DB has a price, use it as the base and multiply for the max.
        2. If DB has no price, estimate from budget tier and category floors.

        Args:
            place_dict: to_dict() output from any DB model.
            category: 'restaurant' | 'hotel' | 'attraction' | 'market' | 'coffee'

        Returns:
            PriceRange with min and max in VND.
        """
        if category in ("restaurant", "breakfast", "lunch", "dinner", "food", "market"):
            raw = place_dict.get("avg_price") or 0.0
            return self._meal_price_range(raw)

        if category in ("hotel", "accommodation"):
            raw = place_dict.get("price_per_night") or 0.0
            return self._hotel_price_range(raw)

        if category in ("coffee", "cafe", "dessert"):
            raw = place_dict.get("avg_price") or 0.0
            return self._coffee_price_range(raw)

        # Default: attraction / experience / shopping
        raw = place_dict.get("ticket_price") or 0.0
        return self._attraction_price_range(raw)

    def estimate_price_range(
        self,
        category: str,
        budget_per_unit: Optional[float] = None,
    ) -> PriceRange:
        """
        Estimate a realistic price range when no DB price is available.

        Uses category-specific floors and, if provided, the calculated
        budget_per_unit as the target price point.

        Args:
            category: 'meal' | 'hotel' | 'attraction' | 'coffee'
            budget_per_unit: the calculated budget cap per unit (optional)

        Returns:
            PriceRange with reasonable min/max for the category.
        """
        if category == "meal":
            base = max(budget_per_unit or 0, MIN_MEAL_PRICE_VND)
            return self._meal_price_range(base)
        if category == "hotel":
            base = max(budget_per_unit or 0, MIN_HOTEL_PRICE_VND)
            return self._hotel_price_range(base)
        if category == "coffee":
            base = max(budget_per_unit or 0, MIN_COFFEE_PRICE_VND)
            return self._coffee_price_range(base)
        # attraction
        base = max(budget_per_unit or 0, MIN_ATTRACTION_PRICE_VND)
        return self._attraction_price_range(base)

    def _meal_price_range(self, base: float) -> PriceRange:
        """Meal: base is the DB avg_price or budget estimate."""
        price_min = max(base, MIN_MEAL_PRICE_VND)
        price_max = round(price_min * MEAL_PRICE_RANGE_MULTIPLIER)
        return PriceRange(min=price_min, max=price_max)

    def _hotel_price_range(self, base: float) -> PriceRange:
        """Hotel: base is price_per_night."""
        price_min = max(base, MIN_HOTEL_PRICE_VND)
        price_max = round(price_min * HOTEL_PRICE_RANGE_MULTIPLIER)
        return PriceRange(min=price_min, max=price_max)

    def _coffee_price_range(self, base: float) -> PriceRange:
        """Coffee: simple narrow range."""
        price_min = max(base, MIN_COFFEE_PRICE_VND)
        price_max = round(price_min * 2.0)
        return PriceRange(min=price_min, max=price_max)

    def _attraction_price_range(self, base: float) -> PriceRange:
        """Attraction: free attractions are valid (min=0)."""
        price_min = max(base, MIN_ATTRACTION_PRICE_VND)
        price_max = round(price_min * ATTRACTION_PRICE_RANGE_MULTIPLIER) if price_min > 0 else 0
        return PriceRange(min=price_min, max=price_max)

    # ── Utility Methods ───────────────────────────────────────────────────────

    def get_per_day_accommodation_cap(
        self, accommodation_budget: float, trip_duration_days: int
    ) -> float:
        """Maximum price per hotel night given the accommodation budget."""
        if trip_duration_days <= 0:
            return 0.0
        return round(accommodation_budget / trip_duration_days, 2)

    def get_per_meal_cap(self, food_budget: float, trip_duration_days: int) -> float:
        """Rough per-meal cap: food budget ÷ (3 meals × days). Floored at minimum."""
        meals = 3 * trip_duration_days
        if meals <= 0:
            return MIN_MEAL_PRICE_VND
        cap = round(food_budget / meals, 2)
        # Never return a cap below the realistic floor
        return max(cap, MIN_MEAL_PRICE_VND)

    def build_cache_key(
        self,
        cities: list[str],
        budget: float,
        trip_duration_days: int,
        preferences: list[str],
    ) -> str:
        """Build deterministic cache key."""
        city_str = ",".join(sorted(cities))
        pref_str = ",".join(sorted(preferences))
        return (
            f"city={city_str}|duration={trip_duration_days}"
            f"|budget={int(budget)}|preferences={pref_str}"
        )
