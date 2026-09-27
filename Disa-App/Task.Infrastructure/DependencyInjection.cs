using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Task.Application.Interfaces.Repositories;
using Task.Application.Interfaces.Services;
using Task.Application.Services;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.Repositories;
using Task.Infrastructure.Services;

namespace Task.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<TaskDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("TaskDb")));

        services.AddHttpContextAccessor();

        // Repository
        services.AddScoped<IMissionTemplateRepository, MissionTemplateRepository>();

        // Service
        services.AddScoped<IMissionTemplateService, MissionTemplateService>();

        services.AddScoped<IMissionTemplateRepository, MissionTemplateRepository>();
        services.AddScoped<IUserMissionRepository, UserMissionRepository>();
        services.AddScoped<IFileStorageService, FileStorageService>();
        services.AddScoped<IMissionSubmissionRepository, MissionSubmissionRepository>();
        services.AddScoped<IMissionEvidenceRepository, MissionEvidenceRepository>();
        services.AddScoped<IMissionSubmissionService, MissionSubmissionService>();
        services.AddScoped<IVoucherRepository, VoucherRepository>();
        return services;
    }
}