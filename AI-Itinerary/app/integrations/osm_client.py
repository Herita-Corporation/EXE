"""
OSM / Nominatim Client — geocoding city names to bounding boxes.
Used by crawlers to derive bounding boxes for Overpass API queries.
Also used live by ItineraryOrchestrator (get_place_coordinates) to attach
GPS coordinates to fixed-anchor activities for the app's map/navigation
feature — Activity.location from GPT is free-text only, never real GPS.
"""

import asyncio
import time
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

# Point-geocode results (place+city query -> lat/lng), process-lifetime.
# Cheap and meaningful: popular places (hotels, landmarks) repeat a lot
# across different users' itineraries for the same city.
_PLACE_COORDS_CACHE: Dict[str, Optional[Tuple[float, float]]] = {}

# Nominatim's usage policy caps anonymous use at 1 request/second — shared
# across all callers in this process, since ItineraryOrchestrator may geocode
# several activities per itinerary.
_last_nominatim_call = 0.0
_nominatim_lock = asyncio.Lock()


class OSMClient:
    """Geocoding client — city name → bounding box; place name → lat/lng."""

    async def get_place_coordinates(
        self, query: str
    ) -> Optional[Tuple[float, float]]:
        """
        Point-geocode a free-text place query (e.g. "Hồ Gươm, Hà Nội") to
        (lat, lng). Cached per process; returns None (never raises) on any
        failure — a missing coordinate just disables auto-navigation for
        that one activity, it must never fail itinerary generation.
        """
        key = query.strip().lower()
        if not key:
            return None
        if key in _PLACE_COORDS_CACHE:
            return _PLACE_COORDS_CACHE[key]

        try:
            result = await self._nominatim_point_lookup(query)
        except Exception as exc:
            logger.warning(
                "nominatim_place_lookup_failed",
                extra={"query": query, "error": str(exc)},
            )
            result = None

        _PLACE_COORDS_CACHE[key] = result
        return result

    async def _nominatim_point_lookup(
        self, query: str
    ) -> Optional[Tuple[float, float]]:
        global _last_nominatim_call
        async with _nominatim_lock:
            wait = (_last_nominatim_call + 1.0) - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            _last_nominatim_call = time.monotonic()

            async with httpx.AsyncClient(
                timeout=3.0,
                headers={"User-Agent": "DISA-Travel-AI-Itinerary/1.0 (educational project)"},
            ) as client:
                response = await client.get(
                    _NOMINATIM_URL,
                    params={"q": query, "format": "json", "limit": 1},
                )
                response.raise_for_status()
                results = response.json()

        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])

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
