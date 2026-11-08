using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using IAM.Infrastructure.Data.Entities;

public class Oc3IamDesignTimeFactory : IDesignTimeDbContextFactory<IAMDbContext>
{
    public IAMDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<IAMDbContext>()
        .UseSqlServer("Server=localhost;Database=DisaMigrationDesignOnly;Integrated Security=true;TrustServerCertificate=true").Options);
}
