using System;
using System.Threading;
using System.Threading.Tasks;
using AITour.Application.Interfaces;
using AITour.Infrastructure.ExternalServices.AIItinerary;
using AITour.Infrastructure.ExternalServices.AIItinerary.Models;
using Microsoft.Extensions.Logging;

namespace AITour.Application.Services;

/// <summary>
/// Application service that delegates itinerary operations to AIItineraryClient.
/// This class is the bridge between the Presentation layer and the Infrastructure layer.
/// </summary>
public class AITourService : IAIItineraryService
{
    private readonly AIItineraryClient _client;
    private readonly ILogger<AITourService> _logger;

    public AITourService(AIItineraryClient client, ILogger<AITourService> logger)
    {
        _client = client;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<ItineraryResponse?> GenerateAsync(
        GenerateItineraryRequest request,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "AITourService: GenerateAsync called for cities={Cities}",
            string.Join(", ", request.Cities));

        return await _client.GenerateItineraryAsync(request, bearerToken, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<ItineraryResponse?> GetByIdAsync(
        Guid itineraryId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("AITourService: GetByIdAsync called for id={Id}", itineraryId);
        return await _client.GetItineraryAsync(itineraryId, bearerToken, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> DeleteAsync(
        Guid itineraryId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("AITourService: DeleteAsync called for id={Id}", itineraryId);
        return await _client.DeleteItineraryAsync(itineraryId, bearerToken, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<ActivityAlternativesResponse?> GetActivityAlternativesAsync(
        Guid itineraryId,
        string activityId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "AITourService: GetActivityAlternativesAsync called for id={Id}, activityId={ActivityId}",
            itineraryId, activityId);
        return await _client.GetActivityAlternativesAsync(itineraryId, activityId, bearerToken, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<ItineraryResponse?> ReplaceActivityAsync(
        Guid itineraryId,
        string activityId,
        ActivityAlternative request,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "AITourService: ReplaceActivityAsync called for id={Id}, activityId={ActivityId}",
            itineraryId, activityId);
        return await _client.ReplaceActivityAsync(itineraryId, activityId, request, bearerToken, cancellationToken);
    }
}
