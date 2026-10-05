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

from app.core.exceptions import ActivityNotFoundError, ItineraryNotFoundError
from app.core.security import get_user_id_from_claims, require_auth
from app.database.repositories.itinerary_repository import ItineraryRepository
from app.database.session import get_db
from app.integrations.openai_client import OpenAIClient
from app.integrations.osm_client import OSMClient
from app.orchestrators.itinerary_orchestrator import ItineraryOrchestrator
from app.planners.itinerary_builder import compute_total_cost
from app.schemas.itinerary import (
    ActivityAlternative,
    ActivityAlternativesResponse,
    DayPlan,
    ItineraryResponse,
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
            "budget_cap_vnd": act.get("cost"),
        }
    )
    alternatives = [ActivityAlternative(**a) for a in raw.get("alternatives", [])]
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

    act["name"] = payload.name
    act["activity"] = payload.activity
    act["location"] = payload.location
    act["cost"] = payload.cost
    act["rating"] = payload.rating
    act["notes"] = payload.notes

    # Re-geocode — the old coordinates belong to the place being replaced,
    # carrying them over would point navigation at the wrong spot. name+city
    # only, not +location — see itinerary_orchestrator.py's
    # _geocode_fixed_activities for why appending GPT's invented street
    # address hurts Nominatim's hit rate.
    city = itinerary_data["days"][day_idx].get("city", "")
    coords = await OSMClient().get_place_coordinates(f"{payload.name}, {city}") if payload.name else None
    act["coordinates"] = {"lat": coords[0], "lng": coords[1]} if coords else None

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
