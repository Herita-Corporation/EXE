using AITour.Infrastructure.ExternalServices.AIItinerary;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AITour.Infrastructure.DependencyInjection;

/// <summary>
/// Extension methods to register AITour.Infrastructure services in DI container.
/// </summary>
public static class ServiceExtensions
{
    /// <summary>
    /// Registers the AIItineraryClient as a typed HttpClient.
    /// 
    /// Configuration expected in appsettings.json:
    /// <code>
    /// {
    ///   "AIItinerary": {
    ///     "BaseUrl": "http://localhost:8000",
    ///     "TimeoutSeconds": 120
    ///   }
    /// }
    /// </code>
    /// </summary>
    public static IServiceCollection AddAIItineraryClient(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var baseUrl = configuration["AIItinerary:BaseUrl"]
            ?? throw new InvalidOperationException(
                "AIItinerary:BaseUrl is not configured in appsettings.json.");

        var timeoutSeconds = configuration.GetValue<int>("AIItinerary:TimeoutSeconds", 120);

        services.AddHttpClient<AIItineraryClient>(client =>
        {
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        });

        return services;
    }
}
