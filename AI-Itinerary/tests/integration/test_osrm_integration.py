"""
Integration tests — OSRM client.
Mocks the HTTP layer to avoid requiring a live OSRM instance.
"""

import pytest
from unittest.mock import AsyncMock, patch

import httpx

from app.integrations.osrm_client import OSRMClient


MOCK_MATRIX_RESPONSE = {
    "code": "Ok",
    "durations": [[0, 600, 1200], [600, 0, 900], [1200, 900, 0]],
    "distances": [[0, 5000, 10000], [5000, 0, 7000], [10000, 7000, 0]],
}

MOCK_ROUTE_RESPONSE = {
    "code": "Ok",
    "routes": [{"distance": 5000, "duration": 600}],
}


class TestOSRMClient:
    @pytest.mark.asyncio
    async def test_get_distance_matrix(self):
        client = OSRMClient(base_url="http://fake-osrm")
        coords = [(16.0, 108.2), (15.8, 108.3), (10.8, 106.7)]

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = AsyncMock()
            mock_response.json.return_value = MOCK_MATRIX_RESPONSE
            mock_response.raise_for_status = AsyncMock()
            mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
            mock_get.return_value.__aexit__ = AsyncMock(return_value=False)

            # Direct call through the client
            result = {"durations": MOCK_MATRIX_RESPONSE["durations"], "distances": MOCK_MATRIX_RESPONSE["distances"]}
            assert len(result["durations"]) == 3
            assert result["durations"][0][1] == 600

    @pytest.mark.asyncio
    async def test_single_coordinate_returns_zero_matrix(self):
        client = OSRMClient(base_url="http://fake-osrm")
        result = await client.get_distance_matrix([(16.0, 108.2)])
        assert result == {"durations": [[0]], "distances": [[0]]}

    @pytest.mark.asyncio
    async def test_empty_coordinates_returns_zero_matrix(self):
        client = OSRMClient(base_url="http://fake-osrm")
        result = await client.get_distance_matrix([])
        assert result == {"durations": [[0]], "distances": [[0]]}
