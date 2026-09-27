"""
OSM / Nominatim Client — geocoding city names to bounding boxes.
Used by crawlers to derive bounding boxes for Overpass API queries.
"""

from typing import Dict, Optional, Tuple

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

# Pre-cached bounding boxes for common Vietnamese cities
# Format: (south, west, north, east)
CITY_BBOX_CACHE: Dict[str, Tuple[float, float, float, float]] = {
    "da nang": (15.9800, 108.0700, 16.1500, 108.3000),
    "hoi an": (15.8500, 108.2800, 15.9200, 108.4000),
    "ho chi minh": (10.6000, 106.5700, 10.9000, 106.8500),
    "hcm": (10.6000, 106.5700, 10.9000, 106.8500),
    "ho chi minh city": (10.6000, 106.5700, 10.9000, 106.8500),
    "hanoi": (20.9500, 105.7000, 21.1000, 106.0000),
    "ha noi": (20.9500, 105.7000, 21.1000, 106.0000),
    "hue": (16.3800, 107.5200, 16.5200, 107.7000),
    "nha trang": (12.1500, 109.1000, 12.3000, 109.2500),
    "da lat": (11.8500, 108.3500, 11.9800, 108.5000),
    "dalat": (11.8500, 108.3500, 11.9800, 108.5000),
    "phu quoc": (9.8000, 103.8000, 10.4000, 104.1000),
    "can tho": (9.9500, 105.6500, 10.1200, 105.8500),
    "quy nhon": (13.7000, 109.1500, 13.8500, 109.3000),
    "vung tau": (10.3000, 107.0300, 10.5000, 107.1500),
    "ha long": (20.8500, 106.9500, 21.0500, 107.3000),
    "ha long bay": (20.8500, 106.9500, 21.0500, 107.3000),
}

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


class OSMClient:
    """Geocoding client — city name → bounding box."""

    async def get_city_bbox(
        self, city: str
    ) -> Optional[Tuple[float, float, float, float]]:
        """
        Return (south, west, north, east) bounding box for a city.

        First checks local cache; falls back to Nominatim API.

        Args:
            city: City name (case-insensitive).

        Returns:
            Bounding box tuple or None if not found.
        """
        key = city.lower().strip()
        if key in CITY_BBOX_CACHE:
            return CITY_BBOX_CACHE[key]

        try:
            return await self._nominatim_lookup(city)
        except Exception as exc:
            logger.warning(
                "nominatim_lookup_failed",
                extra={"city": city, "error": str(exc)},
            )
            return None

    async def _nominatim_lookup(
        self, city: str
    ) -> Optional[Tuple[float, float, float, float]]:
        """Call Nominatim to look up a city bounding box."""
        async with httpx.AsyncClient(
            timeout=10.0,
            headers={"User-Agent": "AI-Itinerary/2.0 (educational project)"},
        ) as client:
            response = await client.get(
                _NOMINATIM_URL,
                params={
                    "q": city,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 0,
                },
            )
            response.raise_for_status()
            results = response.json()

        if not results:
            return None

        place = results[0]
        bb = place.get("boundingbox", [])
        if len(bb) != 4:
            return None

        south, north, west, east = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
        bbox = (south, west, north, east)
        CITY_BBOX_CACHE[city.lower().strip()] = bbox
        return bbox
