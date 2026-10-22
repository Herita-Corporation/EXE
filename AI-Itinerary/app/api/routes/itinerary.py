"""
Itinerary API routes — POST /generate, GET /{id}, DELETE /{id}, plus the
"edit a place" pair: GET .../activities/{id}/alternatives and
PATCH .../activities/{id}.
"""

from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ActivityNotFoundError,
    ItineraryNotFoundError,
    NoCandidatesFoundError,
)
from app.core.constants import MIN_HOTEL_PRICE_VND
from app.core.security import get_user_id_from_claims, require_auth
from app.database.repositories.itinerary_repository import ItineraryRepository
from app.database.session import get_db
from app.integrations.openai_client import OpenAIClient
from app.orchestrators.itinerary_orchestrator import ItineraryOrchestrator
from app.planners.itinerary_builder import compute_total_cost
from app.schemas.itinerary import (
    ActivityAlternative,
    ActivityAlternativesResponse,
    DayPlan,
    ItineraryResponse,
    LocationCoords,
)
from app.schemas.request import GenerateItineraryRequest
from app.schemas.response import DeleteResponse

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _find_activity(
    itinerary_data: Dict[str, Any], activity_id: str
) -> Optional[Tuple[int, int, Dict[str, Any]]]:
    """Locates (day_index, activity_index, raw_activity_dict) by activity_id
    inside a stored itinerary's raw JSONB `days` structure."""
    for day_idx, day in enumerate(itinerary_data.get("days", [])):
        for act_idx, act in enumerate(day.get("activities", [])):
            if act.get("activity_id") == activity_id:
                return day_idx, act_idx, act
    return None


def _is_hotel_activity(activity: Dict[str, Any]) -> bool:
    """Accept legacy/case-varied hotel values stored in existing JSONB rows."""
    raw_type = activity.get("type", "")
    normalized = getattr(raw_type, "value", raw_type)
    return str(normalized).strip().casefold() in {"hotel", "accommodation"}


def _hotel_nightly_rate(itinerary_data: Dict[str, Any]) -> float:
    """Return a positive, budget-aware nightly rate for hotel replacements.

    A hotel activity can legitimately be stored with cost=0 when another row
    on the same date already carries the nightly room charge. That zero is a
    duplicate-row accounting detail, not the price of a different hotel.
    """
    days = max(len(itinerary_data.get("days", [])), 1)
    accommodation = float(
        itinerary_data.get("budget_breakdown", {}).get("accommodation", 0) or 0
    )
    if accommodation > 0:
        return max(round(accommodation / days), MIN_HOTEL_PRICE_VND)

    existing_rates = [
        float(activity.get("cost") or 0)
        for day in itinerary_data.get("days", [])
        for activity in day.get("activities", [])
        if _is_hotel_activity(activity) and float(activity.get("cost") or 0) > 0
    ]
    if existing_rates:
        return max(round(sum(existing_rates) / len(existing_rates)), MIN_HOTEL_PRICE_VND)
    return max(500_000, MIN_HOTEL_PRICE_VND)


@router.post(
    "/itinerary/generate",
    response_model=ItineraryResponse,
    status_code=201,
    summary="Generate a personalized travel itinerary",
    description=(
        "Accepts trip parameters and produces a complete, budget-aware "
        "itinerary generated directly by GPT-4o-mini. "
        "user_id is extracted from the Bearer JWT token automatically."
    ),
)
@limiter.limit("60/minute")
async def generate_itinerary(
    request: Request,
    payload: GenerateItineraryRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> ItineraryResponse:
    user_id = UUID(get_user_id_from_claims(auth))
    orchestrator = ItineraryOrchestrator(db)
    return await orchestrator.generate(payload, user_id=user_id)


@router.delete(
    "/itinerary/user-data/all",
    response_model=DeleteResponse,
    summary="Delete every generated itinerary owned by the authenticated user",
)
async def delete_all_user_itineraries(
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> DeleteResponse:
    repo = ItineraryRepository(db)
    await repo.delete_by_user(UUID(get_user_id_from_claims(auth)))
    return DeleteResponse(success=True)


@router.get(
    "/itinerary/{itinerary_id}",
    response_model=ItineraryResponse,
    summary="Retrieve a previously generated itinerary",
)
async def get_itinerary(
    itinerary_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> ItineraryResponse:
    repo = ItineraryRepository(db)
    record = await repo.get_by_id(itinerary_id)
    if not record or str(record.user_id) != get_user_id_from_claims(auth):
        raise ItineraryNotFoundError()
    return ItineraryResponse(**record.generated_itinerary)


@router.post(
    "/itinerary/{itinerary_id}/activities/{activity_id}/coordinates",
    response_model=LocationCoords,
    summary="Resolve and persist GPS for one itinerary activity",
)
async def resolve_activity_coordinates(
    itinerary_id: UUID,
    activity_id: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> LocationCoords:
    repo = ItineraryRepository(db)
    record = await repo.get_by_id(itinerary_id)
    if not record or str(record.user_id) != get_user_id_from_claims(auth):
        raise ItineraryNotFoundError()

    itinerary_data = dict(record.generated_itinerary)
    found = _find_activity(itinerary_data, activity_id)
    if not found:
        raise ActivityNotFoundError()
    day_index, _, activity = found

    existing = activity.get("coordinates")
    if existing and existing.get("lat") is not None and existing.get("lng") is not None:
        return LocationCoords(**existing)

    trip_summary = itinerary_data.get("trip_summary", {})
    trip_cities = trip_summary.get("cities", [])
    day_city = itinerary_data.get("days", [])[day_index].get("city")
    name = str(activity.get("name") or "").strip()
    location = str(activity.get("location") or "").strip()

    raw_queries = [
        ", ".join(part for part in (name, trip_cities[0] if trip_cities else None) if part),
        ", ".join(part for part in (name, location) if part),
        ", ".join(part for part in (name, day_city) if part),
        name,
    ]
    queries = list(dict.fromkeys(query for query in raw_queries if query))[:3]

    coords = None
    geocoder = OSMClient()
    for query in queries:
        coords = await geocoder.get_place_coordinates(query)
        if coords:
            break
    if not coords:
        raise NoCandidatesFoundError(
            "Không tìm thấy tọa độ đáng tin cậy cho địa điểm này. "
            "Hãy đổi sang một địa điểm khác trong lịch trình."
        )

    resolved = LocationCoords(lat=coords[0], lng=coords[1])
    activity["coordinates"] = resolved.model_dump(mode="json")
    await repo.update_content(
        itinerary_id,
        itinerary_data,
        float(itinerary_data.get("total_cost", record.total_cost)),
    )
    return resolved


@router.delete(
    "/itinerary/{itinerary_id}",
    response_model=DeleteResponse,
    summary="Delete a generated itinerary",
)
async def delete_itinerary(
    itinerary_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> DeleteResponse:
    repo = ItineraryRepository(db)
    record = await repo.get_by_id(itinerary_id)
    if not record or str(record.user_id) != get_user_id_from_claims(auth):
        raise ItineraryNotFoundError()
    await repo.delete_by_id(itinerary_id)
    return DeleteResponse(success=True)


@router.get(
    "/itinerary/{itinerary_id}/activities/{activity_id}/alternatives",
    response_model=ActivityAlternativesResponse,
    summary="Suggest AI alternative places for one activity slot",
    description=(
        "Lets a user swap a single GPT-suggested place for a better fit — "
        "GPT suggests real alternative places in the same city/category."
    ),
)
async def get_activity_alternatives(
    itinerary_id: UUID,
    activity_id: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> ActivityAlternativesResponse:
    repo = ItineraryRepository(db)
    record = await repo.get_by_id(itinerary_id)
    if not record or str(record.user_id) != get_user_id_from_claims(auth):
        raise ItineraryNotFoundError()

    found = _find_activity(record.generated_itinerary, activity_id)
    if not found:
        raise ActivityNotFoundError()
    day_idx, _act_idx, act = found
    city = record.generated_itinerary["days"][day_idx].get("city", "")

    is_hotel = _is_hotel_activity(act)
    budget_cap = float(act.get("cost") or 0)
    hotel_rate = _hotel_nightly_rate(record.generated_itinerary) if is_hotel else 0
    if is_hotel and budget_cap <= 0:
        budget_cap = hotel_rate

    openai_client = OpenAIClient()
    raw = await openai_client.generate_alternatives(
        {
            "city": city,
            "activity_type": act.get("type"),
            "current_place": {
                "name": act.get("name"),
                "activity": act.get("activity"),
                "cost": act.get("cost"),
            },
            "budget_cap_vnd": budget_cap,
        }
    )
    alternatives = [ActivityAlternative(**a) for a in raw.get("alternatives", [])]
    if is_hotel:
        # GPT may mirror the source row's bookkeeping cost=0. Never expose
        # that as a free replacement hotel: cost here means nightly room rate.
        alternatives = [
            alternative.model_copy(
                update={
                    "cost": (
                        max(alternative.cost, MIN_HOTEL_PRICE_VND)
                        if alternative.cost > 0
                        else hotel_rate
                    )
                }
            )
            for alternative in alternatives
        ]
    return ActivityAlternativesResponse(alternatives=alternatives)


@router.patch(
    "/itinerary/{itinerary_id}/activities/{activity_id}",
    response_model=ItineraryResponse,
    summary="Replace one activity's place with a chosen alternative",
    description=(
        "Keeps the activity's schedule slot (time/type/activity_id — so any "
        "mission already linked to it stays linked) and swaps only the place "
        "details (name/activity/location/cost/rating/notes), then "
        "recomputes total_cost."
    ),
)
async def replace_activity(
    itinerary_id: UUID,
    activity_id: str,
    payload: ActivityAlternative,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> ItineraryResponse:
    repo = ItineraryRepository(db)
    record = await repo.get_by_id(itinerary_id)
    if not record or str(record.user_id) != get_user_id_from_claims(auth):
        raise ItineraryNotFoundError()

    itinerary_data = record.generated_itinerary
    found = _find_activity(itinerary_data, activity_id)
    if not found:
        raise ActivityNotFoundError()
    day_idx, act_idx, act = found

    replacement_cost = payload.cost
    if _is_hotel_activity(act) and replacement_cost <= 0:
        # Do not trust a stale client or old cached alternatives containing
        # 0 VND. The server is the final guard for billing consistency.
        replacement_cost = _hotel_nightly_rate(itinerary_data)

    act["name"] = payload.name
    act["activity"] = payload.activity
    act["location"] = payload.location
    act["cost"] = replacement_cost
    act["rating"] = payload.rating
    act["notes"] = payload.notes
    itinerary_data["days"][day_idx]["activities"][act_idx] = act

    day_plans = [DayPlan(**d) for d in itinerary_data["days"]]
    itinerary_data["total_cost"] = compute_total_cost(day_plans)

    result = ItineraryResponse(**itinerary_data)
    await repo.update_content(
        itinerary_id,
        result.model_dump(mode="json"),
        float(result.total_cost),
    )

    return result
