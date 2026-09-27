"""
Unit tests for request validation (Pydantic + domain validators).
"""

import uuid
from datetime import date

import pytest
from pydantic import ValidationError

from app.core.exceptions import InvalidBudgetError, InvalidCityError, InvalidDateError
from app.orchestrators.itinerary_orchestrator import ItineraryOrchestrator
from app.schemas.request import GenerateItineraryRequest


class TestGenerateItineraryRequestSchema:
    def test_valid_request(self):
        req = GenerateItineraryRequest(
            user_id=uuid.uuid4(),
            cities=["Da Nang"],
            budget=5_000_000,
            start_date=date(2027, 1, 1),
            end_date=date(2027, 1, 3),
        )
        assert req.trip_duration_days == 3

    def test_start_after_end_raises(self):
        with pytest.raises(ValidationError):
            GenerateItineraryRequest(
                user_id=uuid.uuid4(),
                cities=["Da Nang"],
                budget=5_000_000,
                start_date=date(2027, 1, 5),
                end_date=date(2027, 1, 1),
            )

    def test_zero_budget_raises(self):
        with pytest.raises(ValidationError):
            GenerateItineraryRequest(
                user_id=uuid.uuid4(),
                cities=["Da Nang"],
                budget=0,
                start_date=date(2027, 1, 1),
                end_date=date(2027, 1, 3),
            )

    def test_negative_budget_raises(self):
        with pytest.raises(ValidationError):
            GenerateItineraryRequest(
                user_id=uuid.uuid4(),
                cities=["Da Nang"],
                budget=-1000,
                start_date=date(2027, 1, 1),
                end_date=date(2027, 1, 3),
            )

    def test_empty_cities_raises(self):
        with pytest.raises(ValidationError):
            GenerateItineraryRequest(
                user_id=uuid.uuid4(),
                cities=[],
                budget=5_000_000,
                start_date=date(2027, 1, 1),
                end_date=date(2027, 1, 3),
            )

    def test_same_start_end_date_valid(self):
        req = GenerateItineraryRequest(
            user_id=uuid.uuid4(),
            cities=["Da Nang"],
            budget=1_000_000,
            start_date=date(2027, 1, 1),
            end_date=date(2027, 1, 1),
        )
        assert req.trip_duration_days == 1

    def test_multiple_cities(self):
        req = GenerateItineraryRequest(
            user_id=uuid.uuid4(),
            cities=["Da Nang", "Hoi An", "Hue"],
            budget=15_000_000,
            start_date=date(2027, 1, 1),
            end_date=date(2027, 1, 7),
        )
        assert len(req.cities) == 3

    def test_preferences_optional(self):
        req = GenerateItineraryRequest(
            user_id=uuid.uuid4(),
            cities=["Da Nang"],
            budget=5_000_000,
            start_date=date(2027, 1, 1),
            end_date=date(2027, 1, 3),
        )
        assert req.preferences == []


class TestActivitySchema:
    def test_invalid_time_ordering(self):
        from app.schemas.itinerary import Activity, ActivityType
        with pytest.raises(ValidationError):
            Activity(
                start_time="10:00",
                end_time="09:00",  # end before start
                type=ActivityType.ATTRACTION,
                name="Test",
                cost=0,
            )

    def test_valid_activity(self):
        from app.schemas.itinerary import Activity, ActivityType
        act = Activity(
            start_time="09:00",
            end_time="11:00",
            type=ActivityType.ATTRACTION,
            name="Marble Mountains",
            cost=40000,
            rating=4.7,
        )
        assert act.type == ActivityType.ATTRACTION
