using System;
using System.Threading;
using System.Threading.Tasks;
using AITour.Infrastructure.ExternalServices.AIItinerary.Models;

namespace AITour.Application.Interfaces;

/// <summary>
/// Abstraction for AI-Itinerary external service.
/// Implemented by AITour.Infrastructure, consumed by controllers.
/// </summary>
public interface IAIItineraryService
{
    /// <summary>
    /// Generates a new travel itinerary by delegating to the AI-Itinerary microservice.
    /// </summary>
    /// <param name="request">Trip parameters (cities, budget, dates, preferences).</param>
    /// <param name="bearerToken">JWT Bearer token from the original HTTP request. 
    /// Forwarded to AI-Itinerary so it can extract user_id from claims.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<ItineraryResponse?> GenerateAsync(
        GenerateItineraryRequest request,
        string bearerToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a previously generated itinerary by its ID.
    /// </summary>
    Task<ItineraryResponse?> GetByIdAsync(
        Guid itineraryId,
        string bearerToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a generated itinerary by its ID.
    /// </summary>
    Task<bool> DeleteAsync(
        Guid itineraryId,
        string bearerToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets AI-suggested alternative places for one activity slot, so the
    /// user can swap it for a better fit.
    /// </summary>
    Task<ActivityAlternativesResponse?> GetActivityAlternativesAsync(
        Guid itineraryId,
        string activityId,
        string bearerToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces one activity's place with a chosen alternative and returns
    /// the updated itinerary.
    /// </summary>
    Task<ItineraryResponse?> ReplaceActivityAsync(
        Guid itineraryId,
        string activityId,
        ActivityAlternative request,
        string bearerToken,
        CancellationToken cancellationToken = default);
}
