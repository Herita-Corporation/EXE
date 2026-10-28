using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace IAM.Infrastructure.Data;

public static class SeedData
{
    public static void Initialize(IAMDbContext context, BCryptPassworkHasher hasher)
    {
        context.Database.EnsureCreated();

        // EnsureCreated only creates a brand-new schema. Keep this repair
        // idempotent so databases created before Google Login receive the new
        // nullable column and its filtered unique index during startup.
        context.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'dbo.Users', N'GoogleId') IS NULL
            BEGIN
                EXEC(N'ALTER TABLE dbo.Users ADD GoogleId NVARCHAR(255) NULL;');
            END;

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N'dbo.Users')
                  AND name = N'IX_Users_GoogleId'
            )
            BEGIN
                EXEC(N'CREATE UNIQUE INDEX IX_Users_GoogleId
                    ON dbo.Users (GoogleId)
                    WHERE GoogleId IS NOT NULL;');
            END;
            """);

        // ===== ROLES =====
        if (!context.Roles.Any())
        {
            var adminRole = new Role { Name = "Admin" };
            var managerRole = new Role { Name = "Manager" };
            var customerRole = new Role { Name = "Customer" };

            context.Roles.AddRange(adminRole, managerRole, customerRole);
            context.SaveChanges();
        }

        var adminRoleDb = context.Roles.First(x => x.Name == "Admin");

        // ===== USERS =====
        if (!context.Users.Any(x => x.Email == "admin@system.com"))
        {
            var admin = new User
            {
                Username = "admin",
                Email = "admin@system.com",
                PasswordHash = hasher.Hash("123456"),
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                Roles = new List<Role> { adminRoleDb }
            };

            context.Users.Add(admin);
            context.SaveChanges();
        }
    }
}
