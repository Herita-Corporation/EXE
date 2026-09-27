"""
Retrieval Service — fetch candidate locations from the knowledge base.

v2 changes:
- Separate market retrieval (from attractions table, category IN MARKET_CATEGORIES)
- Larger candidate pools (40 attractions, 40 restaurants) to support alternatives
- Soft price filtering: never return empty pool; price cap is a preference hint
"""

import asyncio
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    MARKET_CATEGORIES,
    MAX_ATTRACTIONS,
    MAX_HOTELS,
    MAX_MARKETS,
    MAX_RESTAURANTS,
    MIN_RATING_FALLBACK,
    MIN_RATING_PREFERRED,
)
from app.core.exceptions import NoCandidatesFoundError
from app.core.logging import get_logger
from app.database.models.attraction import Attraction
from app.database.repositories.attraction_repository import AttractionRepository
from app.database.repositories.hotel_repository import HotelRepository
from app.database.repositories.restaurant_repository import RestaurantRepository
from app.schemas.itinerary import BudgetBreakdown

logger = get_logger(__name__)


class RetrievalService:
    """
    Retrieval Layer — finds candidate locations from the database.

    v2 retrieval strategy:
        1. Filter by city
        2. Try preferred rating (≥4.5), fall back to ≥4.0, then any rating
        3. Price cap is a SOFT hint — if no results fit, remove the cap
        4. Markets retrieved separately from attractions table
        5. Pool size increased to 40 per category for alternatives support
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.attraction_repo = AttractionRepository(db)
        self.restaurant_repo = RestaurantRepository(db)
        self.hotel_repo = HotelRepository(db)

    async def retrieve_candidates(
        self,
        cities: List[str],
        budget_breakdown: BudgetBreakdown,
        trip_duration_days: int,
        preferences: List[str] | None = None,
    ) -> dict:
        """
        Retrieve top-K candidates for all categories.

        v2: Price caps are soft — candidates are always returned even if no
        place fits the cap. This prevents the zero-cost bug on low budgets.

        Returns:
            {
                "attractions": [...],
                "restaurants": [...],
                "hotels":      [...],
                "markets":     [...],  # NEW — separate from attractions
            }

        Raises:
            NoCandidatesFoundError: If no locations are found at all.
        """
        # Derive per-item price caps — used as SOFT sorting hints
        nightly_cap = (
            budget_breakdown.accommodation / trip_duration_days
            if trip_duration_days > 0
            else None
        )
        meal_cap = (
            budget_breakdown.food / (3 * trip_duration_days)
            if trip_duration_days > 0
            else None
        )
        attraction_cap = budget_breakdown.attractions / max(trip_duration_days * 2, 1)

        logger.info(
            "retrieval_started",
            extra={
                "cities": cities,
                "nightly_cap": nightly_cap,
                "meal_cap": meal_cap,
                "attraction_cap": attraction_cap,
            },
        )

        # Run all retrievals concurrently
        attractions, restaurants, hotels, markets = await asyncio.gather(
            self._retrieve_attractions(cities, attraction_cap),
            self.restaurant_repo.get_by_city_with_fallback(
                cities, max_avg_price=None, limit=MAX_RESTAURANTS  # no hard cap
            ),
            self.hotel_repo.get_by_city_with_fallback(
                cities, max_price_per_night=None, limit=MAX_HOTELS  # no hard cap
            ),
            self._retrieve_markets(cities),
        )

        if not attractions and not restaurants and not hotels and not markets:
            raise NoCandidatesFoundError(
                f"No candidates found for cities: {', '.join(cities)}."
            )

        logger.info(
            "retrieval_complete",
            extra={
                "attractions_found": len(attractions),
                "restaurants_found": len(restaurants),
                "hotels_found": len(hotels),
                "markets_found": len(markets),
            },
        )

        return {
            "attractions": [a.to_dict() for a in attractions],
            "restaurants": [r.to_dict() for r in restaurants],
            "hotels": [h.to_dict() for h in hotels],
            "markets": markets,  # already dicts
        }

    async def _retrieve_attractions(
        self,
        cities: List[str],
        price_cap: Optional[float],
    ) -> list:
        """
        Retrieve non-market attractions.

        Excludes entries whose category is in MARKET_CATEGORIES so that
        markets appear only in the separate 'markets' bucket.
        """
        city_lower = [c.lower() for c in cities]
        market_cats = [m.lower() for m in MARKET_CATEGORIES]

        for min_rating in (MIN_RATING_PREFERRED, MIN_RATING_FALLBACK, 0.0):
            stmt = (
                select(Attraction)
                .where(
                    and_(
                        func.lower(Attraction.city).in_(city_lower),
                        Attraction.latitude.is_not(None),
                        Attraction.longitude.is_not(None),
                        # Exclude markets from attractions bucket
                        ~func.lower(Attraction.category).in_(market_cats),
                    )
                )
            )
            if min_rating > 0:
                stmt = stmt.where(Attraction.rating >= min_rating)
            stmt = stmt.order_by(Attraction.rating.desc().nullslast()).limit(MAX_ATTRACTIONS)
            result = await self.db.execute(stmt)
            rows = list(result.scalars().all())
            if rows:
                return rows

        return []

    async def _retrieve_markets(self, cities: List[str]) -> List[dict]:
        """
        Retrieve market-type attractions from the attractions table.

        Returns dicts (not ORM objects) with a 'type' field set to 'market'
        so the builder can create ActivityType.MARKET activities directly.
        """
        city_lower = [c.lower() for c in cities]
        market_cats = [m.lower() for m in MARKET_CATEGORIES]

        stmt = (
            select(Attraction)
            .where(
                and_(
                    func.lower(Attraction.city).in_(city_lower),
                    func.lower(Attraction.category).in_(market_cats),
                    Attraction.latitude.is_not(None),
                    Attraction.longitude.is_not(None),
                )
            )
            .order_by(Attraction.rating.desc().nullslast())
            .limit(MAX_MARKETS)
        )
        result = await self.db.execute(stmt)
        rows = list(result.scalars().all())

        markets = []
        for row in rows:
            d = row.to_dict()
            d["slot_type"] = "fixed"     # markets are destination anchors
            d["activity_type"] = "market"
            markets.append(d)

        return markets
