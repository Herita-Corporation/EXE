
using IAMService.Premium.Data;
using IAMService.Premium.Services;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Premium;

public static class PremiumRegistration
{
    public static IServiceCollection AddDisaPremium(
        this IServiceCollection services,
        IConfiguration config)
    {
        var connectionString =
            config.GetConnectionString("IAMDb")
            ?? throw new InvalidOperationException(
                "IAMDb connection string missing");

        services.AddDbContext<PremiumDbContext>(
            options =>
            {
                options.UseSqlServer(
                    connectionString,
                    sql => sql.MigrationsHistoryTable(
                        "__PremiumMigrationsHistory"));
            });

        services.AddScoped<PremiumActivationService>();

        services.AddScoped<SePayQrService>();

        // HMAC-SHA256 webhook verification.
        services.AddScoped<SePaySignatureVerifier>();

        // Existing store purchase verification.
        services.AddScoped<GooglePlayVerifier>();
        services.AddScoped<AppleStoreVerifier>();

        services.AddHttpClient();

        return services;
    }
}
