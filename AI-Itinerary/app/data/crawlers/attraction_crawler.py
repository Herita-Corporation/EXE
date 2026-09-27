"""
Attraction Crawler — fetches attraction data from Overpass API
and stores it in the knowledge base.
"""

import asyncio
import uuid

from app.core.constants import MAX_RATING, MIN_RATING
from app.core.logging import get_logger
from app.database.models.attraction import Attraction
from app.database.session import AsyncSessionLocal
from app.integrations.osm_client import OSMClient
from app.integrations.overpass_client import OverpassClient

logger = get_logger(__name__)

# Cities to crawl — extend as needed
TARGET_CITIES = [
    "Da Nang",
    "Hoi An",
    "Ho Chi Minh City",
    "Hanoi",
    "Hue",
    "Nha Trang",
    "Da Lat",
    "Phu Quoc",
]


class AttractionCrawler:
    def __init__(self):
        self.overpass = OverpassClient()
        self.osm = OSMClient()

    async def crawl_city(self, city: str) -> int:
        """Crawl attractions for a single city. Returns count saved."""
        bbox = await self.osm.get_city_bbox(city)
        if not bbox:
            logger.warning("no_bbox_for_city", extra={"city": city})
            return 0

        elements = await self.overpass.query_attractions(bbox)
        saved = 0

        async with AsyncSessionLocal() as session:
            for element in elements:
                coords = self.overpass.extract_coords(element)
                if not coords or None in coords:
                    continue
                lat, lon = coords
                tags = element.get("tags", {})
                name = tags.get("name") or tags.get("name:en")
                if not name:
                    continue

                attraction = Attraction(
                    id=uuid.uuid4(),
                    name=name[:255],
                    city=city,
                    latitude=lat,
                    longitude=lon,
                    rating=None,
                    review_count=None,
                    ticket_price=None,
                    category=tags.get("tourism") or tags.get("historic") or "attraction",
                    description=tags.get("description"),
                    source="overpass",
                )
                session.add(attraction)
                saved += 1

            await session.commit()

        logger.info("crawl_attractions_done", extra={"city": city, "saved": saved})
        return saved

    async def crawl_all(self) -> None:
        """Crawl all target cities sequentially to respect Overpass rate limits."""
        for city in TARGET_CITIES:
            try:
                count = await self.crawl_city(city)
                logger.info("city_crawled", extra={"city": city, "attractions": count})
                await asyncio.sleep(2)  # Polite delay
            except Exception as exc:
                logger.error("crawl_city_failed", extra={"city": city, "error": str(exc)})


if __name__ == "__main__":
    asyncio.run(AttractionCrawler().crawl_all())
