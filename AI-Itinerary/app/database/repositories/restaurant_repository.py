"""Restaurant repository — database queries."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_RESTAURANTS, MIN_RATING_FALLBACK, MIN_RATING_PREFERRED
from app.database.models.restaurant import Restaurant


class RestaurantRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_city(
        self,
        cities: List[str],
        min_rating: float = MIN_RATING_PREFERRED,
        max_avg_price: Optional[float] = None,
        limit: int = MAX_RESTAURANTS,
    ) -> List[Restaurant]:
        """Retrieve top-K restaurants filtered by city, rating, and optional avg price."""
        stmt = select(Restaurant).where(
            and_(
                func.lower(Restaurant.city).in_([c.lower() for c in cities]),
                Restaurant.rating >= min_rating,
                Restaurant.latitude.is_not(None),
                Restaurant.longitude.is_not(None),
            )
        )
        if max_avg_price is not None:
            stmt = stmt.where(
                (Restaurant.avg_price <= max_avg_price) | Restaurant.avg_price.is_(None)
            )
        stmt = stmt.order_by(Restaurant.rating.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_city_with_fallback(
        self,
        cities: List[str],
        max_avg_price: Optional[float] = None,
        limit: int = MAX_RESTAURANTS,
    ) -> List[Restaurant]:
        """Try preferred rating first; fall back to lower threshold."""
        results = await self.get_by_city(
            cities, MIN_RATING_PREFERRED, max_avg_price, limit
        )
        if not results:
            results = await self.get_by_city(
                cities, MIN_RATING_FALLBACK, max_avg_price, limit
            )
        return results

    async def get_by_id(self, restaurant_id: UUID) -> Optional[Restaurant]:
        result = await self.db.execute(
            select(Restaurant).where(Restaurant.id == restaurant_id)
        )
        return result.scalar_one_or_none()

    async def upsert(self, restaurant: Restaurant) -> Restaurant:
        self.db.add(restaurant)
        await self.db.flush()
        return restaurant
