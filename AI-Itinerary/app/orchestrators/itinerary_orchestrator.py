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

from app.core.constants import MIN_HOTEL_PRICE_VND
from app.core.exceptions import InvalidBudgetError, InvalidCityError, InvalidDateError, InvalidItineraryError
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
VIETNAM_TZ = timezone(timedelta(hours=7))

MEAL_TYPES = {
    ActivityType.BREAKFAST,
    ActivityType.LUNCH,
    ActivityType.DINNER,
}
EXPLORATION_TYPES = {
    ActivityType.ATTRACTION,
    ActivityType.EXPERIENCE,
    ActivityType.MARKET,
    ActivityType.SHOPPING,
}


def normalize_daily_hotel_costs(
    day_plans: list[DayPlan], suggested_nightly_rate: float
) -> None:
    """Charge one positive nightly rate per day for the selected hotel.

    GPT may emit multiple rows for check-in/rest/return. Only one row should
    carry the room rate, but an entire day of zero-cost hotel rows is invalid.
    """
    fallback_rate = max(round(suggested_nightly_rate), MIN_HOTEL_PRICE_VND)
    for day in day_plans:
        hotels = [activity for activity in day.activities if activity.type == ActivityType.HOTEL]
        if not hotels:
            continue
        positive_rates = [activity.cost for activity in hotels if activity.cost > 0]
        nightly_rate = max(positive_rates) if positive_rates else fallback_rate
        hotels[0].cost = max(nightly_rate, MIN_HOTEL_PRICE_VND)
        for duplicate_row in hotels[1:]:
            duplicate_row.cost = 0


def validate_itinerary_quality(
    day_plans: list[DayPlan], *, partial_first_day: bool = False
) -> None:
    """Reject superficially complete but unusable model output."""
    violations: list[str] = []
    for day_index, day in enumerate(day_plans):
        activities = day.activities
        is_partial = partial_first_day and day_index == 0
        minimum_activities = 2 if is_partial else (4 if day_index == 0 else 5)
        meals = [activity for activity in activities if activity.type in MEAL_TYPES]
        exploration = [
            activity for activity in activities if activity.type in EXPLORATION_TYPES
        ]
        hotels = [
            activity for activity in activities if activity.type == ActivityType.HOTEL
        ]

        if len(activities) < minimum_activities:
            violations.append(
                f"day {day_index + 1} has {len(activities)} activities; "
                f"minimum is {minimum_activities}"
            )
        if is_partial:
            if not meals and not exploration:
                violations.append(f"day {day_index + 1} has no meal or exploration stop")
        else:
            if not meals:
                violations.append(f"day {day_index + 1} has no named meal stop")
            if not exploration:
                violations.append(f"day {day_index + 1} has no exploration stop")
        if not hotels:
            violations.append(f"day {day_index + 1} has no hotel return/stay")
        elif max(hotel.cost for hotel in hotels) <= 0:
            violations.append(f"day {day_index + 1} has no positive nightly hotel rate")

        hotel_names = {
            hotel.name.strip().casefold() for hotel in hotels if hotel.name.strip()
        }
        if len(hotel_names) > 1:
            violations.append(f"day {day_index + 1} switches between multiple hotels")

    if violations:
        raise InvalidItineraryError("; ".join(violations))


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
        budget_profile = self.budget_service.build_budget_profile(
            request.budget,
            planning_budget,
            request.travelers,
            request.trip_duration_days,
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
            request.travelers,
        )
        cache_lookup_started = time.monotonic()
        cached = await self.cache_repo.get(cache_key)
        logger.info(
            "cache_lookup_complete",
            extra={
                "request_id": request_id,
                "cache_hit": cached is not None,
                "latency_ms": int((time.monotonic() - cache_lookup_started) * 1000),
            },
        )
        vietnam_today = datetime.now(VIETNAM_TZ).date()
        cache_candidate = bool(
            request.start_date > vietnam_today
            and cached
            and len(cached.get("days", [])) == request.trip_duration_days
        )
        cached_day_plans: list[DayPlan] | None = None
        cache_valid = False
        if cache_candidate:
            try:
                cached_day_plans = [
                    DayPlan(
                        **{
                            **day,
                            "date": str(request.start_date + timedelta(days=index)),
                        }
                    )
                    for index, day in enumerate(cached["days"])
                ]
                normalize_daily_hotel_costs(
                    cached_day_plans,
                    breakdown.accommodation / max(request.trip_duration_days, 1),
                )
                validate_itinerary_quality(cached_day_plans)
                cache_valid = True
            except (InvalidItineraryError, TypeError, ValueError) as exc:
                logger.warning(
                    "invalid_cache_ignored",
                    extra={"cache_key": cache_key, "reason": str(exc)},
                )

        if cache_valid:
            logger.info("cache_hit", extra={"cache_key": cache_key})
            day_plans = cached_day_plans or []
            total_cost = compute_total_cost(day_plans)
        else:
            # Generate long trips in bounded chunks. The model previously
            # stopped after roughly five days for 9-10 day requests.
            day_plans = await self._generate_day_plans(
                request=request,
                user_id=user_id,
                planning_budget=planning_budget,
                reserve_budget=reserve_budget,
                breakdown=breakdown,
                budget_profile=budget_profile,
                request_id=request_id,
            )

            # GPS is resolved lazily when directions or a mission needs it.
            # Serial public-geocoder calls previously added 8+ seconds to
            # every generation, even when the user never used map features.

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
        if not cache_valid:
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

    async def _generate_day_plans(
        self,
        *,
        request: GenerateItineraryRequest,
        user_id: UUID,
        planning_budget: float,
        reserve_budget: float,
        breakdown: BudgetBreakdown,
        budget_profile: Dict[str, Any],
        request_id: str,
    ) -> list[DayPlan]:
        """Generate and merge count-validated chunks of at most five days.

        If a model still truncates a chunk twice, subdivide it into one-day
        requests. A response is returned only after every requested calendar
        day has a corresponding DayPlan.
        """
        result: list[DayPlan] = []
        used_places: list[str] = []

        for chunk_offset in range(0, request.trip_duration_days, 5):
            chunk_days = min(5, request.trip_duration_days - chunk_offset)
            chunk_started = time.monotonic()
            logger.info(
                "chunk_generation_started",
                extra={
                    "request_id": request_id,
                    "chunk_number": chunk_offset // 5 + 1,
                    "chunk_count": (request.trip_duration_days + 4) // 5,
                    "chunk_days": chunk_days,
                },
            )
            chunk = await self._generate_chunk(
                request=request,
                user_id=user_id,
                planning_budget=planning_budget,
                reserve_budget=reserve_budget,
                breakdown=breakdown,
                budget_profile=budget_profile,
                request_id=request_id,
                chunk_offset=chunk_offset,
                chunk_days=chunk_days,
                used_places=used_places,
            )
            logger.info(
                "chunk_generation_complete",
                extra={
                    "request_id": request_id,
                    "chunk_number": chunk_offset // 5 + 1,
                    "chunk_days": chunk_days,
                    "latency_ms": int((time.monotonic() - chunk_started) * 1000),
                },
            )
            result.extend(chunk)
            used_places.extend(
                activity.name
                for day in chunk
                for activity in day.activities
                if activity.type != ActivityType.HOTEL and activity.name
            )

        if len(result) != request.trip_duration_days:
            raise InvalidItineraryError(
                f"Generated {len(result)} day(s), expected {request.trip_duration_days}."
            )
        return result

    async def _generate_chunk(
        self,
        *,
        request: GenerateItineraryRequest,
        user_id: UUID,
        planning_budget: float,
        reserve_budget: float,
        breakdown: BudgetBreakdown,
        budget_profile: Dict[str, Any],
        request_id: str,
        chunk_offset: int,
        chunk_days: int,
        used_places: list[str],
    ) -> list[DayPlan]:
        chunk_start = request.start_date + timedelta(days=chunk_offset)
        chunk_end = chunk_start + timedelta(days=chunk_days - 1)
        ratio = chunk_days / request.trip_duration_days
        chunk_breakdown = {
            key: round(value * ratio)
            for key, value in breakdown.model_dump().items()
        }
        vietnam_now = datetime.now(VIETNAM_TZ)
        earliest_start_time: str | None = None
        if chunk_offset == 0 and chunk_start == vietnam_now.date():
            # Give the traveler one hour to get ready, rounded to the next
            # half-hour. Same-day requests after 18:00 are rejected earlier.
            ready_at = vietnam_now + timedelta(hours=1)
            minute = 30 if ready_at.minute <= 30 else 0
            hour = ready_at.hour if minute == 30 else ready_at.hour + 1
            earliest_start_time = f"{hour:02d}:{minute:02d}"

        chunk_budget_profile = {
            **budget_profile,
            "target_total_cost_min": round(
                budget_profile["target_total_cost_min"] * ratio
            ),
            "target_total_cost_max": round(
                budget_profile["target_total_cost_max"] * ratio
            ),
        }
        context = GenerationContext(
            trip_information={
                "user_id": str(user_id),
                "cities": request.cities,
                "start_date": str(chunk_start),
                "end_date": str(chunk_end),
                "trip_duration_days": chunk_days,
                "overall_start_date": str(request.start_date),
                "overall_end_date": str(request.end_date),
                "overall_trip_duration_days": request.trip_duration_days,
                "day_number_offset": chunk_offset,
                "is_continuation": chunk_offset > 0,
                "total_budget": round(request.budget * ratio),
                "planning_budget": round(planning_budget * ratio),
                "reserve_budget": round(reserve_budget * ratio),
                "travelers": request.travelers,
                "budget_breakdown": chunk_breakdown,
                "budget_profile": chunk_budget_profile,
                "earliest_start_time": earliest_start_time,
                "preferences": request.preferences or [],
                "already_used_places": used_places[-80:],
                "budget_guidance": self._build_budget_guidance(
                    breakdown, request.trip_duration_days
                ),
            },
        )

        last_error: InvalidItineraryError | None = None
        best_under_target: tuple[float, list[DayPlan]] | None = None
        for attempt in range(2):
            gpt_raw = await self.openai_client.generate_itinerary(context.model_dump())
            try:
                candidate = self.itinerary_builder.build_from_gpt_output(
                    json.dumps(gpt_raw),
                    start_date=chunk_start,
                    cities=request.cities,
                    expected_days=chunk_days,
                    earliest_start_time=earliest_start_time,
                )
                normalize_daily_hotel_costs(
                    candidate,
                    breakdown.accommodation / max(request.trip_duration_days, 1),
                )
                validate_itinerary_quality(
                    candidate,
                    partial_first_day=earliest_start_time is not None,
                )
                candidate_cost = compute_total_cost(candidate)
                minimum_cost = chunk_budget_profile["target_total_cost_min"]
                if (
                    chunk_budget_profile["enforce_minimum"]
                    and candidate_cost < minimum_cost
                ):
                    if best_under_target is None or candidate_cost > best_under_target[0]:
                        best_under_target = (candidate_cost, candidate)
                    context.trip_information["retry_feedback"] = (
                        f"The previous complete itinerary cost {candidate_cost:,.0f} VND, "
                        f"below the {chunk_budget_profile['tier']} target minimum of "
                        f"{minimum_cost:,.0f} VND. Upgrade real hotels, transport, "
                        "restaurants and paid experiences while staying realistic."
                    )
                    logger.warning(
                        "budget_target_retry",
                        extra={
                            "request_id": request_id,
                            "candidate_cost": candidate_cost,
                            "minimum_cost": minimum_cost,
                            "attempt": attempt + 1,
                        },
                    )
                    continue
                return candidate
            except InvalidItineraryError as exc:
                last_error = exc
                context.trip_information["retry_feedback"] = (
                    "The previous response was rejected as unusable: "
                    f"{exc}. Return every requested day with real named places, "
                    "at least one restaurant meal and one exploration stop per "
                    "full day, plus one positive nightly hotel charge."
                )
                logger.warning(
                    "invalid_chunk_retry",
                    extra={
                        "request_id": request_id,
                        "chunk_offset": chunk_offset,
                        "chunk_days": chunk_days,
                        "attempt": attempt + 1,
                        "reason": str(exc),
                    },
                )

        # A structurally complete result is preferable to recursively making
        # up to ten more GPT calls. The targeted second prompt above usually
        # raises quality; if it still underspends, return the better complete
        # candidate without turning a budget-style miss into a timeout.
        if best_under_target is not None:
            return best_under_target[1]

        if chunk_days > 1:
            logger.warning(
                "chunk_subdivided_to_single_days",
                extra={"request_id": request_id, "chunk_offset": chunk_offset},
            )
            single_days: list[DayPlan] = []
            for relative_day in range(chunk_days):
                day = await self._generate_chunk(
                    request=request,
                    user_id=user_id,
                    planning_budget=planning_budget,
                    reserve_budget=reserve_budget,
                    breakdown=breakdown,
                    budget_profile=budget_profile,
                    request_id=request_id,
                    chunk_offset=chunk_offset + relative_day,
                    chunk_days=1,
                    used_places=used_places + [
                        activity.name
                        for plan in single_days
                        for activity in plan.activities
                        if activity.type != ActivityType.HOTEL and activity.name
                    ],
                )
                single_days.extend(day)
            return single_days

        raise last_error or InvalidItineraryError("GPT returned an invalid day plan.")

    def _validate_request(self, request: GenerateItineraryRequest) -> None:
        """Domain-level validation beyond Pydantic."""
        if request.budget <= 0:
            raise InvalidBudgetError()
        if request.start_date > request.end_date:
            raise InvalidDateError()
        vietnam_now = datetime.now(VIETNAM_TZ)
        if request.start_date < vietnam_now.date():
            raise InvalidDateError("Trip start date cannot be in the past.")
        if request.start_date == vietnam_now.date() and vietnam_now.hour >= 18:
            raise InvalidDateError(
                "Same-day itineraries cannot be created after 18:00 Vietnam time."
            )
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
        # Nominatim is rate-limited to one request/second. Looking up every
        # fixed stop of a long trip caused avoidable mobile/proxy timeouts.
        # Missing coordinates are resolved lazily by the app when a mission
        # is accepted, so cap eager navigation anchors here.
        remaining = 8
        for day in day_plans:
            city = day.city or fallback_city
            for activity in day.activities:
                if remaining <= 0:
                    return
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
                remaining -= 1

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
