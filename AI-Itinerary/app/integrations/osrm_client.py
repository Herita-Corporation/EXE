"""
OSRM Client — route optimization and distance matrix.
Spec §27: No Google Directions API required.
Falls back silently if OSRM is unreachable.
"""

from typing import Any, Dict, List, Tuple

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class OSRMClient:
    """
    Async OSRM HTTP client.

    Endpoints used:
    - /table/v1/{profile}/{coords} — distance matrix
    - /route/v1/{profile}/{coords} — point-to-point route
    """

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.OSRM_URL).rstrip("/")

    async def get_distance_matrix(
        self,
        coordinates: List[Tuple[float, float]],
        travel_mode: str = "car",
    ) -> Dict[str, Any]:
        """
        Request a full NxN duration (seconds) and distance (metres) matrix.

        Args:
            coordinates: List of (latitude, longitude) tuples.
            travel_mode: OSRM profile name.

        Returns:
            {"durations": [[...], ...], "distances": [[...], ...]}

        Raises:
            httpx.HTTPError on network failure.
        """
        if len(coordinates) < 2:
            return {"durations": [[0]], "distances": [[0]]}

        # OSRM uses lon,lat order
        coord_str = ";".join(f"{lon},{lat}" for lat, lon in coordinates)
        url = f"{self.base_url}/table/v1/{travel_mode}/{coord_str}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                params={"annotations": "duration,distance"},
            )
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            raise ValueError(f"OSRM error: {data.get('code')} — {data.get('message')}")

        return {
            "durations": data["durations"],
            "distances": data.get("distances", []),
        }

    async def get_route(
        self,
        waypoints: List[Tuple[float, float]],
        travel_mode: str = "car",
    ) -> Dict[str, Any]:
        """
        Get a single route between ordered waypoints.

        Returns:
            {"distance_m": float, "duration_s": float}
        """
        coord_str = ";".join(f"{lon},{lat}" for lat, lon in waypoints)
        url = f"{self.base_url}/route/v1/{travel_mode}/{coord_str}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                params={"overview": "false"},
            )
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            raise ValueError(f"OSRM route error: {data.get('code')}")

        route = data["routes"][0]
        return {
            "distance_m": route["distance"],
            "duration_s": route["duration"],
        }
