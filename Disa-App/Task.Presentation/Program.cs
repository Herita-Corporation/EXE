using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Task.Application.Interfaces.Services;
using Task.Application.Services;
using Task.Infrastructure;
using Task.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddInfrastructure(builder.Configuration);

// Register Application Services
builder.Services.AddScoped<IMissionTemplateService, MissionTemplateService>();
builder.Services.AddScoped<IMissionTemplateService, MissionTemplateService>();
builder.Services.AddScoped<IUserMissionService, UserMissionService>();
builder.Services.AddScoped<IMissionSubmissionService, MissionSubmissionService>();
builder.Services.AddScoped<IVoucherService, VoucherService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// JWT Authentication — same settings as IAMService/AITour.Presentation, used
// only to gate Admin-role voucher CRUD (every other Task.Presentation route
// stays open, matching this service's existing no-auth convention).
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

var app = builder.Build();

// Demo voucher catalog ships with the service — inserted once if missing.
// Never blocks startup (e.g. the database isn't reachable yet).
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<TaskDbContext>();
        var seeded = await DemoVoucherSeeder.SeedAsync(db);
        if (seeded > 0) app.Logger.LogInformation("Seeded {Count} demo voucher(s).", seeded);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Demo voucher seeding skipped.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Serves mission-evidence photos/videos saved by FileStorageService
// (Uploads/Images, Uploads/Videos) at http://.../uploads/... — the folder is
// also volume-mounted in docker-compose.yml so files survive a restart.
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "Uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();