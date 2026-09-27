"""
Shared test fixtures and configuration.
"""

import asyncio
import uuid
from datetime import date
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database.session import Base, get_db
from main import app

# ── Test DB (SQLite in-memory for unit tests) ─────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_db(test_engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
def test_client(test_db) -> TestClient:
    app.dependency_overrides[get_db] = lambda: test_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


# ── Common test data ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_request_payload():
    return {
        "user_id": str(uuid.uuid4()),
        "cities": ["Da Nang"],
        "budget": 5000000,
        "start_date": "2027-01-01",
        "end_date": "2027-01-03",
        "preferences": ["food", "culture"],
    }


@pytest.fixture
def sample_attractions():
    return [
        {
            "id": str(uuid.uuid4()),
            "name": "Marble Mountains",
            "city": "Da Nang",
            "latitude": 16.0023,
            "longitude": 108.2619,
            "rating": 4.7,
            "ticket_price": 40000,
            "category": "attraction",
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Dragon Bridge",
            "city": "Da Nang",
            "latitude": 16.0610,
            "longitude": 108.2270,
            "rating": 4.6,
            "ticket_price": 0,
            "category": "attraction",
        },
    ]


@pytest.fixture
def sample_restaurants():
    return [
        {
            "id": str(uuid.uuid4()),
            "name": "Madame Lan",
            "city": "Da Nang",
            "latitude": 16.0650,
            "longitude": 108.2200,
            "rating": 4.6,
            "avg_price": 120000,
            "cuisine": "Vietnamese",
        }
    ]


@pytest.fixture
def sample_hotels():
    return [
        {
            "id": str(uuid.uuid4()),
            "name": "Novotel Da Nang",
            "city": "Da Nang",
            "latitude": 16.0620,
            "longitude": 108.2200,
            "rating": 4.6,
            "price_per_night": 1500000,
        }
    ]


@pytest.fixture
def mock_openai_client():
    client = AsyncMock()
    client.generate_itinerary.return_value = {
        "days": [
            {
                "date": "2027-01-01",
                "city": "Da Nang",
                "activities": [
                    {
                        "start_time": "07:30",
                        "end_time": "08:30",
                        "type": "breakfast",
                        "name": "Madame Lan",
                        "cost": 120000,
                        "rating": 4.6,
                    },
                    {
                        "start_time": "09:00",
                        "end_time": "11:30",
                        "type": "attraction",
                        "name": "Marble Mountains",
                        "cost": 40000,
                        "rating": 4.7,
                    },
                ],
            }
        ],
        "total_cost": 160000,
    }
    return client


@pytest.fixture
def mock_osrm_client():
    client = AsyncMock()
    client.get_distance_matrix.return_value = {
        "durations": [[0, 600], [600, 0]],
        "distances": [[0, 5000], [5000, 0]],
    }
    return client
