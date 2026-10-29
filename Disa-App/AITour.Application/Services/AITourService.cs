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
        if (!DateOnly.TryParse(request.StartDate, out var startDate) ||
            !DateOnly.TryParse(request.EndDate, out var endDate))
        {
            throw new ArgumentException("Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.");
        }

        // DISA currently serves Vietnam, so validate against the local
        // calendar day even when the service itself runs in UTC.
        var vietnamNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
        var vietnamToday = DateOnly.FromDateTime(vietnamNow.DateTime);
        if (startDate < vietnamToday || endDate < vietnamToday)
            throw new ArgumentException("Không thể tạo lịch trình trong quá khứ.");
        if (startDate == vietnamToday && vietnamNow.Hour >= 18)
            throw new ArgumentException(
                "Sau 18:00, ngày bắt đầu sớm nhất là ngày mai.");
        if (startDate > endDate)
            throw new ArgumentException("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
        if (endDate.DayNumber - startDate.DayNumber + 1 > 5)
            throw new ArgumentException("Lịch trình không được vượt quá 5 ngày.");
        if (request.Travelers < 1 || request.Travelers > 10)
            throw new ArgumentException("Số người du lịch phải từ 1 đến 10.");

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

    public async Task<bool> DeleteAllUserDataAsync(
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("AITourService: deleting all itinerary data for authenticated user");
        return await _client.DeleteAllUserDataAsync(bearerToken, cancellationToken);
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

    public async Task<LocationCoords?> ResolveActivityCoordinatesAsync(
        Guid itineraryId,
        string activityId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        return await _client.ResolveActivityCoordinatesAsync(
            itineraryId, activityId, bearerToken, cancellationToken);
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
