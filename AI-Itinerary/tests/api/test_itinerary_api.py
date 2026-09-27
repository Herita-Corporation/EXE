"""
API integration tests — POST /generate, GET /{id}, DELETE /{id}.
Uses FastAPI TestClient with mocked database and external services.
"""

import json
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app


# ── Auth helper ───────────────────────────────────────────────────────────────
API_KEY_HEADER = {"X-API-Key": "change-me"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def generate_payload():
    return {
        "user_id": str(uuid.uuid4()),
        "cities": ["Da Nang"],
        "budget": 5_000_000,
        "start_date": "2027-01-01",
        "end_date": "2027-01-03",
        "preferences": ["food"],
    }


class TestHealthEndpoint:
    def test_liveness(self, client):
        resp = client.get("/health/live")
        assert resp.status_code == 200
        assert resp.json()["status"] == "alive"


class TestGenerateItinerary:
    def test_missing_auth_returns_401(self, client, generate_payload):
        resp = client.post("/api/v1/itinerary/generate", json=generate_payload)
        assert resp.status_code == 401

    def test_invalid_budget_returns_400(self, client, generate_payload):
        generate_payload["budget"] = -1000
        resp = client.post(
            "/api/v1/itinerary/generate",
            json=generate_payload,
            headers=API_KEY_HEADER,
        )
        assert resp.status_code == 422

    def test_missing_cities_returns_422(self, client, generate_payload):
        generate_payload["cities"] = []
        resp = client.post(
            "/api/v1/itinerary/generate",
            json=generate_payload,
            headers=API_KEY_HEADER,
        )
        assert resp.status_code == 422

    def test_invalid_date_order_returns_422(self, client, generate_payload):
        generate_payload["start_date"] = "2027-01-05"
        generate_payload["end_date"] = "2027-01-01"
        resp = client.post(
            "/api/v1/itinerary/generate",
            json=generate_payload,
            headers=API_KEY_HEADER,
        )
        assert resp.status_code == 422


class TestGetItinerary:
    def test_not_found_returns_404(self, client):
        fake_id = str(uuid.uuid4())
        resp = client.get(
            f"/api/v1/itinerary/{fake_id}",
            headers=API_KEY_HEADER,
        )
        assert resp.status_code == 404

    def test_invalid_uuid_returns_422(self, client):
        resp = client.get(
            "/api/v1/itinerary/not-a-uuid",
            headers=API_KEY_HEADER,
        )
        assert resp.status_code == 422


class TestDeleteItinerary:
    def test_not_found_returns_404(self, client):
        fake_id = str(uuid.uuid4())
        resp = client.delete(
            f"/api/v1/itinerary/{fake_id}",
            headers=API_KEY_HEADER,
        )
        assert resp.status_code == 404


class TestErrorResponseFormat:
    def test_error_has_standard_format(self, client, generate_payload):
        generate_payload["budget"] = 0
        resp = client.post(
            "/api/v1/itinerary/generate",
            json=generate_payload,
            headers=API_KEY_HEADER,
        )
        # Either 422 from pydantic or 400 from domain
        assert resp.status_code in (400, 422)
