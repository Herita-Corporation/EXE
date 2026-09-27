using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AITour.Infrastructure.ExternalServices.AIItinerary.Models;

// ── Request ───────────────────────────────────────────────────────────────────

/// <summary>
/// Request payload sent to AI-Itinerary POST /api/v1/itinerary/generate.
/// user_id is NOT included — it is extracted from the JWT token server-side.
/// </summary>
public class GenerateItineraryRequest
{
    [JsonPropertyName("cities")]
    public List<string> Cities { get; set; } = new();

    [JsonPropertyName("budget")]
    public decimal Budget { get; set; }

    [JsonPropertyName("start_date")]
    public string StartDate { get; set; } = string.Empty; // "YYYY-MM-DD"

    [JsonPropertyName("end_date")]
    public string EndDate { get; set; } = string.Empty;   // "YYYY-MM-DD"

    [JsonPropertyName("preferences")]
    public List<string> Preferences { get; set; } = new();
}

// ── Response ──────────────────────────────────────────────────────────────────

public class ItineraryResponse
{
    [JsonPropertyName("itinerary_id")]
    public Guid ItineraryId { get; set; }

    [JsonPropertyName("trip_summary")]
    public TripSummary? TripSummary { get; set; }

    [JsonPropertyName("budget_breakdown")]
    public BudgetBreakdown? BudgetBreakdown { get; set; }

    [JsonPropertyName("days")]
    public List<DayPlan> Days { get; set; } = new();

    [JsonPropertyName("total_cost")]
    public decimal TotalCost { get; set; }

    [JsonPropertyName("created_at")]
    public string CreatedAt { get; set; } = string.Empty;
}

public class TripSummary
{
    [JsonPropertyName("start_date")]
    public string StartDate { get; set; } = string.Empty;

    [JsonPropertyName("end_date")]
    public string EndDate { get; set; } = string.Empty;

    [JsonPropertyName("cities")]
    public List<string> Cities { get; set; } = new();

    [JsonPropertyName("budget")]
    public decimal Budget { get; set; }

    [JsonPropertyName("planning_budget")]
    public decimal PlanningBudget { get; set; }

    [JsonPropertyName("reserve_budget")]
    public decimal ReserveBudget { get; set; }

    [JsonPropertyName("trip_duration_days")]
    public int TripDurationDays { get; set; }
}

public class BudgetBreakdown
{
    [JsonPropertyName("accommodation")]
    public decimal Accommodation { get; set; }

    [JsonPropertyName("food")]
    public decimal Food { get; set; }

    [JsonPropertyName("attractions")]
    public decimal Attractions { get; set; }

    [JsonPropertyName("transportation")]
    public decimal Transportation { get; set; }

    [JsonPropertyName("miscellaneous")]
    public decimal Miscellaneous { get; set; }
}

public class DayPlan
{
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;

    [JsonPropertyName("city")]
    public string City { get; set; } = string.Empty;

    [JsonPropertyName("activities")]
    public List<Activity> Activities { get; set; } = new();
}

public class Activity
{
    /// <summary>Stable per-activity ID (GUID) — used to target a mission at this activity.</summary>
    [JsonPropertyName("activity_id")]
    public string ActivityId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    // AI-Itinerary sends this as "activity" (human-readable description of
    // what to do there), not "description" — matches app/schemas/itinerary.py.
    [JsonPropertyName("activity")]
    public string ActivityLabel { get; set; } = string.Empty;

    [JsonPropertyName("start_time")]
    public string StartTime { get; set; } = string.Empty;

    [JsonPropertyName("end_time")]
    public string EndTime { get; set; } = string.Empty;

    [JsonPropertyName("cost")]
    public decimal Cost { get; set; }

    [JsonPropertyName("location")]
    public string? Location { get; set; }

    [JsonPropertyName("rating")]
    public decimal? Rating { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}

// ── Activity Alternatives ("edit this place" feature) ────────────────────────

/// <summary>
/// One AI-suggested alternative place for an activity slot — same shape used
/// both in the GET .../alternatives response list and as the PATCH request
/// body when the user picks one.
/// </summary>
public class ActivityAlternative
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("activity")]
    public string Activity { get; set; } = string.Empty;

    [JsonPropertyName("location")]
    public string? Location { get; set; }

    [JsonPropertyName("cost")]
    public decimal Cost { get; set; }

    [JsonPropertyName("rating")]
    public decimal? Rating { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}

public class ActivityAlternativesResponse
{
    [JsonPropertyName("alternatives")]
    public List<ActivityAlternative> Alternatives { get; set; } = new();
}

// ── Error Response ────────────────────────────────────────────────────────────

public class AIItineraryErrorResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("error_code")]
    public string ErrorCode { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}

// ── Delete Response ───────────────────────────────────────────────────────────

public class DeleteItineraryResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }
}
