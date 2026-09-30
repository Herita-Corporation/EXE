using AITour.Infrastructure.ExternalServices.AIItinerary;
using AITour.Infrastructure.ExternalServices.Translation;
using AITour.Infrastructure.ExternalServices.Translation.Models;
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

    /// <summary>
    /// Registers the BahnarTranslatorClient (Bahnar → Vietnamese translation service).
    ///
    /// Unlike AIItinerary, a missing BaseUrl does NOT fail startup: the translator is an
    /// optional, heavy service (~5 GB RAM) that may run on another host or not at all —
    /// the /api/v1/translate/* endpoints then answer 503 while everything else keeps working.
    /// <code>
    /// {
    ///   "Translator": {
    ///     "BaseUrl": "http://localhost:8080",
    ///     "ApiKey": "",            // secret: set via env Translator__ApiKey
    ///     "TimeoutSeconds": 90
    ///   }
    /// }
    /// </code>
    /// </summary>
    public static IServiceCollection AddBahnarTranslatorClient(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = new TranslatorOptions
        {
            BaseUrl = configuration["Translator:BaseUrl"] ?? "",
            ApiKey = configuration["Translator:ApiKey"] ?? "",
            TimeoutSeconds = configuration.GetValue<int>("Translator:TimeoutSeconds", 90),
        };
        services.AddSingleton(options);

        services.AddHttpClient<BahnarTranslatorClient>(client =>
        {
            if (options.IsConfigured)
                client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/'));
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        });

        return services;
    }
}
