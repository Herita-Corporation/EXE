using System.Net.Http.Json;
using System.Text;
using IAM.Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Services;

// Durable outbox: sending may repeat, receiver accepts only increasing versions.
public class PartnerPublicationWorker(IServiceScopeFactory scopes, IHttpClientFactory clients, IConfiguration config, ILogger<PartnerPublicationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (config.GetValue<bool>("PartnerVouchers:Enabled"))
                {
                    using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<IAMDbContext>();
                    var events = await db.Set<PartnerPublication>().Where(e => e.ProcessedAt == null).OrderBy(e => e.CreatedAt).Take(20).ToListAsync(stoppingToken);
                    var url = config["PartnerVouchers:TaskBaseUrl"]; var key = config["PartnerVouchers:SyncKey"];
                    if (!string.IsNullOrWhiteSpace(url) && !string.IsNullOrWhiteSpace(key))
                    foreach (var e in events)
                    {
                        using var request = new HttpRequestMessage(HttpMethod.Post, url.TrimEnd('/') + "/api/v2/internal/locations");
                        request.Headers.Add("X-Disa-Sync-Key", key); request.Content = new StringContent(e.PayloadJson, Encoding.UTF8, "application/json");
                        using var response = await clients.CreateClient("Oc3Sync").SendAsync(request, stoppingToken);
                        e.Attempts++; if (response.IsSuccessStatusCode) e.ProcessedAt = DateTime.UtcNow;
                        await db.SaveChangesAsync(stoppingToken);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Partner publish retry pending ({ErrorType})", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
