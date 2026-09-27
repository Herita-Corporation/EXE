"""
Integration tests — database connectivity and model CRUD.
Uses SQLite in-memory (see conftest.py).
"""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.database.models.attraction import Attraction
from app.database.models.itinerary import GeneratedItinerary
from app.database.repositories.attraction_repository import AttractionRepository
from app.database.repositories.itinerary_repository import ItineraryRepository


class TestDatabaseConnectivity:
    @pytest.mark.asyncio
    async def test_db_ping(self, test_db):
        result = await test_db.execute(text("SELECT 1"))
        assert result.scalar() == 1


class TestAttractionRepository:
    @pytest.mark.asyncio
    async def test_upsert_and_get(self, test_db):
        repo = AttractionRepository(test_db)
        attraction = Attraction(
            id=uuid.uuid4(),
            name="Test Attraction",
            city="Da Nang",
            latitude=16.0023,
            longitude=108.2619,
            rating=4.7,
            ticket_price=40000,
            source="test",
        )
        saved = await repo.upsert(attraction)
        await test_db.commit()
        assert saved.name == "Test Attraction"

    @pytest.mark.asyncio
    async def test_get_by_city_with_rating_filter(self, test_db):
        repo = AttractionRepository(test_db)
        # Add two attractions — one above threshold, one below
        above = Attraction(id=uuid.uuid4(), name="High Rated", city="Hoi An", latitude=15.88, longitude=108.33, rating=4.8, source="test")
        below = Attraction(id=uuid.uuid4(), name="Low Rated", city="Hoi An", latitude=15.88, longitude=108.33, rating=3.5, source="test")
        await repo.upsert(above)
        await repo.upsert(below)
        await test_db.commit()

        results = await repo.get_by_city(["Hoi An"], min_rating=4.5)
        names = [r.name for r in results]
        assert "High Rated" in names
        assert "Low Rated" not in names


class TestItineraryRepository:
    @pytest.mark.asyncio
    async def test_create_and_retrieve(self, test_db):
        repo = ItineraryRepository(test_db)
        user_id = uuid.uuid4()
        record = GeneratedItinerary(
            id=uuid.uuid4(),
            user_id=user_id,
            request_payload={"cities": ["Da Nang"], "budget": 5000000},
            generated_itinerary={"days": [], "total_cost": 0},
            total_cost=0,
            generation_time_ms=1200,
        )
        saved = await repo.create(record)
        await test_db.commit()

        retrieved = await repo.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.user_id == user_id

    @pytest.mark.asyncio
    async def test_delete(self, test_db):
        repo = ItineraryRepository(test_db)
        record = GeneratedItinerary(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            request_payload={},
            generated_itinerary={},
            total_cost=0,
        )
        saved = await repo.create(record)
        await test_db.commit()

        deleted = await repo.delete_by_id(saved.id)
        await test_db.commit()
        assert deleted is True

        retrieved = await repo.get_by_id(saved.id)
        assert retrieved is None
