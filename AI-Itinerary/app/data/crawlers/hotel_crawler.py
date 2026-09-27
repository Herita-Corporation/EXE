"""
Hotel Crawler — fetches hotel data from Overpass API.
"""

import asyncio
import uuid

from app.core.logging import get_logger
from app.database.models.hotel import Hotel
from app.database.session import AsyncSessionLocal
from app.integrations.osm_client import OSMClient
from app.integrations.overpass_client import OverpassClient

logger = get_logger(__name__)

TARGET_CITIES = [
    "Da Nang", "Hoi An", "Ho Chi Minh City",
    "Hanoi", "Hue", "Nha Trang", "Da Lat", "Phu Quoc",
]


class HotelCrawler:
    def __init__(self):
        self.overpass = OverpassClient()
        self.osm = OSMClient()

    async def crawl_city(self, city: str) -> int:
        bbox = await self.osm.get_city_bbox(city)
        if not bbox:
            logger.warning("no_bbox_for_city", extra={"city": city})
            return 0

        elements = await self.overpass.query_hotels(bbox)
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

                hotel = Hotel(
                    id=uuid.uuid4(),
                    name=name[:255],
                    city=city,
                    latitude=lat,
                    longitude=lon,
                    rating=None,
                    review_count=None,
                    price_per_night=None,
                    source="overpass",
                )
                session.add(hotel)
                saved += 1

            await session.commit()

        logger.info("crawl_hotels_done", extra={"city": city, "saved": saved})
        return saved

    async def crawl_all(self) -> None:
        for city in TARGET_CITIES:
            try:
                await self.crawl_city(city)
                await asyncio.sleep(2)
            except Exception as exc:
                logger.error("crawl_city_failed", extra={"city": city, "error": str(exc)})


if __name__ == "__main__":
    asyncio.run(HotelCrawler().crawl_all())
