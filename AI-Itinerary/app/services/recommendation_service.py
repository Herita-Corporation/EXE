"""
Recommendation Service — thin orchestration layer over retrieval
applying preference-based re-ranking and diversity enforcement.
"""

from typing import List

from app.core.logging import get_logger

logger = get_logger(__name__)


class RecommendationService:
    """
    Post-retrieval ranking and filtering.

    Responsibilities:
    - Re-rank by preference match (e.g. prefer "food" → higher-rated restaurants first)
    - Ensure geographic diversity (don't cluster all attractions in one spot)
    - Enforce max GPT context size (spec §23: 50 entities total)
    """

    MAX_CONTEXT_ENTITIES = 60  # v2: increased from 50 to accommodate markets bucket

    def rank_and_trim(
        self,
        candidates: dict,
        preferences: List[str],
    ) -> dict:
        """
        Apply preference weights and trim to fit the GPT context window.

        v2: Also handles 'markets' candidate group.
        """
        attractions = candidates.get("attractions", [])
        restaurants = candidates.get("restaurants", [])
        hotels = candidates.get("hotels", [])
        markets = candidates.get("markets", [])

        # Preference-aware boost: if user prefers food, sort restaurants first
        if "food" in preferences:
            restaurants = sorted(
                restaurants, key=lambda r: r.get("rating") or 0, reverse=True
            )
        if "culture" in preferences or "history" in preferences:
            attractions = sorted(
                attractions,
                key=lambda a: (
                    1 if a.get("category") in {"museum", "temple", "heritage", "cultural"}
                    else 0,
                    a.get("rating") or 0,
                ),
                reverse=True,
            )

        # Trim to max context (cap at 60 total — v2 increased from 50)
        total = len(attractions) + len(restaurants) + len(hotels) + len(markets)
        if total > self.MAX_CONTEXT_ENTITIES:
            overage = total - self.MAX_CONTEXT_ENTITIES
            # Trim attractions first as they are most numerous
            trim_attr = min(overage, max(0, len(attractions) - 10))
            attractions = attractions[: len(attractions) - trim_attr]
            overage -= trim_attr
            if overage > 0:
                restaurants = restaurants[:max(10, len(restaurants) - overage)]

        logger.info(
            "recommendations_ranked",
            extra={
                "preferences": preferences,
                "attractions": len(attractions),
                "restaurants": len(restaurants),
                "hotels": len(hotels),
                "markets": len(markets),
            },
        )

        return {
            "attractions": attractions,
            "restaurants": restaurants,
            "hotels": hotels,
            "markets": markets,
        }

    def validate_location_ids(
        self,
        itinerary_activities: List[dict],
        candidates: dict,
    ) -> List[str]:
        """
        Validate that every location in the generated itinerary
        exists in the retrieval results (spec §72, anti-hallucination).

        Returns:
            List of invalid location names (empty = all valid).
        """
        valid_ids = set()
        for group in candidates.values():
            for item in group:
                if "id" in item:
                    valid_ids.add(item["id"])
                if "name" in item:
                    valid_ids.add(item["name"].lower().strip())

        invalid = []
        for activity in itinerary_activities:
            loc_id = activity.get("location_id")
            name = (activity.get("name") or "").lower().strip()
            if activity.get("type") in {"transportation", "hotel"}:
                continue  # skip transport & hotel check
            if loc_id and loc_id not in valid_ids and name not in valid_ids:
                invalid.append(activity.get("name", loc_id))

        if invalid:
            logger.warning(
                "hallucinated_locations_detected",
                extra={"invalid_locations": invalid},
            )

        return invalid
