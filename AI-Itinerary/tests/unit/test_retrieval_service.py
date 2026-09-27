"""
Unit tests for RecommendationService.
"""

import pytest

from app.services.recommendation_service import RecommendationService


@pytest.fixture
def service():
    return RecommendationService()


@pytest.fixture
def sample_candidates():
    return {
        "attractions": [
            {"id": "a1", "name": "Marble Mountains", "rating": 4.7, "category": "attraction", "latitude": 16.0, "longitude": 108.2},
            {"id": "a2", "name": "Dragon Bridge", "rating": 4.6, "category": "attraction", "latitude": 16.1, "longitude": 108.2},
            {"id": "a3", "name": "Hoi An Ancient Town", "rating": 4.9, "category": "heritage", "latitude": 15.8, "longitude": 108.3},
        ],
        "restaurants": [
            {"id": "r1", "name": "Madame Lan", "rating": 4.6, "avg_price": 120000, "latitude": 16.0, "longitude": 108.2},
            {"id": "r2", "name": "Banh Mi Phuong", "rating": 4.9, "avg_price": 30000, "latitude": 15.8, "longitude": 108.3},
        ],
        "hotels": [
            {"id": "h1", "name": "Novotel Da Nang", "rating": 4.6, "price_per_night": 1500000, "latitude": 16.0, "longitude": 108.2},
        ],
    }


class TestRankAndTrim:
    def test_returns_all_when_under_limit(self, service, sample_candidates):
        result = service.rank_and_trim(sample_candidates, [])
        assert len(result["attractions"]) == 3
        assert len(result["restaurants"]) == 2

    def test_food_preference_sorts_restaurants(self, service, sample_candidates):
        result = service.rank_and_trim(sample_candidates, ["food"])
        ratings = [r["rating"] for r in result["restaurants"]]
        assert ratings == sorted(ratings, reverse=True)

    def test_trim_to_50_max(self, service):
        large = {
            "attractions": [{"id": f"a{i}", "name": f"Attr{i}", "rating": 4.5, "category": "attraction", "latitude": 16.0, "longitude": 108.0} for i in range(30)],
            "restaurants": [{"id": f"r{i}", "name": f"Rest{i}", "rating": 4.5, "avg_price": 100000, "latitude": 16.0, "longitude": 108.0} for i in range(20)],
            "hotels": [{"id": f"h{i}", "name": f"Hotel{i}", "rating": 4.5, "price_per_night": 500000, "latitude": 16.0, "longitude": 108.0} for i in range(10)],
        }
        result = service.rank_and_trim(large, [])
        total = sum(len(v) for v in result.values())
        assert total <= 50


class TestValidateLocationIds:
    def test_all_valid(self, service, sample_candidates):
        activities = [
            {"type": "attraction", "name": "Marble Mountains", "location_id": "a1"},
        ]
        invalid = service.validate_location_ids(activities, sample_candidates)
        assert invalid == []

    def test_hallucinated_location_detected(self, service, sample_candidates):
        activities = [
            {"type": "attraction", "name": "Invented Place XYZ", "location_id": "fake-id"},
        ]
        invalid = service.validate_location_ids(activities, sample_candidates)
        assert len(invalid) > 0

    def test_transport_skipped(self, service, sample_candidates):
        activities = [
            {"type": "transportation", "name": "Flight to Hanoi", "location_id": "fake"},
        ]
        invalid = service.validate_location_ids(activities, sample_candidates)
        assert invalid == []
