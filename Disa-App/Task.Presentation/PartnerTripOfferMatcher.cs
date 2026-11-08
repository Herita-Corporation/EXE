using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Task.Infrastructure.PartnerVouchers;

namespace Task.Presentation;

// Offers are attached only to an already planned matching venue. This never
// inserts a sponsored detour or trusts a traveler-supplied locationId.
public class PartnerTripOfferMatcher(IHttpClientFactory clients, IConfiguration configuration, PartnerVoucherService vouchers)
{
    static string Normalize(string name) => string.Concat(name.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c))).ToUpperInvariant();
    public async System.Threading.Tasks.Task<object[]> Match(HttpContext context, Guid user, Guid tripId)
    {
        var baseUrl = configuration["MissionValidation:AiTourBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl)) throw new VoucherError("SERVICE_UNAVAILABLE", "Chưa cấu hình đọc lịch trình.", 503);
        using var request = new HttpRequestMessage(HttpMethod.Get, baseUrl.TrimEnd('/') + $"/api/v1/itinerary/{tripId}");
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(context.Request.Headers.Authorization.ToString());
        using var response = await clients.CreateClient("Oc3Iam").SendAsync(request, context.RequestAborted);
        if (!response.IsSuccessStatusCode) throw new VoucherError("TRIP_NOT_ACCESSIBLE", "Không thể xác minh lịch trình.", 403);
        using var trip = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var all = await vouchers.Offers(user, "ITINERARY", null);
        var result = new List<object>();
        foreach (var offer in all)
        {
            var card = JsonSerializer.SerializeToElement(offer, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            var offerName = Normalize(card.GetProperty("partnerName").GetString()!);
            var lat = card.GetProperty("latitude").GetDouble(); var lng = card.GetProperty("longitude").GetDouble();
            var now = DateTime.UtcNow;
            var validUntil = new[] { card.GetProperty("redeemEndsAt").GetDateTime(), now.AddDays(card.GetProperty("validDays").GetInt32()) }.Min();
            if (card.TryGetProperty("expiresAt", out var expiry) && expiry.ValueKind == JsonValueKind.String) validUntil = expiry.GetDateTime();
            foreach (var day in trip.RootElement.GetProperty("days").EnumerateArray())
            {
                var date = DateOnly.Parse(day.GetProperty("date").GetString()!, CultureInfo.InvariantCulture);
                if (date < DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7))) continue;
                if (date > DateOnly.FromDateTime(validUntil.AddHours(7))) continue;
                if (card.GetProperty("usageMode").GetString() == "RETURN_VISIT" && date == DateOnly.FromDateTime(now.AddHours(7))) continue;
                var matches = day.GetProperty("activities").EnumerateArray().Any(a => Normalize(a.GetProperty("name").GetString() ?? "") == offerName && a.TryGetProperty("coordinates", out var p) && p.ValueKind == JsonValueKind.Object && Distance(lat, lng, p.GetProperty("lat").GetDouble(), p.GetProperty("lng").GetDouble()) <= 150);
                if (matches) { result.Add(offer); break; }
            }
        }
        return result.ToArray();
    }
    static double Distance(double lat, double lng, double otherLat, double otherLng)
    {
        static double R(double value) => value * Math.PI / 180;
        var a = Math.Pow(Math.Sin(R(lat - otherLat) / 2), 2) + Math.Cos(R(lat)) * Math.Cos(R(otherLat)) * Math.Pow(Math.Sin(R(lng - otherLng) / 2), 2);
        return 6371000 * 2 * Math.Asin(Math.Sqrt(Math.Clamp(a, 0, 1)));
    }
}
