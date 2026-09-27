"""
Route Optimizer — segment-based routing with anchor/flexible distinction.

v2 redesign:
    Previously: flat TSP over all locations → ignored location type.
    Now: Anchor-first routing with flexible slots inserted between anchors.

    Architecture:
        1. Separate locations into fixed (anchor) and flexible types
        2. Optimize the anchor sequence using greedy nearest-neighbour TSP
        3. For each anchor→anchor segment, identify flexible candidates
           that lie along the route (minimal detour)
        4. Return a RouteResult with both the optimized anchor sequence
           and per-segment flexible candidates

    This ensures breakfast/lunch/dinner slots are chosen based on
    the travel direction, not selected globally and randomly.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

from app.core.constants import FIXED_ACTIVITY_TYPES, FLEXIBLE_ACTIVITY_TYPES
from app.core.logging import get_logger
from app.integrations.osrm_client import OSRMClient

logger = get_logger(__name__)


# ── Geometry Helpers ──────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def classify_slot_type(activity_type: str) -> str:
    """
    Return 'fixed' for anchor locations, 'flexible' for meal/shopping slots.

    Fixed locations define the route backbone.
    Flexible locations are chosen along the route between fixed anchors.
    """
    t = activity_type.lower().strip()
    if t in FLEXIBLE_ACTIVITY_TYPES:
        return "flexible"
    return "fixed"


# ── Route Result ──────────────────────────────────────────────────────────────

class RouteResult:
    """
    Structured result from route optimization.

    Attributes:
        ordered_anchors:           Fixed locations in optimized visit order.
        estimated_distance_km:     Total travel distance along the anchor route.
        estimated_duration_min:    Total travel time along the anchor route.
        segments:                  Per-segment info including along-route candidates.
    """
    def __init__(
        self,
        ordered_anchors: List[Dict],
        estimated_distance_km: float,
        estimated_duration_min: float,
        segments: Optional[List[Dict]] = None,
    ):
        self.ordered_anchors = ordered_anchors
        self.estimated_distance_km = estimated_distance_km
        self.estimated_duration_min = estimated_duration_min
        self.segments = segments or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ordered_locations": self.ordered_anchors,
            "estimated_distance_km": self.estimated_distance_km,
            "estimated_duration_min": self.estimated_duration_min,
            "segments": self.segments,
        }


# ── Route Optimizer ───────────────────────────────────────────────────────────

class RouteOptimizer:
    """
    Optimizes the visiting order of candidate locations using an anchor-first strategy.

    Strategy:
    1. Split candidates into fixed (anchors) and flexible.
    2. Optimize anchor sequence with greedy nearest-neighbour TSP (OSRM or Haversine).
    3. Build route segments: each segment is a pair of adjacent anchors.
    4. Return RouteResult for the orchestrator to use when building day plans.
    """

    def __init__(self, osrm_client: OSRMClient):
        self.osrm = osrm_client

    async def optimize(
        self,
        locations: List[Dict[str, Any]],
        travel_mode: str = "car",
    ) -> Dict[str, Any]:
        """
        Backward-compatible entry point. Optimizes all locations as anchors.

        Returns a flat dict (same format as v1) for use in GPT context.
        """
        result = await self.optimize_anchors(locations, travel_mode)
        return result.to_dict()

    async def optimize_anchors(
        self,
        anchors: List[Dict[str, Any]],
        travel_mode: str = "car",
    ) -> RouteResult:
        """
        Optimize the ordering of fixed anchor locations.

        Args:
            anchors:      List of fixed location dicts (hotels, attractions).
            travel_mode:  OSRM profile: car | foot | bike.

        Returns:
            RouteResult with optimized sequence and per-segment data.
        """
        if not anchors:
            return RouteResult([], 0.0, 0.0)

        if len(anchors) == 1:
            return RouteResult(anchors, 0.0, 0.0)

        valid = [
            loc for loc in anchors
            if loc.get("latitude") and loc.get("longitude")
        ]

        if not valid:
            return RouteResult(anchors, 0.0, 0.0)

        coords: List[Tuple[float, float]] = [
            (float(loc["latitude"]), float(loc["longitude"]))
            for loc in valid
        ]

        # Attempt OSRM-backed optimization
        try:
            matrix = await self.osrm.get_distance_matrix(coords, travel_mode)
            ordered_indices = self._nearest_neighbour(matrix["durations"])
            ordered = [valid[i] for i in ordered_indices]
            total_dist = self._total_haversine_distance(ordered)
            total_dur = self._total_duration(matrix["durations"], ordered_indices)

            logger.info(
                "route_optimized_osrm",
                extra={
                    "n_anchors": len(ordered),
                    "distance_km": total_dist,
                    "duration_min": total_dur,
                },
            )
            segments = self._build_segments(ordered)
            return RouteResult(
                ordered_anchors=ordered,
                estimated_distance_km=round(total_dist, 2),
                estimated_duration_min=round(total_dur, 2),
                segments=segments,
            )
        except Exception as exc:
            logger.warning("osrm_fallback_haversine", extra={"reason": str(exc)})
            return self._haversine_fallback(valid)

    def _build_segments(self, ordered_anchors: List[Dict]) -> List[Dict]:
        """
        Build route segments between consecutive anchors.

        Each segment contains:
        - from: start anchor
        - to: end anchor
        - distance_km: straight-line distance
        - midpoint: geographic midpoint (for along-route search)
        """
        segments = []
        for i in range(len(ordered_anchors) - 1):
            a = ordered_anchors[i]
            b = ordered_anchors[i + 1]
            a_lat, a_lon = float(a["latitude"]), float(a["longitude"])
            b_lat, b_lon = float(b["latitude"]), float(b["longitude"])
            dist = haversine_km(a_lat, a_lon, b_lat, b_lon)
            segments.append({
                "from": a,
                "to": b,
                "distance_km": round(dist, 2),
                "midpoint": {
                    "latitude": (a_lat + b_lat) / 2,
                    "longitude": (a_lon + b_lon) / 2,
                },
            })
        return segments

    def _nearest_neighbour(self, duration_matrix: List[List[float]]) -> List[int]:
        """Greedy nearest-neighbour TSP starting from index 0."""
        n = len(duration_matrix)
        visited = [False] * n
        order = [0]
        visited[0] = True

        for _ in range(n - 1):
            current = order[-1]
            best_next = -1
            best_time = float("inf")
            for j in range(n):
                if not visited[j]:
                    t = duration_matrix[current][j]
                    if t < best_time:
                        best_time = t
                        best_next = j
            if best_next >= 0:
                order.append(best_next)
                visited[best_next] = True

        return order

    def _total_haversine_distance(self, locations: List[Dict]) -> float:
        """Sum of Haversine distances along the ordered route in km."""
        total = 0.0
        for i in range(len(locations) - 1):
            a, b = locations[i], locations[i + 1]
            total += haversine_km(
                float(a["latitude"]), float(a["longitude"]),
                float(b["latitude"]), float(b["longitude"]),
            )
        return total

    def _total_duration(
        self, matrix: List[List[float]], order: List[int]
    ) -> float:
        """Sum of OSRM travel times in minutes."""
        total = 0.0
        for i in range(len(order) - 1):
            total += matrix[order[i]][order[i + 1]]
        return total / 60.0  # seconds → minutes

    def _haversine_fallback(self, locations: List[Dict]) -> RouteResult:
        """Nearest-neighbour TSP using pure Haversine when OSRM is unavailable."""
        if not locations:
            return RouteResult([], 0.0, 0.0)

        ordered = [locations[0]]
        remaining = list(locations[1:])

        while remaining:
            last = ordered[-1]
            nearest = min(
                remaining,
                key=lambda loc: haversine_km(
                    float(last["latitude"]), float(last["longitude"]),
                    float(loc["latitude"]), float(loc["longitude"]),
                ),
            )
            ordered.append(nearest)
            remaining.remove(nearest)

        total_dist = self._total_haversine_distance(ordered)
        segments = self._build_segments(ordered)
        return RouteResult(
            ordered_anchors=ordered,
            estimated_distance_km=round(total_dist, 2),
            estimated_duration_min=round(total_dist * 2, 2),  # rough estimate
            segments=segments,
        )
