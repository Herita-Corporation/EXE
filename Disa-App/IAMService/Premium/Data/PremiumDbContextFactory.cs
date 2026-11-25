
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace IAMService.Premium.Data
{
    public class PremiumDbContextFactory
        : IDesignTimeDbContextFactory<PremiumDbContext>
    {
        public PremiumDbContext CreateDbContext(string[] args)
        {
            var currentDirectory = Directory.GetCurrentDirectory();

            // EF có thể chạy tại thư mục gốc hoặc IAMService.
            var basePath = File.Exists(
                Path.Combine(currentDirectory, "appsettings.json"))
                ? currentDirectory
                : Path.Combine(currentDirectory, "IAMService");

            if (!File.Exists(
                Path.Combine(basePath, "appsettings.json")))
            {
                throw new FileNotFoundException(
                    $"Không tìm thấy appsettings.json tại {basePath}");
            }

            var environment =
                Environment.GetEnvironmentVariable(
                    "ASPNETCORE_ENVIRONMENT") ?? "Development";

            var configuration = new ConfigurationBuilder()
                .SetBasePath(basePath)
                .AddJsonFile("appsettings.json")
                .AddJsonFile(
                    $"appsettings.{environment}.json",
                    optional: true)
                .AddEnvironmentVariables()
                .Build();

            var connectionString =
                configuration.GetConnectionString("IAMDb");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "Không tìm thấy ConnectionStrings:IAMDb");
            }

            var optionsBuilder =
                new DbContextOptionsBuilder<PremiumDbContext>();

            optionsBuilder.UseSqlServer(
                connectionString,
                options => options.MigrationsHistoryTable(
                    "__PremiumMigrationsHistory"));

            return new PremiumDbContext(optionsBuilder.Options);
        }
    }
}
