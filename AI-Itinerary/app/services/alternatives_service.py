"""
Alternatives Service — build ranked recommendations for flexible time slots.

v3 redesign:
    Previously: find_alternatives() → List[PlaceDetail] (unordered, no reason)
    Now:        build_recommendations() → List[Recommendation] (priority 1-5, with reason)

Each flexible slot (breakfast/lunch/dinner/coffee/market/shopping) receives
exactly 5 ranked Recommendation objects. The user can freely choose any of
the 5 without having to regenerate the whole itinerary.

Ranking strategy:
    1. The AI-selected place (from GPT output) is always priority 1.
    2. Remaining 4 slots are filled from the candidate pool, scored by:
       - Distance from the current route midpoint (prefer nearby)
       - Category compatibility (same category = higher score)
       - Budget fitness (closer to the slot budget cap = higher score)
       - Rating (higher rating = higher score)

Reason generation:
    Each recommendation gets a short, human-readable Vietnamese/English reason
    explaining why it was ranked at that priority level.
"""

import math
from typing import Any, Dict, List, Optional

from app.core.constants import MAX_RECOMMENDATIONS, MIN_RECOMMENDATIONS
from app.core.logging import get_logger
from app.schemas.itinerary import ActivityType, PlaceDetail, Recommendation

logger = get_logger(__name__)

# ── Geometry ──────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Reason Templates ──────────────────────────────────────────────────────────

_REASON_TEMPLATES = {
    1: [
        "Lựa chọn tốt nhất trong khu vực — được AI đánh giá cao nhất",
        "Đề xuất hàng đầu: gần tuyến đường, chất lượng và giá cả phù hợp",
        "Ưu tiên 1: Rating cao nhất, phù hợp với ngân sách",
    ],
    2: [
        "Lựa chọn thay thế gần đây: {distance:.1f}km, phong cách {category}",
        "Tương tự nhưng phong cách khác — {category}, rating {rating:.1f}/5",
        "Gần tuyến đường, phong cách {category}",
    ],
    3: [
        "Phong cách {category} khác biệt, cách {distance:.1f}km",
        "Tùy chọn tầm trung: {category}, phù hợp nếu muốn thử món mới",
        "Đánh giá {rating:.1f}/5 — lựa chọn ổn định, {category}",
    ],
    4: [
        "Lựa chọn phổ biến với locals — {category}, cách {distance:.1f}km",
        "Giá cả hợp lý hơn, {category}, rating {rating:.1f}/5",
        "Gần điểm tham quan tiếp theo — tiện di chuyển",
    ],
    5: [
        "Tùy chọn dự phòng: {category}, nếu các lựa chọn trên đều đầy",
        "Lựa chọn linh hoạt — {category}, phù hợp mọi khẩu vị",
        "Bổ sung danh sách — {category}, cách {distance:.1f}km",
    ],
}

_FIXED_REASONS = {
    ActivityType.BREAKFAST: {
        1: "Bữa sáng đề xuất — ngon, đúng giờ, gần điểm xuất phát trong ngày",
        2: "Thay thế bữa sáng: cùng khu vực, phong cách {category}",
        3: "Bữa sáng phong phú hơn — {category}, rating {rating:.1f}/5",
        4: "Bữa sáng nhanh gọn — {category}, cách {distance:.1f}km",
        5: "Dự phòng bữa sáng — {category}, phù hợp nếu muốn đổi vị",
    },
    ActivityType.LUNCH: {
        1: "Bữa trưa đề xuất — gần điểm tham quan buổi sáng, rating cao",
        2: "Bữa trưa thay thế: {category}, cách {distance:.1f}km",
        3: "Lựa chọn bữa trưa khác — phong cách {category}",
        4: "Bữa trưa tiết kiệm hơn — {category}, giá từ {price_min:,.0f}đ",
        5: "Dự phòng bữa trưa — {category}",
    },
    ActivityType.DINNER: {
        1: "Bữa tối đề xuất — không gian tốt, gần khách sạn cuối ngày",
        2: "Bữa tối thay thế — {category}, cách {distance:.1f}km",
        3: "Trải nghiệm ẩm thực {category} — rating {rating:.1f}/5",
        4: "Bữa tối bình dân — {category}, giá từ {price_min:,.0f}đ",
        5: "Dự phòng bữa tối — {category}",
    },
    ActivityType.COFFEE: {
        1: "Quán cà phê đề xuất — không gian đẹp, gần tuyến đường",
        2: "Quán cà phê thay thế — {category}, rating {rating:.1f}/5",
        3: "Cà phê phong cách {category}",
        4: "Cà phê nhanh — gần điểm tiếp theo",
        5: "Dự phòng cà phê — {category}",
    },
    ActivityType.MARKET: {
        1: "Chợ đề xuất — nổi tiếng nhất khu vực, gần tuyến đường",
        2: "Chợ thay thế — {category}, cách {distance:.1f}km",
        3: "Chợ địa phương đặc sắc — {category}",
        4: "Chợ nhỏ hơn, ít đông hơn — {category}",
        5: "Dự phòng — chợ {category}",
    },
    ActivityType.SHOPPING: {
        1: "Điểm mua sắm đề xuất — nổi tiếng, gần tuyến đường",
        2: "Mua sắm thay thế — {category}, cách {distance:.1f}km",
        3: "Mua sắm phong cách {category}",
        4: "Mua sắm giá tốt hơn — {category}",
        5: "Dự phòng mua sắm — {category}",
    },
}


def _build_reason(
    priority: int,
    activity_type: ActivityType,
    place: dict,
    distance_km: float,
) -> str:
    """Generate a human-readable Vietnamese reason string for a recommendation."""
    category = (place.get("category") or place.get("cuisine") or "địa phương").lower()
    rating = float(place.get("rating") or 0.0)
    price_min = float(place.get("avg_price") or place.get("ticket_price") or 0.0)

    # Use activity-specific template if available
    template_map = _FIXED_REASONS.get(activity_type, {})
    template = template_map.get(priority, "")

    if not template:
        # Fall back to generic templates
        import random
        templates = _REASON_TEMPLATES.get(priority, ["Lựa chọn phù hợp"])
        template = templates[0]

    try:
        return template.format(
            distance=distance_km,
            category=category,
            rating=rating,
            price_min=price_min,
        )
    except (KeyError, ValueError):
        return template


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score_candidate(
    candidate: dict,
    selected: dict,
    route_lat: Optional[float],
    route_lon: Optional[float],
    price_key: str,
    budget_cap: float,
) -> float:
    """
    Composite score for ranking candidates as alternatives.

    Weights:
        40% rating
        30% distance from route (closer = better)
        20% category compatibility (same category = boost)
        10% budget fitness
    """
    rating = float(candidate.get("rating") or 0.0)
    rating_score = (rating / 5.0) * 0.4

    # Distance from route midpoint
    dist_score = 0.3
    if route_lat and route_lon:
        cand_lat = candidate.get("latitude") or candidate.get("lat")
        cand_lon = candidate.get("longitude") or candidate.get("lng") or candidate.get("lon")
        if cand_lat and cand_lon:
            dist_km = _haversine_km(route_lat, route_lon, float(cand_lat), float(cand_lon))
            dist_score = 0.3 * max(0.0, 1.0 - dist_km / 5.0)  # penalty beyond 5km

    # Category compatibility
    sel_cat = (selected.get("category") or selected.get("cuisine") or "").lower()
    cand_cat = (candidate.get("category") or candidate.get("cuisine") or "").lower()
    cat_score = 0.2 if sel_cat == cand_cat else 0.1 if _cat_compatible(sel_cat, cand_cat) else 0.0

    # Budget fitness
    price = float(candidate.get(price_key) or 0.0)
    if price <= 0:
        budget_score = 0.1 * 0.5  # neutral for free
    elif budget_cap <= 0:
        budget_score = 0.1 * 0.5
    elif price <= budget_cap:
        budget_score = 0.1 * 1.0
    else:
        budget_score = 0.1 * (budget_cap / price)

    return rating_score + dist_score + cat_score + budget_score


def _cat_compatible(cat1: str, cat2: str) -> bool:
    """Check if two categories are broadly compatible (e.g. both food)."""
    food_cats = {"vietnamese", "international", "asian", "seafood", "cafe", "restaurant"}
    return (cat1 in food_cats) == (cat2 in food_cats)


def _distance_from_selected(candidate: dict, selected: dict) -> float:
    """Get distance in km between candidate and selected place."""
    s_lat = selected.get("latitude") or selected.get("lat")
    s_lon = selected.get("longitude") or selected.get("lng") or selected.get("lon")
    c_lat = candidate.get("latitude") or candidate.get("lat")
    c_lon = candidate.get("longitude") or candidate.get("lng") or candidate.get("lon")

    if s_lat and s_lon and c_lat and c_lon:
        return _haversine_km(float(s_lat), float(s_lon), float(c_lat), float(c_lon))
    return 999.0


# ── Main Service ──────────────────────────────────────────────────────────────

class AlternativesService:
    """
    Builds ranked recommendations (priority 1-5) for each flexible slot.

    v3: build_recommendations() replaces find_alternatives().
    Returns List[Recommendation] with priority int and reason str.
    """

    def __init__(self, budget_service=None):
        self._budget_svc = budget_service

    def build_recommendations(
        self,
        selected: dict,
        all_candidates: List[dict],
        activity_type: ActivityType,
        route_lat: Optional[float] = None,
        route_lon: Optional[float] = None,
        budget_cap: float = 0.0,
    ) -> List[Recommendation]:
        """
        Build a ranked list of exactly MIN_RECOMMENDATIONS (5) recommendations.

        Args:
            selected:        The AI-selected (priority-1) candidate dict from DB.
            all_candidates:  Full pool of candidates for this activity type.
            activity_type:   Type of the slot (breakfast/lunch/dinner/...).
            route_lat/lon:   Geographic midpoint of the day's travel route.
            budget_cap:      Per-item budget ceiling (soft hint for ranking).

        Returns:
            List of Recommendation objects with priority 1–5 and reason strings.
            - Priority 1 = selected (AI top pick)
            - Priority 2–5 = best alternatives ranked by composite score

        Notes:
            - The selected place is ALWAYS priority 1 regardless of its score.
            - If the pool has fewer than 5 candidates, returns whatever is available.
            - Candidates already chosen as priority 1 are excluded from 2-5.
        """
        if not selected:
            return []

        # Determine the price field for scoring
        price_key = self._price_key_for_type(activity_type)

        # ── Priority 1: AI-selected place ─────────────────────────────────────
        selected_id = selected.get("id") or selected.get("name", "")
        priority1_place = self._dict_to_place_detail(selected)
        distance_p1 = 0.0  # The selected place is on-route by definition

        recommendations: List[Recommendation] = [
            Recommendation(
                priority=1,
                place=priority1_place,
                reason=_build_reason(1, activity_type, selected, distance_p1),
            )
        ]

        # ── Priority 2–5: Score remaining candidates ───────────────────────────
        # Exclude the selected place itself
        other_candidates = [
            c for c in all_candidates
            if (c.get("id") or c.get("name", "")) != selected_id
        ]

        # Score and sort
        scored = []
        for cand in other_candidates:
            dist = _distance_from_selected(cand, selected)
            score = _score_candidate(
                cand, selected, route_lat, route_lon, price_key, budget_cap
            )
            scored.append((score, dist, cand))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Take top (MAX_RECOMMENDATIONS - 1) = 4 for priorities 2-5
        for rank_idx, (score, dist, cand) in enumerate(scored[: MAX_RECOMMENDATIONS - 1]):
            priority = rank_idx + 2  # 2, 3, 4, 5
            place = self._dict_to_place_detail(cand)
            reason = _build_reason(priority, activity_type, cand, dist)
            recommendations.append(
                Recommendation(priority=priority, place=place, reason=reason)
            )

        # Log if we couldn't fill all 5 slots
        if len(recommendations) < MIN_RECOMMENDATIONS:
            logger.warning(
                "insufficient_recommendations",
                extra={
                    "activity_type": activity_type,
                    "got": len(recommendations),
                    "wanted": MIN_RECOMMENDATIONS,
                    "pool_size": len(all_candidates),
                },
            )

        logger.debug(
            "recommendations_built",
            extra={
                "activity_type": str(activity_type),
                "count": len(recommendations),
                "selected": selected.get("name"),
            },
        )

        return recommendations

    # ── Backward-compat alias ──────────────────────────────────────────────────

    def find_alternatives(
        self,
        selected: dict,
        all_candidates: List[dict],
        activity_type: ActivityType,
    ) -> List[PlaceDetail]:
        """
        Backward-compatible wrapper for old code that calls find_alternatives().
        Returns List[PlaceDetail] (the place objects from recommendations[1:]).
        """
        recs = self.build_recommendations(selected, all_candidates, activity_type)
        return [r.place for r in recs[1:]]

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _dict_to_place_detail(self, place: dict) -> PlaceDetail:
        """Convert a raw DB candidate dict to PlaceDetail schema object."""
        from app.schemas.itinerary import LocationCoords, PriceRange

        lat = place.get("latitude") or place.get("lat")
        lon = place.get("longitude") or place.get("lng") or place.get("lon")
        location = LocationCoords(lat=float(lat), lng=float(lon)) if lat and lon else None

        # Price range
        price_range = None
        if self._budget_svc:
            cat = place.get("_group", "attraction")
            price_range = self._budget_svc.build_price_range(place, cat)
        else:
            raw = (
                place.get("avg_price")
                or place.get("price_per_night")
                or place.get("ticket_price")
                or 0.0
            )
            if raw and float(raw) > 0:
                mn = float(raw)
                price_range = PriceRange(min=mn, max=round(mn * 2.0))

        category = (
            place.get("category")
            or place.get("cuisine")
            or place.get("_group", "attraction")
        )

        return PlaceDetail(
            id=str(place["id"]) if place.get("id") else None,
            name=place.get("name") or "Unknown",
            category=category,
            location=location,
            price_range=price_range,
            rating=float(place["rating"]) if place.get("rating") else None,
            review_count=place.get("review_count"),
        )

    @staticmethod
    def _price_key_for_type(activity_type: ActivityType) -> str:
        """Return the DB column name for price based on activity type."""
        if activity_type in (
            ActivityType.BREAKFAST,
            ActivityType.LUNCH,
            ActivityType.DINNER,
            ActivityType.COFFEE,
        ):
            return "avg_price"
        if activity_type == ActivityType.HOTEL:
            return "price_per_night"
        return "ticket_price"
