using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;

namespace IAM.Infrastructure.Data;

public static class SeedData
{
    public static void Initialize(IAMDbContext context, BCryptPassworkHasher hasher)
    {
        context.Database.EnsureCreated();

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