"""
Itinerary Service — thin wrapper that delegates to the orchestrator.
Exists for DI and testability isolation.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.orchestrators.itinerary_orchestrator import ItineraryOrchestrator
from app.schemas.itinerary import ItineraryResponse
from app.schemas.request import GenerateItineraryRequest


class ItineraryService:
    """
    Service layer between API routes and the orchestrator.
    Allows for easier mocking in unit tests.
    """

    def __init__(self, db: AsyncSession):
        self._orchestrator = ItineraryOrchestrator(db)

    async def generate(self, request: GenerateItineraryRequest) -> ItineraryResponse:
        return await self._orchestrator.generate(request)
