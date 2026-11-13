
using IAM.Application.Interfaces;
using IAM.Application.Services;
using IAM.Infrastructure.Data;
using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;

using IAMService.Services;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

using System.Text;
using System.Threading.RateLimiting;

namespace IAMService
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // ==========================================
            // 1. CONTROLLERS + SWAGGER
            // ==========================================

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();

            builder.Services.AddSwaggerGen(options =>
            {
                options.AddSecurityDefinition(
                    "Bearer",
                    new OpenApiSecurityScheme
                    {
                        Name = "Authorization",
                        Type = SecuritySchemeType.Http,
                        Scheme = "bearer",
                        BearerFormat = "JWT",
                        In = ParameterLocation.Header,
                        Description = "Enter your JWT token"
                    });

                options.AddSecurityRequirement(
                    new OpenApiSecurityRequirement
                    {
                        {
                            new OpenApiSecurityScheme
                            {
                                Reference = new OpenApiReference
                                {
                                    Type = ReferenceType.SecurityScheme,
                                    Id = "Bearer"
                                }
                            },
                            Array.Empty<string>()
                        }
                    });
            });

            // ==========================================
            // 2. DATABASE - SQL SERVER
            // ==========================================

            builder.Services.AddDbContext<IAMDbContext>(options =>
            {
                options.UseSqlServer(
                    builder.Configuration.GetConnectionString("IAMDb"));
            });

            // ==========================================
            // 3. JWT AUTHENTICATION
            // ==========================================

            var jwtKey = builder.Configuration["Jwt:Key"]
                ?? throw new InvalidOperationException(
                    "Missing required configuration: Jwt:Key");

            builder.Services
                .AddAuthentication(
                    JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters =
                        new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidateAudience = true,
                            ValidateLifetime = true,
                            ValidateIssuerSigningKey = true,

                            ValidIssuer =
                                builder.Configuration["Jwt:Issuer"],

                            ValidAudience =
                                builder.Configuration["Jwt:Audience"],

                            IssuerSigningKey =
                                new SymmetricSecurityKey(
                                    Encoding.UTF8.GetBytes(jwtKey))
                        };

                    options.Events = new JwtBearerEvents
                    {
                        OnChallenge = async context =>
                        {
                            context.HandleResponse();

                            context.Response.StatusCode = 401;
                            context.Response.ContentType =
                                "application/json";

                            await context.Response.WriteAsJsonAsync(
                                new
                                {
                                    Success = false,
                                    StatusCode = 401,
                                    Message = "Bạn chưa đăng nhập."
                                });
                        },

                        OnForbidden = async context =>
                        {
                            context.Response.StatusCode = 403;
                            context.Response.ContentType =
                                "application/json";

                            await context.Response.WriteAsJsonAsync(
                                new
                                {
                                    Success = false,
                                    StatusCode = 403,
                                    Message =
                                        "Bạn không có quyền thực hiện chức năng này."
                                });
                        }
                    };
                });

            builder.Services.AddAuthorization();
            builder.Services.AddCors(options => options.AddPolicy("DisaFrontend", policy =>
                policy.WithOrigins(builder.Configuration.GetSection("PartnerVouchers:WebOrigins").Get<string[]>() ?? new[] { "http://localhost:5173", "http://localhost:5020" })
                    .AllowAnyHeader().AllowAnyMethod()));

            // ==========================================
            // 4. IAM SERVICES
            // ==========================================

            builder.Services.AddScoped<BCryptPassworkHasher>();
            builder.Services.AddScoped<JwtTokenGenerator>();

            builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddHttpClient("Oc3Sync", c => c.Timeout = TimeSpan.FromSeconds(10));
            builder.Services.AddHostedService<IAMService.Services.PartnerPublicationWorker>();
            builder.Services.AddScoped<IFileStorageService, FileStorageService>();
            builder.Services.AddScoped<IPushNotificationService, ExpoPushNotificationService>();


            builder.Services.AddHttpContextAccessor();

            builder.Services.AddScoped<
                IFileStorageService,
                FileStorageService>();

            builder.Services.AddScoped<
                IPushNotificationService,
                ExpoPushNotificationService>();

            builder.Services.AddScoped<
                IEmailSender,
                SmtpEmailSender>();

            // ==========================================
            // 5. TWILIO SMS OTP
            // ==========================================

            builder.Services.AddScoped<TwilioOtpService>();

            // ==========================================
            // 6. OTP RATE LIMITING
            // ==========================================

            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = 429;

                options.AddFixedWindowLimiter(
                    "phone-otp",
                    limiter =>
                    {
                        limiter.PermitLimit = 3;

                        limiter.Window =
                            TimeSpan.FromMinutes(1);

                        limiter.QueueLimit = 0;

                        limiter.AutoReplenishment = true;
                    });
            });

            // ==========================================
            // 7. CORS
            // ==========================================

            builder.Services.AddCors(options =>
            {
                options.AddPolicy(
                    "DisaFrontend",
                    policy =>
                    {
                        policy.WithOrigins(
                            "http://localhost:5173",
                            "https://disa-landing.vercel.app")
                            .AllowAnyHeader()
                            .AllowAnyMethod();
                    });
            });

            // ==========================================
            // 8. BUILD APPLICATION
            // ==========================================


            var app = builder.Build();

            // ==========================================
            // 9. SEED DATABASE
            // ==========================================

            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider
                    .GetRequiredService<IAMDbContext>();

                var hasher = scope.ServiceProvider
                    .GetRequiredService<BCryptPassworkHasher>();

                SeedData.Initialize(db, hasher);
            }

            // ==========================================
            // 10. SWAGGER
            // ==========================================

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            // Giữ nguyên cấu hình HTTPS hiện tại
            // app.UseHttpsRedirection();

            // ==========================================
            // 11. STATIC FILES
            // ==========================================

            var uploadsPath = Path.Combine(
                app.Environment.ContentRootPath,
                "Uploads");

            Directory.CreateDirectory(uploadsPath);

            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider =
                    new PhysicalFileProvider(uploadsPath),

                RequestPath = "/uploads"
            });

            // ==========================================
            // 12. MIDDLEWARE
            // ==========================================

            app.UseRouting();

            app.UseCors("DisaFrontend");

            // Rate limiting before controller execution
            app.UseRateLimiter();

            app.UseAuthentication();

            app.UseAuthorization();

            // ==========================================
            // 13. API CONTROLLERS
            // ==========================================

            app.MapControllers();

            // ==========================================
            // 14. RUN
            // ==========================================

            app.Run();
        }
    }
}
