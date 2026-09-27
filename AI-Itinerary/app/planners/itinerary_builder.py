"""
Itinerary Builder — assembles validated DayPlan objects from GPT output.

v4 changes (direct-generation, no RAG):
- No candidate pool — GPT's own output (name, location, cost, rating) is
  used as-is, no DB lookup/enrichment/anti-hallucination matching.
- No recommendations/alternatives — those existed only to offer swap-options
  sourced from the DB candidate pool.
- Hotel-first/hotel-last are no longer programmatically injected — the
  prompt instructs GPT to structure each day itself. Structure is still
  checked (warn-only) by the orchestrator's `_validate_structure`.
"""

import json
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app.core.constants import (
    AFTERNOON_ATTRACTION_END,
    AFTERNOON_ATTRACTION_START,
    BREAKFAST_END,
    BREAKFAST_START,
    DINNER_END,
    DINNER_START,
    FLEXIBLE_ACTIVITY_TYPES,
    HOTEL_RETURN_END,
    HOTEL_RETURN_START,
    LUNCH_END,
    LUNCH_START,
    MORNING_ATTRACTION_END,
    MORNING_ATTRACTION_START,
)
from app.core.exceptions import InvalidItineraryError
from app.core.logging import get_logger
from app.schemas.itinerary import Activity, ActivityType, DayPlan, SlotType

logger = get_logger(__name__)

# GPT activity type string → ActivityType enum mapping
_TYPE_MAP: Dict[str, ActivityType] = {
    "transportation": ActivityType.TRANSPORTATION,
    "breakfast": ActivityType.BREAKFAST,
    "lunch": ActivityType.LUNCH,
    "dinner": ActivityType.DINNER,
    "attraction": ActivityType.ATTRACTION,
    "hotel": ActivityType.HOTEL,
    "shopping": ActivityType.SHOPPING,
    "experience": ActivityType.EXPERIENCE,
    "market": ActivityType.MARKET,
    "coffee": ActivityType.COFFEE,
}


def compute_total_cost(day_plans: List[DayPlan]) -> float:
    """
    Sums a full itinerary's cost. Hotel activities appear 2-3 times per day
    (check-in, rest, overnight stay) — counted only ONCE per day (the highest
    hotel cost seen, i.e. the overnight rate) to avoid inflating the total.
    Shared by the initial generation pipeline and the "replace one activity"
    endpoint, so both compute the total the same way.
    """
    total_cost = 0.0
    for day in day_plans:
        day_hotel_cost = 0.0
        for a in day.activities:
            if a.type == ActivityType.HOTEL:
                if a.cost > day_hotel_cost:
                    day_hotel_cost = a.cost
            else:
                total_cost += a.cost
        total_cost += day_hotel_cost
    return total_cost


class ItineraryBuilder:
    """Converts raw GPT JSON output into validated DayPlan objects."""

    def build_from_gpt_output(
        self,
        gpt_raw: str,
        start_date: date,
        cities: List[str],
    ) -> List[DayPlan]:
        """
        Parse and validate GPT output into structured day plans.

        Args:
            gpt_raw:    Raw JSON string from GPT.
            start_date: Trip start date.
            cities:     Ordered list of cities.

        Returns:
            List of validated DayPlan objects.

        Raises:
            InvalidItineraryError: On parse or validation failure.
        """
        try:
            data = json.loads(gpt_raw)
        except json.JSONDecodeError as exc:
            raise InvalidItineraryError(f"GPT returned invalid JSON: {exc}")

        days_data = data.get("days", [])
        if not days_data:
            raise InvalidItineraryError("GPT returned no daily plans.")

        day_plans = []
        for i, day_data in enumerate(days_data):
            day_date = start_date + timedelta(days=i)
            city = day_data.get("city", cities[min(i, len(cities) - 1)])
            activities_raw = day_data.get("activities", [])

            activities = self._build_activities(activities_raw)

            day_plans.append(DayPlan(date=str(day_date), city=city, activities=activities))

        return day_plans

    def _build_activities(self, activities_raw: List[Dict]) -> List[Activity]:
        """Parse a single day's activities, fixing any time overlaps."""
        activities: List[Activity] = []
        prev_end = "00:00"

        for act_data in activities_raw:
            act = self._parse_activity(act_data)
            if act is None:
                continue

            if act.start_time < prev_end:
                act = self._adjust_times(act, prev_end)

            activities.append(act)
            prev_end = act.end_time

        return activities

    def _parse_activity(self, data: Dict[str, Any]) -> Optional[Activity]:
        """Parse a raw GPT activity dict directly into an Activity."""
        try:
            raw_type = data.get("type", "attraction").lower().strip()
            name = data.get("name", "Unknown")

            activity_type = _TYPE_MAP.get(raw_type, ActivityType.ATTRACTION)
            slot_type = (
                SlotType.FLEXIBLE
                if raw_type in FLEXIBLE_ACTIVITY_TYPES
                else SlotType.FIXED
            )

            activity_label = data.get("activity") or data.get("notes") or name

            return Activity(
                start_time=data.get("start_time", "09:00"),
                end_time=data.get("end_time", "10:00"),
                type=activity_type,
                slot_type=slot_type,
                activity=activity_label,
                name=name,
                location=data.get("location"),
                cost=float(data["cost"]) if data.get("cost") else 0.0,
                rating=float(data["rating"]) if data.get("rating") else None,
                notes=data.get("notes"),
            )
        except Exception as exc:
            logger.warning(
                "activity_parse_error",
                extra={"data": str(data)[:200], "error": str(exc)},
            )
            return None

    def _adjust_times(self, activity: Activity, prev_end: str) -> Activity:
        """Shift activity times forward to avoid overlap."""
        start_h, start_m = map(int, prev_end.split(":"))
        end_h, end_m = map(int, activity.end_time.split(":"))
        orig_start_h, orig_start_m = map(int, activity.start_time.split(":"))

        duration_m = (end_h * 60 + end_m) - (orig_start_h * 60 + orig_start_m)
        new_start_total = start_h * 60 + start_m + 5  # 5 min buffer
        new_end_total = new_start_total + max(duration_m, 30)

        new_start = f"{new_start_total // 60:02d}:{new_start_total % 60:02d}"
        new_end = f"{new_end_total // 60:02d}:{new_end_total % 60:02d}"

        return activity.model_copy(update={"start_time": new_start, "end_time": new_end})

    def build_default_day(self, day_date: date, city: str) -> DayPlan:
        """
        Generate a minimal default day plan when GPT fails.
        Uses fixed time slots from constants.
        """
        return DayPlan(
            date=str(day_date),
            city=city,
            activities=[
                Activity(
                    start_time=BREAKFAST_START,
                    end_time=BREAKFAST_END,
                    type=ActivityType.BREAKFAST,
                    slot_type=SlotType.FLEXIBLE,
                    activity="Local breakfast",
                    name="Local breakfast",
                    cost=30000,
                ),
                Activity(
                    start_time=MORNING_ATTRACTION_START,
                    end_time=MORNING_ATTRACTION_END,
                    type=ActivityType.ATTRACTION,
                    slot_type=SlotType.FIXED,
                    activity=f"Explore {city}",
                    name=f"Explore {city}",
                    cost=0,
                ),
                Activity(
                    start_time=LUNCH_START,
                    end_time=LUNCH_END,
                    type=ActivityType.LUNCH,
                    slot_type=SlotType.FLEXIBLE,
                    activity="Local lunch",
                    name="Local lunch",
                    cost=50000,
                ),
                Activity(
                    start_time=AFTERNOON_ATTRACTION_START,
                    end_time=AFTERNOON_ATTRACTION_END,
                    type=ActivityType.ATTRACTION,
                    slot_type=SlotType.FIXED,
                    activity=f"Afternoon in {city}",
                    name=f"Afternoon in {city}",
                    cost=0,
                ),
                Activity(
                    start_time=DINNER_START,
                    end_time=DINNER_END,
                    type=ActivityType.DINNER,
                    slot_type=SlotType.FLEXIBLE,
                    activity="Local dinner",
                    name="Local dinner",
                    cost=80000,
                ),
                Activity(
                    start_time=HOTEL_RETURN_START,
                    end_time=HOTEL_RETURN_END,
                    type=ActivityType.HOTEL,
                    slot_type=SlotType.FIXED,
                    activity=f"Return to hotel in {city}",
                    name=f"Hotel in {city}",
                    cost=0,
                ),
            ],
        )
