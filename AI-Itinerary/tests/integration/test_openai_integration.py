"""
Integration tests — OpenAI client with mocked API.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.exceptions import GPTGenerationFailedError
from app.integrations.openai_client import OpenAIClient


MOCK_GPT_RESPONSE = {
    "days": [
        {
            "date": "2027-01-01",
            "city": "Da Nang",
            "activities": [
                {"start_time": "07:30", "end_time": "08:30", "type": "breakfast",
                 "name": "Madame Lan", "cost": 120000, "rating": 4.6},
                {"start_time": "09:00", "end_time": "11:30", "type": "attraction",
                 "name": "Marble Mountains", "cost": 40000, "rating": 4.7},
            ],
        }
    ],
    "total_cost": 160000,
}


def make_mock_completion(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    usage = MagicMock()
    usage.prompt_tokens = 100
    usage.completion_tokens = 200
    completion = MagicMock()
    completion.choices = [choice]
    completion.usage = usage
    return completion


class TestOpenAIClient:
    @pytest.mark.asyncio
    async def test_generate_itinerary_success(self):
        client = OpenAIClient()
        mock_completion = make_mock_completion(json.dumps(MOCK_GPT_RESPONSE))

        with patch.object(client._client.chat.completions, "create", new=AsyncMock(return_value=mock_completion)):
            result = await client.generate_itinerary({"trip_information": {}, "candidate_hotels": [], "candidate_restaurants": [], "candidate_attractions": []})
            assert "days" in result
            assert result["total_cost"] == 160000

    @pytest.mark.asyncio
    async def test_retries_on_failure(self):
        client = OpenAIClient()
        import openai
        mock_fail = AsyncMock(side_effect=openai.APITimeoutError(request=MagicMock()))

        with patch.object(client._client.chat.completions, "create", mock_fail):
            with pytest.raises(GPTGenerationFailedError):
                await client.generate_itinerary({})

    @pytest.mark.asyncio
    async def test_raises_after_max_retries(self):
        client = OpenAIClient()
        import openai
        mock_fail = AsyncMock(side_effect=openai.APIError("API Error", request=MagicMock(), body=None))

        with patch.object(client._client.chat.completions, "create", mock_fail):
            with pytest.raises(GPTGenerationFailedError):
                await client.generate_itinerary({})
