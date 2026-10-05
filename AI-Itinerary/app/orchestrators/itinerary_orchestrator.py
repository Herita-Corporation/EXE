"""
Itinerary Orchestrator — central coordinator for the itinerary generation pipeline.

v3 pipeline (9 steps, no RAG):
  Step 1: Validate Request
  Step 2: Calculate Planning Budget
  Step 3: Check Cache
  Step 4: Build GPT Context (trip info only — no DB-retrieved candidates)
  Step 5: Generate Itinerary (GPT, using its own knowledge directly)
  Step 6: Build Day Plans
  Step 7: Validate Budget
  Step 8: Validate Structure (warn-only diagnostic)
  Step 9: Assemble + Persist + Cache Result

v3 architectural change: removed DB-grounded retrieval (RetrievalService),
candidate scoring/ranking (BudgetOptimizer, RecommendationService), and
anchor route optimization (RouteOptimizer) — GPT now generates place names,
locations, and costs directly from its own knowledge instead of being
constrained to a Postgres-seeded candidate pool. Those services are left
in place, unused, in case candidate-grounded generation is revisited later.
"""

import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidBudgetError, InvalidCityError, InvalidDateError
from app.core.logging import get_logger
from app.database.models.itinerary import GeneratedItinerary
from app.database.repositories.cache_repository import CacheRepository
from app.database.repositories.itinerary_repository import ItineraryRepository
from app.integrations.openai_client import OpenAIClient
from app.integrations.osm_client import OSMClient
from app.planners.itinerary_builder import ItineraryBuilder, compute_total_cost
from app.schemas.itinerary import (
    ActivityType,
    BudgetBreakdown,
    DayPlan,
    GenerationContext,
    ItineraryResponse,
    LocationCoords,
    SlotType,
    TripSummary,
)
from app.schemas.request import GenerateItineraryRequest
from app.services.budget_service import BudgetService

logger = get_logger(__name__)


class ItineraryOrchestrator:
    """Wires together the service layers to execute the itinerary pipeline."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.budget_service = BudgetService()
        self.itinerary_builder = ItineraryBuilder()
        self.openai_client = OpenAIClient()
        self.itinerary_repo = ItineraryRepository(db)
        self.cache_repo = CacheRepository(db)
        self.osm_client = OSMClient()

    async def generate(
        self, request: GenerateItineraryRequest, *, user_id: UUID
    ) -> ItineraryResponse:
        """Execute the itinerary generation pipeline.

        Args:
            request: Trip parameters (cities, budget, dates, preferences).
            user_id: Caller's user ID extracted from the JWT token by the route layer.
        """
        start_time = time.monotonic()
        request_id = str(uuid.uuid4())

        logger.info(
            "pipeline_started",
            extra={
                "request_id": request_id,
                "user_id": str(user_id),
                "cities": request.cities,
                "budget": request.budget,
                "trip_days": request.trip_duration_days,
            },
        )

        # ── Step 1: Validate Request ──────────────────────────────────────────
        self._validate_request(request)

        # ── Step 2: Calculate Planning Budget ────────────────────────────────
        planning_budget, reserve_budget = self.budget_service.calculate_planning_budget(
            request.budget
        )
        breakdown = self.budget_service.allocate_budget(
            planning_budget, request.trip_duration_days
        )

        # ── Step 3: Check Cache ───────────────────────────────────────────────
        # NOTE: the cache key intentionally omits user_id/dates/itinerary_id —
        # it exists purely to skip a redundant GPT call when the same
        # city+budget+duration+preferences combo was generated recently.
        # It must NEVER let a cache hit short-circuit persistence: every
        # /generate call has to mint its own fresh, persisted itinerary_id,
        # otherwise two different callers (or the same caller after deleting
        # their old itinerary) would be handed back an itinerary_id that
        # isn't actually their own row in the DB — which then 404s on the
        # very next GET, looking like "can't create a new itinerary".
        cache_key = self.budget_service.build_cache_key(
            request.cities,
            request.budget,
            request.trip_duration_days,
            request.preferences or [],
        )
        cached = await self.cache_repo.get(cache_key)

        if cached:
            logger.info("cache_hit", extra={"cache_key": cache_key})
            # Re-anchor the cached days to THIS request's start_date — the
            # cache key doesn't include dates, so a hit may come from a
            # request with a different date range (same relative day offsets).
            day_plans = [
                DayPlan(**{**d, "date": str(request.start_date + timedelta(days=i))})
                for i, d in enumerate(cached["days"])
            ]
            total_cost = cached["total_cost"]
        else:
            # ── Step 4: Build GPT Context ───────────────────────────────────
            # No DB-retrieved candidates — GPT generates places from its own knowledge.
            context = GenerationContext(
                trip_information={
                    "user_id": str(user_id),
                    "cities": request.cities,
                    "start_date": str(request.start_date),
                    "end_date": str(request.end_date),
                    "trip_duration_days": request.trip_duration_days,
                    "total_budget": request.budget,
                    "planning_budget": planning_budget,
                    "reserve_budget": reserve_budget,
                    "budget_breakdown": breakdown.model_dump(),
                    "preferences": request.preferences or [],
                    # Pricing guidance for GPT
                    "budget_guidance": self._build_budget_guidance(breakdown, request.trip_duration_days),
                },
            )

            # ── Step 5: Generate Itinerary (GPT) ────────────────────────────
            gpt_raw = await self.openai_client.generate_itinerary(
                context.model_dump()
            )

            # ── Step 6: Build Day Plans ──────────────────────────────────────
            day_plans = self.itinerary_builder.build_from_gpt_output(
                json.dumps(gpt_raw),
                start_date=request.start_date,
                cities=request.cities,
            )

            # ── Step 6.5: Geocode fixed-anchor activities ────────────────────
            # Only cache-miss path — a cache hit's day_plans already carry
            # coordinates baked in from when that entry was first generated
            # (see Cache section below, which stores the geocoded result).
            await self._geocode_fixed_activities(day_plans, request.cities)

            # ── Step 7: Validate Budget ──────────────────────────────────────
            total_cost = compute_total_cost(day_plans)

            self.budget_service.validate_generated_budget(total_cost, planning_budget)

            # ── Step 8: Validate Structure ───────────────────────────────────
            self._validate_structure(day_plans)

        # ── Step 9: Assemble Response ─────────────────────────────────────────
        # Always a brand-new id — never reuse an id embedded in a cache hit.
        itinerary_id = uuid.uuid4()
        trip_summary = TripSummary(
            start_date=str(request.start_date),
            end_date=str(request.end_date),
            cities=request.cities,
            budget=request.budget,
            planning_budget=planning_budget,
            reserve_budget=reserve_budget,
            trip_duration_days=request.trip_duration_days,
        )

        result = ItineraryResponse(
            itinerary_id=itinerary_id,
            trip_summary=trip_summary,
            budget_breakdown=breakdown,
            days=day_plans,
            total_cost=total_cost,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        # ── Persist ────────────────────────────────────────────────────────────
        # Always persisted, on both the cache-hit and cache-miss paths, so
        # every itinerary_id ever returned to a client corresponds to a real,
        # independently deletable/editable row owned by this caller.
        generation_time_ms = int((time.monotonic() - start_time) * 1000)
        await self.itinerary_repo.create(
            GeneratedItinerary(
                id=itinerary_id,
                user_id=user_id,
                request_payload=request.model_dump(mode="json"),
                generated_itinerary=result.model_dump(mode="json"),
                total_cost=total_cost,
                generation_time_ms=generation_time_ms,
            )
        )

        # ── Cache ──────────────────────────────────────────────────────────────
        # Only refresh the cache on a miss — on a hit we already reused it
        # as-is, no need to rewrite the same content back.
        if not cached:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
            await self.cache_repo.set(
                cache_key,
                result.model_dump(mode="json"),
                expires_at=expires_at,
            )

        logger.info(
            "pipeline_complete",
            extra={
                "request_id": request_id,
                "itinerary_id": str(itinerary_id),
                "total_cost": total_cost,
                "generation_time_ms": generation_time_ms,
                "status": "success",
                "days": len(day_plans),
            },
        )

        return result

    def _validate_request(self, request: GenerateItineraryRequest) -> None:
        """Domain-level validation beyond Pydantic."""
        if request.budget <= 0:
            raise InvalidBudgetError()
        if request.start_date > request.end_date:
            raise InvalidDateError()
        if not request.cities or len(request.cities) == 0:
            raise InvalidCityError()
        if request.trip_duration_days <= 0:
            raise InvalidDateError("Trip duration must be at least 1 day.")

    async def _geocode_fixed_activities(self, day_plans, cities) -> None:
        """
        Attach GPS coordinates to fixed-anchor activities (hotel, attraction,
        landmark, museum) — the ones that make sense as map-navigation
        waypoints. Flexible slots (meals/coffee/shopping) are skipped to keep
        the number of Nominatim calls (rate limited to 1/sec, see
        osm_client.py) from adding too much latency on top of the GPT call.
        Best-effort: a lookup miss just leaves coordinates=None, it never
        fails the whole generation.

        TRANSPORTATION is also skipped even though it's a FIXED-slot type —
        its `name` is a movement description ("Di chuyển từ sân bay về
        trung tâm"), not a place, so geocoding it against Nominatim either
        misses outright or free-text-matches something unrelated. Treating
        that as a navigation waypoint sent GPS navigation to the wrong
        location.
        """
        fallback_city = cities[0] if cities else ""
        for day in day_plans:
            city = day.city or fallback_city
            for activity in day.activities:
                if activity.slot_type != SlotType.FIXED:
                    continue
                if activity.type == ActivityType.TRANSPORTATION:
                    continue
                if not activity.name:
                    continue
                # Deliberately name+city, NOT name+activity.location — GPT
                # invents a specific street address it was never grounded
                # against, and appending it to the query made Nominatim's
                # free-text search return zero results even for well-known
                # real landmarks (verified: every lookup got a 200 OK, most
                # came back empty once location was appended).
                coords = await self.osm_client.get_place_coordinates(f"{activity.name}, {city}")
                if coords:
                    activity.coordinates = LocationCoords(lat=coords[0], lng=coords[1])

    def _validate_structure(self, day_plans) -> None:
        """
        Diagnostic check: log a warning if GPT didn't structure a day to
        start (day 1) / end (every day) at the hotel. Warn-only — GPT is
        no longer programmatically corrected, just monitored.
        """
        for i, day in enumerate(day_plans):
            if not day.activities:
                continue

            first = day.activities[0]
            last = day.activities[-1]

            if i == 0 and first.type != ActivityType.HOTEL:
                logger.warning(
                    "hotel_first_violation",
                    extra={"day": day.date, "first_activity": first.name},
                )

            if last.type not in (ActivityType.HOTEL, ActivityType.TRANSPORTATION):
                logger.warning(
                    "hotel_last_violation",
                    extra={"day": day.date, "last_activity": last.name},
                )

    def _build_budget_guidance(
        self, breakdown: BudgetBreakdown, trip_days: int
    ) -> Dict[str, Any]:
        """
        Build budget guidance hints to pass to GPT.

        Provides realistic per-item caps and floor estimates so GPT
        can assign sensible costs even on tight budgets.
        """
        meals_per_day = 3
        total_meals = meals_per_day * trip_days
        nights = max(trip_days - 1, 1)

        per_meal_budget = breakdown.food / max(total_meals, 1)
        per_night_budget = breakdown.accommodation / max(nights, 1)
        per_attraction_budget = breakdown.attractions / max(trip_days * 2, 1)

        # Apply floors
        per_meal_suggested = max(per_meal_budget, 30_000)
        per_night_suggested = max(per_night_budget, 150_000)

        return {
            "per_meal_suggested_vnd": round(per_meal_suggested),
            "per_night_suggested_vnd": round(per_night_suggested),
            "per_attraction_suggested_vnd": round(per_attraction_budget),
            "total_food_budget_vnd": round(breakdown.food),
            "total_accommodation_budget_vnd": round(breakdown.accommodation),
            "note": (
                "Use these as MINIMUM cost estimates. "
                "Assign 0 only to genuinely free attractions (parks, beaches, temples). "
                "Never assign 0 to restaurants or hotels."
            ),
        }
