"""Hotel repository — database queries."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_HOTELS, MIN_RATING_FALLBACK, MIN_RATING_PREFERRED
from app.database.models.hotel import Hotel


class HotelRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_city(
        self,
        cities: List[str],
        min_rating: float = MIN_RATING_PREFERRED,
        max_price_per_night: Optional[float] = None,
        limit: int = MAX_HOTELS,
    ) -> List[Hotel]:
        """Retrieve top-K hotels filtered by city, rating, and nightly price cap."""
        stmt = select(Hotel).where(
            and_(
                func.lower(Hotel.city).in_([c.lower() for c in cities]),
                Hotel.rating >= min_rating,
                Hotel.latitude.is_not(None),
                Hotel.longitude.is_not(None),
            )
        )
        if max_price_per_night is not None:
            stmt = stmt.where(
                (Hotel.price_per_night <= max_price_per_night)
                | Hotel.price_per_night.is_(None)
            )
        stmt = stmt.order_by(Hotel.rating.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_city_with_fallback(
        self,
        cities: List[str],
        max_price_per_night: Optional[float] = None,
        limit: int = MAX_HOTELS,
    ) -> List[Hotel]:
        """Try preferred rating first; fall back to lower threshold."""
        results = await self.get_by_city(
            cities, MIN_RATING_PREFERRED, max_price_per_night, limit
        )
        if not results:
            results = await self.get_by_city(
                cities, MIN_RATING_FALLBACK, max_price_per_night, limit
            )
        return results

    async def get_by_id(self, hotel_id: UUID) -> Optional[Hotel]:
        result = await self.db.execute(
            select(Hotel).where(Hotel.id == hotel_id)
        )
        return result.scalar_one_or_none()

    async def upsert(self, hotel: Hotel) -> Hotel:
        self.db.add(hotel)
        await self.db.flush()
        return hotel
