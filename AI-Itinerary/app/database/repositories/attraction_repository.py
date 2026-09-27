"""Attraction repository — database queries."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_ATTRACTIONS, MIN_RATING_FALLBACK, MIN_RATING_PREFERRED
from app.database.models.attraction import Attraction


class AttractionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_city(
        self,
        cities: List[str],
        min_rating: float = MIN_RATING_PREFERRED,
        max_price: Optional[float] = None,
        limit: int = MAX_ATTRACTIONS,
    ) -> List[Attraction]:
        """Retrieve top-K attractions filtered by city, rating, and optional price cap."""
        stmt = select(Attraction).where(
            and_(
                func.lower(Attraction.city).in_([c.lower() for c in cities]),
                Attraction.rating >= min_rating,
                Attraction.latitude.is_not(None),
                Attraction.longitude.is_not(None),
            )
        )
        if max_price is not None:
            stmt = stmt.where(
                (Attraction.ticket_price <= max_price) | Attraction.ticket_price.is_(None)
            )
        stmt = stmt.order_by(Attraction.rating.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_city_with_fallback(
        self,
        cities: List[str],
        max_price: Optional[float] = None,
        limit: int = MAX_ATTRACTIONS,
    ) -> List[Attraction]:
        """Try preferred rating first; fall back to lower threshold."""
        results = await self.get_by_city(
            cities, MIN_RATING_PREFERRED, max_price, limit
        )
        if not results:
            results = await self.get_by_city(
                cities, MIN_RATING_FALLBACK, max_price, limit
            )
        return results

    async def get_by_id(self, attraction_id: UUID) -> Optional[Attraction]:
        result = await self.db.execute(
            select(Attraction).where(Attraction.id == attraction_id)
        )
        return result.scalar_one_or_none()

    async def upsert(self, attraction: Attraction) -> Attraction:
        self.db.add(attraction)
        await self.db.flush()
        return attraction
