using System.Net.Http.Headers;
using System.Text.Json;
using Task.Application.DTOs.Requests;
using Task.Infrastructure.PartnerVouchers;

namespace Task.Presentation;
public class MissionTripGuard(IHttpClientFactory clients, IConfiguration config)
{
    public async System.Threading.Tasks.Task Validate(HttpContext context, Guid tripId, Guid activityId, AssignMissionRequest? assign = null, bool submitting = false)
    {
        var baseUrl = config["MissionValidation:AiTourBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl)) throw new VoucherError("TRIP_VALIDATOR_UNAVAILABLE", "Chưa cấu hình máy chủ xác minh nhiệm vụ.", 503);
        using var req = new HttpRequestMessage(HttpMethod.Get, baseUrl.TrimEnd('/') + $"/api/v1/itinerary/{tripId}");
        req.Headers.Authorization = AuthenticationHeaderValue.Parse(context.Request.Headers.Authorization.ToString());
        using var response = await clients.CreateClient("Oc3Iam").SendAsync(req, context.RequestAborted);
        if (!response.IsSuccessStatusCode) throw new VoucherError("TRIP_NOT_ACCESSIBLE", "Không thể xác minh lịch trình thuộc tài khoản.", (int)response.StatusCode >= 500 ? 503 : 403);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); var root = document.RootElement;
        if (root.TryGetProperty("lifecycle", out var lifecycle) && lifecycle.TryGetProperty("status", out var status) && status.GetString() is "COMPLETED" or "CANCELLED") throw new VoucherError("TRIP_ENDED", "Chuyến đi đã kết thúc.");
        foreach (var day in root.GetProperty("days").EnumerateArray())
        foreach (var activity in day.GetProperty("activities").EnumerateArray())
        {
            if (!Guid.TryParse(activity.GetProperty("activity_id").GetString(), out var id) || id != activityId) continue;
            var localDate = DateOnly.Parse(day.GetProperty("date").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
            if (localDate < today || (submitting && localDate != today)) throw new VoucherError("MISSION_OUTSIDE_TRIP_WINDOW", "Nhiệm vụ không thuộc ngày đi hiện tại.");
            if (!activity.TryGetProperty("coordinates", out var coords) || coords.ValueKind != JsonValueKind.Object) throw new VoucherError("LOCATION_UNVERIFIED", "Địa điểm chưa xác minh được GPS.");
            var lat = coords.GetProperty("lat").GetDouble(); var lng = coords.GetProperty("lng").GetDouble();
            if (assign != null) { assign.TargetLatitude = lat; assign.TargetLongitude = lng; assign.Title = activity.GetProperty("name").GetString(); }
            return;
        }
        throw new VoucherError("ACTIVITY_NOT_FOUND", "Địa điểm không thuộc lịch trình.", 404);
    }
}
