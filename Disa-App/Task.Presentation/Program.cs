using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Task.Application.Interfaces.Services;
using Task.Application.Services;
using Task.Infrastructure;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.PartnerVouchers;
using Task.Presentation.Controllers;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddInfrastructure(builder.Configuration);

// Register Application Services
builder.Services.AddScoped<IMissionTemplateService, MissionTemplateService>();
builder.Services.AddScoped<IUserMissionService, UserMissionService>();
builder.Services.AddScoped<IMissionSubmissionService, MissionSubmissionService>();
builder.Services.AddScoped<IVoucherService, VoucherService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<PartnerVoucherService>();
builder.Services.AddScoped<Oc3IamAccess>();
builder.Services.AddScoped<global::Task.Presentation.MissionTripGuard>();
builder.Services.AddScoped<global::Task.Presentation.PartnerTripOfferMatcher>();
builder.Services.AddHttpClient("Oc3Iam", c => c.Timeout = TimeSpan.FromSeconds(8));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        if (!context.Request.Path.StartsWithSegments("/api/v2")) return RateLimitPartition.GetNoLimiter("legacy");
        var identity = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var path = context.Request.Path.Value ?? "";
        var group = path.Contains("presentations") ? "present" : path.Contains("verifications") ? "verify" : HttpMethods.IsGet(context.Request.Method) ? "read" : "write";
        return RateLimitPartition.GetFixedWindowLimiter(identity + ":" + group, _ => new FixedWindowRateLimiterOptions { PermitLimit = group == "present" ? 6 : group == "verify" ? 20 : group == "read" ? 120 : 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
    });
});

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
app.UseStaticFiles();

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
app.UseRateLimiter();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    var protectedLegacy = path.StartsWithSegments("/api/user-missions") || path.StartsWithSegments("/api/mission-submissions") || path.StartsWithSegments("/api/mission-reviews") || path.StartsWithSegments("/api/vouchers");
    if (protectedLegacy && context.User.Identity?.IsAuthenticated == true && app.Configuration.GetValue<bool>("PartnerVouchers:Enabled"))
    {
        try { await context.RequestServices.GetRequiredService<Oc3IamAccess>().Check(context); }
        catch (VoucherError e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { code = e.Code, message = e.Message }); return; }
        catch (Exception e) when (e is HttpRequestException or OperationCanceledException) { context.Response.StatusCode = 503; await context.Response.WriteAsJsonAsync(new { code = "IAM_UNAVAILABLE" }); return; }
    }
    await next();
});

app.Use(async (context, next) =>
{
    if (!context.Request.Path.StartsWithSegments("/api/v2")) { await next(); return; }
    if (!app.Configuration.GetValue<bool>("PartnerVouchers:Enabled"))
    { context.Response.StatusCode = 503; await context.Response.WriteAsJsonAsync(new { code = "PARTNER_VOUCHERS_DISABLED", message = "Ưu đãi đối tác chưa được bật trên máy chủ." }); return; }
    try { await next(); }
    catch (VoucherError ex)
    { context.Response.StatusCode = ex.Status; await context.Response.WriteAsJsonAsync(new { code = ex.Code, message = ex.Message, requestId = context.TraceIdentifier, retryable = false }); }
    catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or Microsoft.EntityFrameworkCore.DbUpdateException or Microsoft.Data.SqlClient.SqlException)
    { context.Response.StatusCode = 503; await context.Response.WriteAsJsonAsync(new { code = "SERVICE_UNAVAILABLE", message = "Chưa thể xử lý. Hãy kiểm tra lại kết quả trước khi thử lại.", requestId = context.TraceIdentifier, retryable = true }); }
});

app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/health/ready", async (TaskDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));

app.MapControllers();

app.Run();
