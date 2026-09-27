using System.Text;
using System.Text.Json;
using IAM.Application.Interfaces;
using IAM.Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IAM.Application.Services;

// Posts straight to Expo's public Push API (https://exp.host/--/api/v2/push/send)
// — no Firebase project or SDK needed, matches Expo's own recommended
// "just POST JSON" flow for apps that don't need advanced targeting.
public class ExpoPushNotificationService : IPushNotificationService
{
    private const string ExpoPushUrl = "https://exp.host/--/api/v2/push/send";

    private static readonly HttpClient _httpClient = new();

    private readonly IAMDbContext _context;
    private readonly ILogger<ExpoPushNotificationService> _logger;

    public ExpoPushNotificationService(IAMDbContext context, ILogger<ExpoPushNotificationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SendToAllUsersAsync(string title, string body)
    {
        try
        {
            var tokens = await _context.Users
                .Where(x => x.PushToken != null && x.PushToken != "")
                .Select(x => x.PushToken!)
                .ToListAsync();

            if (tokens.Count == 0) return;

            var messages = tokens.Select(token => new
            {
                to = token,
                title,
                body,
                sound = "default"
            });

            var payload = JsonSerializer.Serialize(messages);
            var content = new StringContent(payload, Encoding.UTF8, "application/json");

            await _httpClient.PostAsync(ExpoPushUrl, content);
        }
        catch (Exception ex)
        {
            // Never let a notification failure break the caller's own action.
            _logger.LogWarning(ex, "Failed to send Expo push notifications.");
        }
    }
}
