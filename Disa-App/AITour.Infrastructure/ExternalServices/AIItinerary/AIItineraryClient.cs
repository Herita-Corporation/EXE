using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AITour.Infrastructure.ExternalServices.AIItinerary.Models;
using Microsoft.Extensions.Logging;

namespace AITour.Infrastructure.ExternalServices.AIItinerary;

/// <summary>
/// HTTP client that communicates with the AI-Itinerary Python microservice.
/// 
/// Authentication strategy:
/// - Forwards the caller's Bearer JWT token so AI-Itinerary can extract user_id from claims.
/// - The JWT is issued by IAMService and both services share the same signing key.
/// </summary>
public class AIItineraryClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AIItineraryClient> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public AIItineraryClient(HttpClient httpClient, ILogger<AIItineraryClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    // ── Helper: set Authorization header per-call ─────────────────────────────

    private void SetBearerToken(string? bearerToken)
    {
        _httpClient.DefaultRequestHeaders.Authorization = bearerToken is not null
            ? new AuthenticationHeaderValue("Bearer", bearerToken)
            : null;
    }

    // ── Generate Itinerary ────────────────────────────────────────────────────

    /// <summary>
    /// Calls POST /api/v1/itinerary/generate on AI-Itinerary.
    /// The JWT token is forwarded so AI-Itinerary can extract user_id from claims.
    /// </summary>
    public async Task<ItineraryResponse?> GenerateItineraryAsync(
        GenerateItineraryRequest request,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        SetBearerToken(bearerToken);

        _logger.LogInformation(
            "Calling AI-Itinerary generate: cities={Cities}, budget={Budget}",
            string.Join(", ", request.Cities), request.Budget);

        var response = await _httpClient.PostAsJsonAsync(
            "/api/v1/itinerary/generate",
            request,
            _jsonOptions,
            cancellationToken);

        return await HandleResponseAsync<ItineraryResponse>(response, "GenerateItinerary", cancellationToken);
    }

    // ── Get Itinerary ─────────────────────────────────────────────────────────

    /// <summary>
    /// Calls GET /api/v1/itinerary/{id} on AI-Itinerary.
    /// </summary>
    public async Task<ItineraryResponse?> GetItineraryAsync(
        Guid itineraryId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        SetBearerToken(bearerToken);

        _logger.LogInformation("Calling AI-Itinerary get: id={Id}", itineraryId);

        var response = await _httpClient.GetAsync(
            $"/api/v1/itinerary/{itineraryId}",
            cancellationToken);

        return await HandleResponseAsync<ItineraryResponse>(response, "GetItinerary", cancellationToken);
    }

    // ── Delete Itinerary ──────────────────────────────────────────────────────

    /// <summary>
    /// Calls DELETE /api/v1/itinerary/{id} on AI-Itinerary.
    /// </summary>
    public async Task<bool> DeleteItineraryAsync(
        Guid itineraryId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        SetBearerToken(bearerToken);

        _logger.LogInformation("Calling AI-Itinerary delete: id={Id}", itineraryId);

        var response = await _httpClient.DeleteAsync(
            $"/api/v1/itinerary/{itineraryId}",
            cancellationToken);

        var result = await HandleResponseAsync<DeleteItineraryResponse>(response, "DeleteItinerary", cancellationToken);
        return result?.Success ?? false;
    }

    // ── Activity Alternatives ("edit this place" feature) ────────────────────

    /// <summary>
    /// Calls GET /api/v1/itinerary/{id}/activities/{activityId}/alternatives.
    /// </summary>
    public async Task<ActivityAlternativesResponse?> GetActivityAlternativesAsync(
        Guid itineraryId,
        string activityId,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        SetBearerToken(bearerToken);

        _logger.LogInformation(
            "Calling AI-Itinerary alternatives: id={Id}, activityId={ActivityId}",
            itineraryId, activityId);

        var response = await _httpClient.GetAsync(
            $"/api/v1/itinerary/{itineraryId}/activities/{activityId}/alternatives",
            cancellationToken);

        return await HandleResponseAsync<ActivityAlternativesResponse>(
            response, "GetActivityAlternatives", cancellationToken);
    }

    /// <summary>
    /// Calls PATCH /api/v1/itinerary/{id}/activities/{activityId}.
    /// </summary>
    public async Task<ItineraryResponse?> ReplaceActivityAsync(
        Guid itineraryId,
        string activityId,
        ActivityAlternative request,
        string bearerToken,
        CancellationToken cancellationToken = default)
    {
        SetBearerToken(bearerToken);

        _logger.LogInformation(
            "Calling AI-Itinerary replace activity: id={Id}, activityId={ActivityId}",
            itineraryId, activityId);

        var json = JsonSerializer.Serialize(request, _jsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var httpRequest = new HttpRequestMessage(HttpMethod.Patch,
            $"/api/v1/itinerary/{itineraryId}/activities/{activityId}")
        {
            Content = content,
        };

        var response = await _httpClient.SendAsync(httpRequest, cancellationToken);

        return await HandleResponseAsync<ItineraryResponse>(response, "ReplaceActivity", cancellationToken);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private async Task<T?> HandleResponseAsync<T>(
        HttpResponseMessage response,
        string operation,
        CancellationToken cancellationToken)
    {
        var content = await response.Content.ReadAsStringAsync(cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            return JsonSerializer.Deserialize<T>(content, _jsonOptions);
        }

        // Try to deserialize error response
        AIItineraryErrorResponse? error = null;
        try
        {
            error = JsonSerializer.Deserialize<AIItineraryErrorResponse>(content, _jsonOptions);
        }
        catch { /* ignore deserialization errors */ }

        var errorMessage = error?.Message ?? content;
        var errorCode = error?.ErrorCode ?? "UNKNOWN";

        _logger.LogError(
            "AI-Itinerary {Operation} failed: status={Status}, code={Code}, message={Message}",
            operation, (int)response.StatusCode, errorCode, errorMessage);

        throw response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => new UnauthorizedAccessException(
                $"AI-Itinerary: {errorMessage}"),
            HttpStatusCode.NotFound => new KeyNotFoundException(
                $"AI-Itinerary: {errorMessage}"),
            HttpStatusCode.TooManyRequests => new InvalidOperationException(
                $"AI-Itinerary rate limit exceeded: {errorMessage}"),
            _ => new HttpRequestException(
                $"AI-Itinerary {operation} error [{errorCode}]: {errorMessage}",
                null,
                response.StatusCode)
        };
    }
}
