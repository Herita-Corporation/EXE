using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AITour.Presentation.Controllers;
[ApiController, Authorize, Route("api/v1/itinerary")]
public class TripLifecycleController(IHttpClientFactory clients, IConfiguration configuration) : ControllerBase
{
    async Task<IActionResult> Forward(string suffix, HttpMethod method, JsonElement? body = null)
    {
        var baseUrl = configuration["AIItinerary:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl)) return StatusCode(503);
        using var request = new HttpRequestMessage(method, baseUrl.TrimEnd('/') + "/api/v1/itinerary" + suffix);
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(Request.Headers.Authorization.ToString());
        if (body.HasValue) request.Content = new StringContent(body.Value.GetRawText(), Encoding.UTF8, "application/json");
        try
        {
            using var response = await clients.CreateClient("TripLifecycle").SendAsync(request, HttpContext.RequestAborted);
            var text = await response.Content.ReadAsStringAsync();
            if ((int)response.StatusCode >= 500) return StatusCode(503, new { code = "SERVICE_UNAVAILABLE", message = "Trip service unavailable." });
            return new ContentResult { StatusCode = (int)response.StatusCode, Content = text, ContentType = "application/json" };
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException) { return StatusCode(503, new { code = "SERVICE_UNAVAILABLE" }); }
    }
    [HttpGet] public Task<IActionResult> List() => Forward("?limit=50", HttpMethod.Get);
    [HttpPost("{id:guid}/lifecycle")] public Task<IActionResult> Lifecycle(Guid id, JsonElement body) => Forward($"/{id}/lifecycle", HttpMethod.Post, body);
    [HttpPost("{id:guid}/expenses")] public Task<IActionResult> Expense(Guid id, JsonElement body) => Forward($"/{id}/expenses", HttpMethod.Post, body);
    [HttpGet("{id:guid}/summary")] public Task<IActionResult> Summary(Guid id) => Forward($"/{id}/summary", HttpMethod.Get);
}
