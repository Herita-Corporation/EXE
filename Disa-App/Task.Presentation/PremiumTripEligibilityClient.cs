using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Task.Infrastructure.Premium;

namespace Task.Presentation;

public sealed record PremiumTripEligibility(bool Eligible, Guid? ItineraryId, string? Message);

/// <summary>
/// Task Service verifies eligibility against the authenticated user's own
/// itinerary list. The client never supplies a trip ID as proof.
/// </summary>
public sealed class PremiumTripEligibilityClient(IHttpClientFactory clients, IConfiguration config)
{
    public async global::System.Threading.Tasks.Task<PremiumTripEligibility> Check(HttpContext context, PremiumProvince area)
    {
        var baseUrl = config["Premium:AiTourBaseUrl"] ?? config["MissionValidation:AiTourBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new PremiumApiException(503, "Chưa cấu hình máy chủ xác minh hành trình.", "PREMIUM_TRIP_VALIDATOR_UNAVAILABLE");

        using var request = new HttpRequestMessage(HttpMethod.Get, baseUrl.TrimEnd('/') + "/api/v1/itinerary");
        var raw = context.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(raw)) request.Headers.Authorization = AuthenticationHeaderValue.Parse(raw);
        using var response = await clients.CreateClient("PremiumTripEligibility").SendAsync(request, context.RequestAborted);
        if (!response.IsSuccessStatusCode)
            throw new PremiumApiException(503, "Không thể xác minh hành trình đang diễn ra.", "PREMIUM_TRIP_VALIDATOR_UNAVAILABLE");

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(context.RequestAborted));
        if (document.RootElement.ValueKind != JsonValueKind.Array)
            throw new PremiumApiException(503, "Dữ liệu hành trình không hợp lệ.", "PREMIUM_TRIP_VALIDATOR_UNAVAILABLE");

        foreach (var trip in document.RootElement.EnumerateArray())
        {
            var lifecycle = trip.TryGetProperty("lifecycle", out var state) && state.ValueKind == JsonValueKind.Object
                && state.TryGetProperty("status", out var status) ? status.GetString() : null;
            var displayGroup = trip.TryGetProperty("display_group", out var group) ? group.GetString() : null;
            // IN_PROGRESS is the persisted lifecycle state; display_group also
            // guarantees the schedule is currently within its date window.
            if (!string.Equals(lifecycle, "IN_PROGRESS", StringComparison.Ordinal) || !string.Equals(displayGroup, "ONGOING", StringComparison.Ordinal)) continue;
            if (!MatchesArea(trip, area)) continue;
            var id = trip.TryGetProperty("itinerary_id", out var itinerary) && Guid.TryParse(itinerary.GetString(), out var parsed) ? parsed : (Guid?)null;
            return new PremiumTripEligibility(true, id, null);
        }
        return new PremiumTripEligibility(false, null, "Bạn cần có hành trình đang diễn ra tại khu vực này trước khi nhận nhiệm vụ.");
    }

    private static bool MatchesArea(JsonElement trip, PremiumProvince area)
    {
        var candidates = area.Aliases.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Append(area.Name).Select(Normalize).ToArray();
        var places = new List<string>();
        if (trip.TryGetProperty("trip_summary", out var summary) && summary.TryGetProperty("cities", out var cities) && cities.ValueKind == JsonValueKind.Array)
            places.AddRange(cities.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString() ?? ""));
        if (trip.TryGetProperty("days", out var days) && days.ValueKind == JsonValueKind.Array)
            places.AddRange(days.EnumerateArray().Where(x => x.TryGetProperty("city", out _)).Select(x => x.GetProperty("city").GetString() ?? ""));
        return places.Select(Normalize).Any(place => candidates.Any(candidate => place.Contains(candidate, StringComparison.Ordinal) || candidate.Contains(place, StringComparison.Ordinal)));
    }

    private static string Normalize(string value)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        return new string(decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c)).ToArray()).ToUpperInvariant();
    }
}
