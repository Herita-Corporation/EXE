"""
Retrieval debug endpoint — useful for testing the knowledge base.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BUDGET_ALLOCATION
from app.core.security import require_auth
from app.database.session import get_db
from app.schemas.itinerary import BudgetBreakdown
from app.services.retrieval_service import RetrievalService

router = APIRouter()


@router.get(
    "/retrieval/candidates",
    summary="[Debug] Retrieve candidate locations",
    description=(
        "Returns the raw candidate locations for a given set of cities and budget. "
        "Useful for debugging the knowledge base and retrieval layer."
    ),
)
async def get_candidates(
    cities: List[str] = Query(..., description="List of cities to query"),
    budget: float = Query(..., gt=0, description="Total trip budget in VND"),
    days: int = Query(default=3, ge=1, description="Trip duration in days"),
    preferences: Optional[List[str]] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
) -> dict:
    planning_budget = budget * 0.7
    breakdown = BudgetBreakdown(
        transportation=planning_budget * BUDGET_ALLOCATION["transportation"],
        accommodation=planning_budget * BUDGET_ALLOCATION["accommodation"],
        food=planning_budget * BUDGET_ALLOCATION["food"],
        attractions=planning_budget * BUDGET_ALLOCATION["attractions"],
        contingency=planning_budget * BUDGET_ALLOCATION["contingency"],
    )
    service = RetrievalService(db)
    candidates = await service.retrieve_candidates(
        cities=cities,
        budget_breakdown=breakdown,
        trip_duration_days=days,
        preferences=preferences or [],
    )
    return {
        "cities": cities,
        "budget": budget,
        "planning_budget": planning_budget,
        "candidates": {
            "attractions_count": len(candidates["attractions"]),
            "restaurants_count": len(candidates["restaurants"]),
            "hotels_count": len(candidates["hotels"]),
            "attractions": candidates["attractions"],
            "restaurants": candidates["restaurants"],
            "hotels": candidates["hotels"],
        },
    }
