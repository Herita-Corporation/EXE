"""
Unit tests for RouteOptimizer.
"""

import pytest

from app.planners.route_optimizer import RouteOptimizer, haversine_km
from unittest.mock import AsyncMock


@pytest.fixture
def mock_osrm():
    client = AsyncMock()
    client.get_distance_matrix.return_value = {
        "durations": [[0, 600, 1200], [600, 0, 900], [1200, 900, 0]],
        "distances": [[0, 5000, 10000], [5000, 0, 7000], [10000, 7000, 0]],
    }
    return client


@pytest.fixture
def optimizer(mock_osrm):
    return RouteOptimizer(mock_osrm)


@pytest.fixture
def sample_locations():
    return [
        {"id": "1", "name": "Marble Mountains", "latitude": 16.0023, "longitude": 108.2619},
        {"id": "2", "name": "Dragon Bridge", "latitude": 16.0610, "longitude": 108.2270},
        {"id": "3", "name": "My Khe Beach", "latitude": 16.0480, "longitude": 108.2476},
    ]


class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine_km(16.0, 108.0, 16.0, 108.0) == 0.0

    def test_known_distance(self):
        # Da Nang → Hoi An ≈ 30 km
        d = haversine_km(16.0678, 108.2208, 15.8801, 108.3380)
        assert 25 < d < 40

    def test_symmetry(self):
        d1 = haversine_km(16.0, 108.0, 15.0, 107.0)
        d2 = haversine_km(15.0, 107.0, 16.0, 108.0)
        assert abs(d1 - d2) < 0.001


class TestRouteOptimizer:
    @pytest.mark.asyncio
    async def test_empty_locations(self, optimizer):
        result = await optimizer.optimize([])
        assert result["ordered_locations"] == []
        assert result["estimated_distance_km"] == 0.0

    @pytest.mark.asyncio
    async def test_single_location(self, optimizer, sample_locations):
        result = await optimizer.optimize([sample_locations[0]])
        assert len(result["ordered_locations"]) == 1

    @pytest.mark.asyncio
    async def test_returns_all_locations(self, optimizer, sample_locations):
        result = await optimizer.optimize(sample_locations)
        assert len(result["ordered_locations"]) == len(sample_locations)

    @pytest.mark.asyncio
    async def test_osrm_fallback(self, sample_locations):
        """When OSRM fails, should fall back to Haversine."""
        failing_osrm = AsyncMock()
        failing_osrm.get_distance_matrix.side_effect = Exception("OSRM down")
        opt = RouteOptimizer(failing_osrm)
        result = await opt.optimize(sample_locations)
        assert len(result["ordered_locations"]) == len(sample_locations)
        assert result["estimated_distance_km"] > 0

    def test_nearest_neighbour(self, optimizer):
        matrix = [
            [0, 10, 1],
            [10, 0, 9],
            [1, 9, 0],
        ]
        order = optimizer._nearest_neighbour(matrix)
        assert order[0] == 0
        assert order[1] == 2  # nearest from 0 is index 2 (cost=1)
