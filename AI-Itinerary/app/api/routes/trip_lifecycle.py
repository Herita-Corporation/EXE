"""Additive cloud history/lifecycle on existing itinerary JSONB, not a second trip store."""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_auth, get_user_id_from_claims
from app.database.session import get_db
from app.database.models.itinerary import GeneratedItinerary
from app.database.repositories.itinerary_repository import ItineraryRepository

router = APIRouter()
VN = timezone(timedelta(hours=7))

def display_group(data: dict, today: str) -> str:
    summary = data["trip_summary"]
    state = data.get("lifecycle", {}).get("status", "PLANNED")
    if state in {"COMPLETED", "CANCELLED"} or summary["end_date"] < today:
        return "PAST"
    return "UPCOMING" if summary["start_date"] > today else "ONGOING"

async def owned_record(db, trip_id, auth, lock=False):
    statement = select(GeneratedItinerary).where(
        GeneratedItinerary.id == trip_id,
        GeneratedItinerary.user_id == UUID(get_user_id_from_claims(auth)),
    )
    if lock:
        statement = statement.with_for_update()
    record = (await db.execute(statement)).scalar_one_or_none()
    if record is None:
        raise HTTPException(404, "Itinerary not found")
    return record

@router.get("/itinerary")
async def list_my_trips(limit: int = Query(50, ge=1, le=100), db: AsyncSession = Depends(get_db), auth: dict = Depends(require_auth)):
    records = await ItineraryRepository(db).get_by_user(UUID(get_user_id_from_claims(auth)), limit)
    now = datetime.now(timezone.utc)
    result = []
    for r in records:
        data = deepcopy(r.generated_itinerary)
        data["display_group"] = display_group(data, now.astimezone(VN).date().isoformat())
        data["server_now"] = now.isoformat()
        result.append(data)
    return result

class LifecycleInput(BaseModel):
    action: Literal["START", "COMPLETE", "CANCEL"]

@router.post("/itinerary/{trip_id}/lifecycle")
async def lifecycle(trip_id: UUID, body: LifecycleInput, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_auth)):
    record = await owned_record(db, trip_id, auth, lock=True)
    data = deepcopy(record.generated_itinerary)
    state = data.setdefault("lifecycle", {"status": "PLANNED", "version": 0})
    target = {"START": "IN_PROGRESS", "COMPLETE": "COMPLETED", "CANCEL": "CANCELLED"}[body.action]
    if state["status"] == target:
        return state
    if state["status"] in {"COMPLETED", "CANCELLED"}:
        raise HTTPException(409, "Trip has already ended")
    now = datetime.now(timezone.utc)
    today = now.astimezone(VN).date().isoformat()
    if body.action == "START" and not data["trip_summary"]["start_date"] <= today <= data["trip_summary"]["end_date"]:
        raise HTTPException(422, "Trip can only start within its scheduled dates")
    if body.action == "COMPLETE" and state["status"] != "IN_PROGRESS":
        raise HTTPException(409, "Start the trip before completing it")
    state.update(status=target, version=state.get("version", 0) + 1, changed_at=now.isoformat(), completion_source="USER")
    await ItineraryRepository(db).update_content(trip_id, data, record.total_cost)
    return state

class ExpenseInput(BaseModel):
    expense_id: UUID
    amount: int = Field(ge=0, le=1_000_000_000)
    category: str = Field(min_length=1, max_length=50)
    note: str = Field(default="", max_length=500)

@router.post("/itinerary/{trip_id}/expenses")
async def expense(trip_id: UUID, body: ExpenseInput, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_auth)):
    record = await owned_record(db, trip_id, auth, lock=True)
    data = deepcopy(record.generated_itinerary)
    state = data.setdefault("lifecycle", {"status": "PLANNED", "version": 0})
    entries = state.setdefault("expenses", [])
    current = next((e for e in entries if e["expense_id"] == str(body.expense_id)), None)
    entry = {**body.model_dump(mode="json"), "source": "SELF_REPORTED"}
    if current and current != entry:
        raise HTTPException(409, "Expense ID already exists with different data")
    if not current:
        if len(entries) >= 200:
            raise HTTPException(422, "Expense limit reached")
        entries.append(entry)
        await ItineraryRepository(db).update_content(trip_id, data, record.total_cost)
    return entry

@router.get("/itinerary/{trip_id}/summary")
async def summary(trip_id: UUID, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_auth)):
    record = await owned_record(db, trip_id, auth)
    data = record.generated_itinerary
    state = data.get("lifecycle", {"status": "PLANNED"})
    return {"itinerary_id": trip_id, "lifecycle": state, "estimated_total": data["total_cost"],
            "self_reported_actual_total": sum(e["amount"] for e in state.get("expenses", [])),
            "note": "Self-reported expenses are not verified receipts or DISA revenue."}
