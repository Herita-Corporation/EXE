"""Itinerary repository — CRUD for ai_generated_itineraries."""

from typing import Optional
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.itinerary import GeneratedItinerary


class ItineraryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, itinerary: GeneratedItinerary) -> GeneratedItinerary:
        self.db.add(itinerary)
        await self.db.flush()
        await self.db.refresh(itinerary)
        return itinerary

    async def update_content(
        self, itinerary_id: UUID, generated_itinerary: dict, total_cost: float
    ) -> None:
        """
        Explicit UPDATE for the JSONB `generated_itinerary` blob + total_cost
        (used by PATCH .../activities/{id} — "edit this place"). Deliberately
        NOT `session.add()` + attribute reassignment + flush(): SQLAlchemy's
        ORM dirty-tracking did not reliably detect a plain-dict reassignment
        on this JSONB column in testing (no UPDATE was ever emitted), so this
        issues the UPDATE directly instead of relying on it.
        """
        await self.db.execute(
            update(GeneratedItinerary)
            .where(GeneratedItinerary.id == itinerary_id)
            .values(generated_itinerary=generated_itinerary, total_cost=total_cost)
        )
        await self.db.flush()

    async def get_by_id(self, itinerary_id: UUID) -> Optional[GeneratedItinerary]:
        result = await self.db.execute(
            select(GeneratedItinerary).where(GeneratedItinerary.id == itinerary_id)
        )
        return result.scalar_one_or_none()

    async def delete_by_id(self, itinerary_id: UUID) -> bool:
        result = await self.db.execute(
            delete(GeneratedItinerary).where(GeneratedItinerary.id == itinerary_id)
        )
        return result.rowcount > 0

    async def get_by_user(self, user_id: UUID, limit: int = 20) -> list[GeneratedItinerary]:
        result = await self.db.execute(
            select(GeneratedItinerary)
            .where(GeneratedItinerary.user_id == user_id)
            .order_by(GeneratedItinerary.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
