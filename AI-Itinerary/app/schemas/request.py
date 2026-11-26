"""
Request schemas — Pydantic v2 models for incoming API requests.
"""

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class GenerateItineraryRequest(BaseModel):
    """FR-01: Input payload for itinerary generation.
    
    Note: user_id is NOT included here — it is extracted server-side from
    the JWT Bearer token (sub claim) to prevent user impersonation.
    """

    cities: List[str] = Field(
        ..., min_length=1, description="List of cities to visit (at least one)"
    )
    budget: float = Field(
        ..., gt=0, description="Total trip budget in VND (must be > 0)"
    )
    travelers: int = Field(
        default=1, ge=1, le=10, description="Number of travelers (1-10)"
    )
    start_date: date = Field(..., description="Trip start date (YYYY-MM-DD)")
    end_date: date = Field(..., description="Trip end date (YYYY-MM-DD)")
    preferences: Optional[List[str]] = Field(
        default=[], description="Optional travel preferences (e.g. food, culture)"
    )

    @model_validator(mode="after")
    def validate_dates(self) -> "GenerateItineraryRequest":
        vietnam_now = datetime.now(timezone(timedelta(hours=7)))
        if self.start_date < vietnam_now.date():
            raise ValueError("start_date cannot be in the past.")
        if self.start_date == vietnam_now.date() and vietnam_now.hour >= 18:
            raise ValueError(
                "Same-day itineraries cannot be created after 18:00 Vietnam time."
            )
        if self.start_date > self.end_date:
            raise ValueError("start_date must be less than or equal to end_date.")
        return self

    @property
    def trip_duration_days(self) -> int:
        return (self.end_date - self.start_date).days + 1

    model_config = {
        "json_schema_extra": {
            "example": {
                "cities": ["Da Nang", "Hoi An"],
                "budget": 10000000,
                "travelers": 2,
                "start_date": "2027-01-01",
                "end_date": "2027-01-05",
                "preferences": ["food", "culture"],
            }
        }
    }
