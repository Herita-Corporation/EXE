"""
Itinerary domain schemas — redesigned output schema.

Key changes vs v1:
- Activity now carries selected_place + alternatives (PlaceDetail objects)
- PlaceDetail carries GPS coordinates (LocationCoords) and price ranges (PriceRange)
- SlotType distinguishes fixed anchor locations from flexible meal/shopping slots
- ActivityType gains MARKET and COFFEE to prevent misclassification
- Legacy fields (name, cost) kept for backward compatibility
"""

from datetime import date
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, model_validator


# ── Slot Classification ────────────────────────────────────────────────────────

class SlotType(str, Enum):
    """
    Distinguishes route-backbone anchors from route-flexible stops.

    fixed    — hotel, transportation, attraction, landmark, museum.
               These define the itinerary skeleton and are placed first.
    flexible — breakfast, lunch, dinner, coffee, market, shopping.
               These are chosen ALONG the route between fixed anchors,
               ensuring they never require a large detour.
    """
    FIXED = "fixed"
    FLEXIBLE = "flexible"


# ── Activity Type ──────────────────────────────────────────────────────────────

class ActivityType(str, Enum):
    """Allowed activity types."""
    TRANSPORTATION = "transportation"
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    ATTRACTION = "attraction"
    HOTEL = "hotel"
    SHOPPING = "shopping"
    EXPERIENCE = "experience"
    MARKET = "market"    # NEW — night markets, traditional markets, food markets
    COFFEE = "coffee"    # NEW — coffee stops, dessert breaks


# ── Sub-models ────────────────────────────────────────────────────────────────

class LocationCoords(BaseModel):
    """GPS coordinates for a place. Required for map/navigation features."""
    lat: float = Field(..., description="Latitude (WGS84)")
    lng: float = Field(..., description="Longitude (WGS84)")


class PriceRange(BaseModel):
    """
    Estimated price range instead of a single exact price.

    Rationale: restaurant prices vary by menu; exact prices mislead users.
    Hotels vary by room type; attractions may have tiered pricing.
    """
    min: float = Field(..., ge=0, description="Lower estimate in VND")
    max: float = Field(..., ge=0, description="Upper estimate in VND")
    currency: str = Field(default="VND")

    @model_validator(mode="after")
    def validate_range(self) -> "PriceRange":
        if self.max < self.min:
            self.max = self.min
        return self


class PlaceDetail(BaseModel):
    """
    Full detail for a single place recommendation.

    Used for both selected_place and each entry in alternatives.
    Carries enough information for frontend rendering, GPS navigation,
    distance calculation, and future booking integration.
    """
    id: Optional[str] = Field(default=None, description="DB UUID of the place")
    name: str
    category: str = Field(default="attraction")
    location: Optional[LocationCoords] = None
    price_range: Optional[PriceRange] = None
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    review_count: Optional[int] = None
    notes: Optional[str] = None

    # Extensibility fields for future features
    # opening_hours: Optional[str] = None  # future: validate visit feasibility
    # booking_url: Optional[str] = None    # future: booking integration
    # popularity_rank: Optional[int] = None # future: attraction ranking


class Recommendation(BaseModel):
    """
    A single ranked recommendation for a flexible time slot.

    Each flexible slot (breakfast/lunch/dinner/coffee/market/shopping)
    carries a list of 5 ranked Recommendation objects so the user can
    freely swap to any option without regenerating the whole itinerary.

    Fields:
        priority:  1 = AI top pick, 2-5 = ranked alternatives.
        place:     Full PlaceDetail with GPS, price range, rating.
        reason:    Short human-readable explanation of why this place
                   was recommended at this priority level.
                   Example: "Nhà hàng phở nổi tiếng nhất, gần tuyến đường"
    """
    priority: int = Field(..., ge=1, le=5, description="Rank 1 (best) to 5")
    place: PlaceDetail
    reason: str = Field(
        default="",
        description="Short explanation of why this place is recommended",
    )


# ── Core Activity Model ────────────────────────────────────────────────────────

class Activity(BaseModel):
    """
    Single activity in a daily schedule.

    v4 changes (direct-generation, no RAG):
    - No DB grounding — GPT supplies name/location/cost/rating directly from
      its own knowledge instead of being matched against retrieved candidates.
    - activity_id: stable per-activity UUID, generated once when the activity
      is built and persisted as part of the itinerary's JSONB blob. Used by
      the mission system to target a specific activity (AssignMissionRequest.
      PlaceId expects a GUID).
    - location: free-text address/area supplied by GPT (no GPS enrichment).
    """
    activity_id: str = Field(default_factory=lambda: str(uuid4()), description="Stable ID for this activity, used to link missions")
    start_time: str = Field(..., description="HH:MM format")
    end_time: str = Field(..., description="HH:MM format")
    type: ActivityType
    slot_type: SlotType = Field(
        default=SlotType.FIXED,
        description="fixed = route anchor; flexible = chosen along route",
    )

    # Human-readable activity label (what to do there)
    activity: str = Field(default="", description="Human-readable activity description")

    name: str = Field(default="", description="Place name")
    location: Optional[str] = Field(default=None, description="Free-text address/area")
    cost: float = Field(default=0.0, ge=0, description="Approx cost in VND")
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    notes: Optional[str] = None
    coordinates: Optional[LocationCoords] = Field(
        default=None,
        description="GPS coordinates geocoded server-side from name+location "
        "(Nominatim), for map/navigation — null if geocoding missed.",
    )

    @model_validator(mode="after")
    def validate_times(self) -> "Activity":
        if self.start_time >= self.end_time:
            raise ValueError(
                f"start_time ({self.start_time}) must be before end_time ({self.end_time})"
            )
        return self


# ── Day Plan ──────────────────────────────────────────────────────────────────

class DayPlan(BaseModel):
    """Plan for a single day."""
    date: str = Field(..., description="YYYY-MM-DD")
    city: str
    activities: List[Activity] = Field(default_factory=list)

    @property
    def daily_cost(self) -> float:
        return sum(a.cost for a in self.activities)


# ── Trip-level Models ─────────────────────────────────────────────────────────

class TripSummary(BaseModel):
    """Top-level trip summary."""
    start_date: str
    end_date: str
    cities: List[str]
    budget: float
    planning_budget: float
    reserve_budget: float
    trip_duration_days: int


class BudgetBreakdown(BaseModel):
    """Budget allocation across categories."""
    transportation: float = 0.0
    accommodation: float = 0.0
    food: float = 0.0
    attractions: float = 0.0
    contingency: float = 0.0

    @property
    def total(self) -> float:
        return (
            self.transportation
            + self.accommodation
            + self.food
            + self.attractions
            + self.contingency
        )


class ItineraryResponse(BaseModel):
    """Full itinerary response — API output schema."""
    itinerary_id: UUID
    trip_summary: TripSummary
    budget_breakdown: BudgetBreakdown
    days: List[DayPlan]
    total_cost: float
    created_at: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "itinerary_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "trip_summary": {
                    "start_date": "2027-01-01",
                    "end_date": "2027-01-05",
                    "cities": ["Da Nang", "Hoi An"],
                    "budget": 10000000,
                    "planning_budget": 7000000,
                    "reserve_budget": 3000000,
                    "trip_duration_days": 5,
                },
                "days": [],
                "total_cost": 6500000,
            }
        }
    }


# ── GPT Context Intermediate ─────────────────────────────────────────────────

class GenerationContext(BaseModel):
    """Intermediate object passed to GPT — trip info only, no DB retrieval."""
    trip_information: Dict[str, Any]


# ── Activity Alternatives (edit-a-place feature) ─────────────────────────────

class ActivityAlternative(BaseModel):
    """
    One AI-suggested alternative place for a specific activity slot — same
    shape as the replaceable fields of Activity (everything except the
    schedule/id fields, which stay fixed when a user swaps the place).
    Also used as the PATCH request body when the user picks one.
    """
    name: str
    activity: str = Field(default="", description="Human-readable activity description")
    location: Optional[str] = Field(default=None, description="Free-text address/area")
    cost: float = Field(default=0.0, ge=0, description="Approx cost in VND")
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    notes: Optional[str] = None


class ActivityAlternativesResponse(BaseModel):
    """Response for GET .../activities/{activity_id}/alternatives."""
    alternatives: List[ActivityAlternative] = Field(default_factory=list)
