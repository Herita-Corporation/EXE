"""
Overpass API Client — fetches OpenStreetMap POI data for the knowledge base.
Used by crawlers to populate attractions, restaurants, and hotels.
"""

import asyncio
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Public Overpass API endpoints — rotated on transient failures
_OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Overpass QL templates
_ATTRACTION_QUERY = """
[out:json][timeout:90];
(
  node["tourism"~"attraction|museum|artwork|viewpoint|theme_park"]{bbox};
  node["historic"~"monument|castle|ruins|memorial"]{bbox};
  way["tourism"~"attraction|museum"]{bbox};
);
out center tags 100;
"""

_RESTAURANT_QUERY = """
[out:json][timeout:90];
(
  node["amenity"="restaurant"]{bbox};
  node["amenity"="cafe"]{bbox};
  node["amenity"="fast_food"]{bbox};
);
out center tags 100;
"""

_HOTEL_QUERY = """
[out:json][timeout:90];
(
  node["tourism"~"hotel|hostel|guest_house|apartment"]{bbox};
  way["tourism"~"hotel|hostel"]{bbox};
);
out center tags 100;
"""


class OverpassClient:
    """Async Overpass API client for querying OpenStreetMap data."""

    def __init__(self, base_url: str | None = None):
        # Primary endpoint from config; fallbacks are always available
        primary = base_url or settings.OVERPASS_URL
        # Build endpoint list: primary first, then remaining fallbacks
        others = [ep for ep in _OVERPASS_ENDPOINTS if ep != primary]
        self.endpoints = [primary] + others

    async def _query(self, ql: str, max_retries: int = 3) -> List[Dict[str, Any]]:
        """Execute an Overpass QL query and return elements.

        Rotates through fallback endpoints on transient server errors (429, 502, 504)
        with exponential backoff between retries.
        """
        headers = {
            "User-Agent": "AI-Itinerary/2.0 (educational project)",
            "Accept": "application/json",
        }
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            # Rotate endpoints: attempt 0 → primary, attempt 1 → fallback 1, etc.
            endpoint = self.endpoints[attempt % len(self.endpoints)]
            try:
                async with httpx.AsyncClient(timeout=120.0, headers=headers) as client:
                    response = await client.post(endpoint, data={"data": ql})
                    # Retry on transient server errors
                    if response.status_code in (429, 502, 503, 504):
                        wait = 5 * (2 ** attempt)  # 5s, 10s, 20s
                        logger.warning(
                            "overpass_transient_error",
                            extra={"status": response.status_code, "endpoint": endpoint, "attempt": attempt + 1, "wait_s": wait},
                        )
                        await asyncio.sleep(wait)
                        continue
                    response.raise_for_status()
                    return response.json().get("elements", [])
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                wait = 5 * (2 ** attempt)
                logger.warning(
                    "overpass_connection_error",
                    extra={"error": str(exc), "endpoint": endpoint, "attempt": attempt + 1, "wait_s": wait},
                )
                last_exc = exc
                await asyncio.sleep(wait)
        raise RuntimeError(f"Overpass API failed after {max_retries} retries across all endpoints") from last_exc

    def _bbox_string(self, bbox: Tuple[float, float, float, float]) -> str:
        """Convert (south, west, north, east) bbox to Overpass filter string."""
        s, w, n, e = bbox
        return f"({s},{w},{n},{e})"

    async def query_attractions(
        self, bbox: Tuple[float, float, float, float]
    ) -> List[Dict[str, Any]]:
        bbox_str = self._bbox_string(bbox)
        ql = _ATTRACTION_QUERY.replace("{bbox}", bbox_str)
        elements = await self._query(ql)
        logger.info("overpass_attractions", extra={"bbox": bbox, "count": len(elements)})
        return elements

    async def query_restaurants(
        self, bbox: Tuple[float, float, float, float]
    ) -> List[Dict[str, Any]]:
        bbox_str = self._bbox_string(bbox)
        ql = _RESTAURANT_QUERY.replace("{bbox}", bbox_str)
        elements = await self._query(ql)
        logger.info("overpass_restaurants", extra={"bbox": bbox, "count": len(elements)})
        return elements

    async def query_hotels(
        self, bbox: Tuple[float, float, float, float]
    ) -> List[Dict[str, Any]]:
        bbox_str = self._bbox_string(bbox)
        ql = _HOTEL_QUERY.replace("{bbox}", bbox_str)
        elements = await self._query(ql)
        logger.info("overpass_hotels", extra={"bbox": bbox, "count": len(elements)})
        return elements

    @staticmethod
    def extract_coords(element: Dict) -> Optional[Tuple[float, float]]:
        """Extract lat/lon from a node or way (with center)."""
        if element.get("type") == "node":
            return element.get("lat"), element.get("lon")
        center = element.get("center", {})
        if center:
            return center.get("lat"), center.get("lon")
        return None
