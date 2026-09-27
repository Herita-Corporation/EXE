// AITourService forwards the exact snake_case JSON contract of the
// AI-Itinerary (Python/FastAPI) service — its C# DTOs use explicit
// [JsonPropertyName] attributes matching AI-Itinerary/app/schemas/*.py.

export interface GenerateItineraryRequest {
  cities: string[];
  budget: number;
  start_date: string; // "YYYY-MM-DD"
  end_date: string; // "YYYY-MM-DD"
  preferences: string[];
}

export interface TripSummary {
  start_date: string;
  end_date: string;
  cities: string[];
  budget: number;
  planning_budget: number;
  reserve_budget: number;
  trip_duration_days: number;
}

export interface BudgetBreakdown {
  accommodation: number;
  food: number;
  attractions: number;
  transportation: number;
  miscellaneous: number;
}

export interface Activity {
  activity_id: string;
  name: string;
  type: string;
  activity: string;
  start_time: string;
  end_time: string;
  cost: number;
  rating?: number | null;
  notes?: string | null;
  location?: string | null;
}

export interface DayPlan {
  date: string;
  city: string;
  activities: Activity[];
}

export interface ItineraryResponse {
  itinerary_id: string;
  trip_summary: TripSummary;
  budget_breakdown: BudgetBreakdown;
  days: DayPlan[];
  total_cost: number;
  created_at: string;
}

// Same shape as an Activity's replaceable fields (everything except the
// schedule/id fields, which stay fixed when a user swaps the place) — used
// both for each entry in the alternatives list and as the PATCH body.
export interface ActivityAlternative {
  name: string;
  activity: string;
  location?: string | null;
  cost: number;
  rating?: number | null;
  notes?: string | null;
}

export interface ActivityAlternativesResponse {
  alternatives: ActivityAlternative[];
}
