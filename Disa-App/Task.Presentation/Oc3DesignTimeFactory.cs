using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Task.Infrastructure.Persistence;

public class Oc3TaskDesignTimeFactory : IDesignTimeDbContextFactory<TaskDbContext>
{
    public TaskDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<TaskDbContext>()
        .UseSqlServer("Server=localhost;Database=DisaMigrationDesignOnly;Integrated Security=true;TrustServerCertificate=true").Options);
}
