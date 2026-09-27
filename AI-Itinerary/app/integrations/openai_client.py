"""
OpenAI Client — GPT-4o-mini integration with retry logic.
GPT generates the itinerary directly from trip info (no DB-grounded
candidate lists) — it supplies place names, locations, and costs from its
own knowledge.
"""

import asyncio
import json
from pathlib import Path
from typing import Any, Dict

import openai
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import GPTGenerationFailedError
from app.core.logging import get_logger

logger = get_logger(__name__)

# Load system prompt from disk once at import time
_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "itinerary_prompt.txt"
_SYSTEM_PROMPT: str = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""

# Small, focused prompt for the "suggest alternative places" feature — kept
# inline (not a separate prompt file) since it's a single short instruction,
# unlike the full itinerary generation prompt.
_ALTERNATIVES_SYSTEM_PROMPT = """You are a Vietnam travel expert. Given one \
activity slot from a traveler's itinerary (its city, activity type, and the \
place currently assigned to it), suggest exactly 4 different REAL alternative \
places in that same city that would fit the same slot equally well or better.

Rules:
1. Use real, well-known places you actually know in that city — never invent \
generic/fake names.
2. Do NOT repeat the current place.
3. Match the same activity_type category (e.g. if it's a restaurant, suggest \
other restaurants — not hotels or attractions).
4. Keep cost estimates (VND) realistic and within the given budget cap when one \
is provided.
5. This app is Vietnamese-language, for Vietnamese travelers — write "activity" \
and "notes" in Vietnamese (tiếng Việt). Keep "name" and "location" as their real \
names, do not translate them.
6. "notes" should be a short (<=15 words) reason a traveler might prefer this \
option, in Vietnamese.

Respond ONLY with a JSON object of this exact shape, no prose:
{
  "alternatives": [
    {
      "name": "string",
      "activity": "string (what to do there, short, in Vietnamese)",
      "location": "string or null (free-text area/address)",
      "cost": number (VND),
      "rating": number 0-5 or null,
      "notes": "string"
    }
  ]
}
Always return exactly 4 entries."""


class OpenAIClient:
    """
    Async OpenAI client wrapper.

    - Primary model: gpt-4o-mini
    - Fallback model: gpt-4.1-mini
    - Max retries: 2 (spec §68)
    - Temperature: low (0.2) for deterministic output
    """

    def __init__(self):
        self._client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT,
            max_retries=0,  # We handle retries manually
        )
        self._primary_model = settings.OPENAI_MODEL
        self._fallback_model = settings.OPENAI_FALLBACK_MODEL

    async def generate_itinerary(
        self, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call GPT with the trip context and return parsed JSON itinerary.

        Args:
            context: GenerationContext dict (trip_information only).

        Returns:
            Parsed itinerary dict.

        Raises:
            GPTGenerationFailedError: After max retries exhausted.
        """
        user_message = json.dumps(context, ensure_ascii=False, indent=2)
        return await self._complete_json(_SYSTEM_PROMPT, user_message)

    async def generate_alternatives(
        self, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Ask GPT for a handful of alternative real places similar to one
        specific activity — used by the "edit this place" feature so a user
        can swap a GPT-suggested spot for one that suits them better.

        Args:
            context: {"city", "activity_type", "current_place", "budget_cap_vnd"}.

        Returns:
            Parsed dict shaped like {"alternatives": [...]}.
        """
        user_message = json.dumps(context, ensure_ascii=False, indent=2)
        return await self._complete_json(_ALTERNATIVES_SYSTEM_PROMPT, user_message)

    async def _complete_json(
        self, system_prompt: str, user_message: str
    ) -> Dict[str, Any]:
        """Shared retry/fallback-model loop for a single JSON-mode chat call."""
        models_to_try = [self._primary_model, self._fallback_model]

        last_error: Exception | None = None
        for attempt in range(settings.OPENAI_MAX_RETRIES + 1):
            model = models_to_try[min(attempt, len(models_to_try) - 1)]
            try:
                logger.info(
                    "gpt_request_started",
                    extra={"model": model, "attempt": attempt + 1},
                )
                response = await self._client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"},
                )

                raw = response.choices[0].message.content or ""
                parsed = json.loads(raw)

                logger.info(
                    "gpt_request_success",
                    extra={
                        "model": model,
                        "attempt": attempt + 1,
                        "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                        "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    },
                )
                return parsed

            except (json.JSONDecodeError, openai.APIError, openai.APITimeoutError) as exc:
                last_error = exc
                logger.warning(
                    "gpt_request_failed",
                    extra={"model": model, "attempt": attempt + 1, "error": str(exc)},
                )
                if attempt < settings.OPENAI_MAX_RETRIES:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

        raise GPTGenerationFailedError(
            f"GPT generation failed after {settings.OPENAI_MAX_RETRIES + 1} attempts. "
            f"Last error: {last_error}"
        )
