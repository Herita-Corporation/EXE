
using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

using IAMService.Premium.Data;
using IAMService.Premium.Models;
using IAMService.Premium.Services;
using IAM.Infrastructure.Data.Entities;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Premium.Controllers;

[ApiController]
[Route("api/premium")]
public sealed class PremiumController : ControllerBase
{
    private readonly PremiumDbContext _db;
    private readonly PremiumActivationService _activator;
    private readonly SePayQrService _qr;
    private readonly GooglePlayVerifier _google;
    private readonly AppleStoreVerifier _apple;
    private readonly IAMDbContext _iamDb;

    public PremiumController(
        PremiumDbContext db,
        PremiumActivationService activator,
        SePayQrService qr,
        GooglePlayVerifier google,
        AppleStoreVerifier apple,
        IAMDbContext iamDb)
    {
        _db = db;
        _activator = activator;
        _qr = qr;
        _google = google;
        _apple = apple;
        _iamDb = iamDb;
    }

    // ==========================================
    // 1. GET CURRENT USER ID FROM JWT
    // ==========================================
    private Guid CurrentUserId()
    {
        var id = User.FindFirstValue(
            ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (!Guid.TryParse(id, out var userId))
        {
            throw new UnauthorizedAccessException(
                "Invalid UserId in JWT");
        }

        return userId;
    }

    // ==========================================
    // 2. GET ALL PREMIUM PLANS
    // ==========================================
    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<IActionResult> Plans(
        CancellationToken ct)
    {
        var plans = await _db.PremiumPlans
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.DurationMonths)
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.Name,
                p.DurationMonths,
                p.PriceVnd,
                p.GoogleProductId,
                p.AppleProductId
            })
            .ToListAsync(ct);

        return Ok(plans);
    }

    // ==========================================
    // 3. GET MY PREMIUM STATUS
    // ==========================================
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(
        CancellationToken ct)
    {
        var userId = CurrentUserId();

        var subscription =
            await _db.UserPremiumSubscriptions
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    s => s.UserId == userId,
                    ct);

        bool isPremium =
            subscription != null
            && (subscription.Status == "ACTIVE" || subscription.Status == "TRIAL")
            && subscription.EndAtUtc > DateTime.UtcNow;

        return Ok(new
        {
            userId,
            isPremium,
            status = isPremium ? "PREMIUM" : "FREE",
            subscriptionStatus = isPremium ? subscription!.Status : "FREE",
            planId = isPremium
                ? subscription!.PlanId
                : (int?)null,
            expiresAtUtc =
                subscription?.EndAtUtc
        });
    }

    // Task Service forwards the caller's Bearer token here when a Premium
    // group is created. IAM remains the authority for identity and access;
    // the mobile client cannot declare another account Premium by itself.
    [Authorize]
    [HttpPost("members/resolve")]
    public async Task<IActionResult> ResolveMembers([FromBody] ResolvePremiumMembersRequest request, CancellationToken ct)
    {
        var currentUserId = CurrentUserId();
        var current = await _db.UserPremiumSubscriptions.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == currentUserId, ct);
        if (current is null || current.Status is not ("ACTIVE" or "TRIAL") || current.EndAtUtc <= DateTime.UtcNow) return Forbid();

        var accounts = request.Accounts?.Select(x => x.Trim()).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray()
            ?? Array.Empty<string>();
        if (accounts.Length == 0 || accounts.Length > 19)
            return BadRequest(new { error = "Provide between 1 and 19 unique usernames or email addresses." });

        var users = await _iamDb.Users.AsNoTracking()
            .Where(x => x.IsActive && (accounts.Contains(x.Username) || accounts.Contains(x.Email)))
            .Select(x => new { x.Id, x.Username, x.Email })
            .ToListAsync(ct);
        if (users.Count != accounts.Length)
            return BadRequest(new { error = "One or more accounts do not exist or are inactive." });

        var ids = users.Select(x => x.Id).ToArray();
        var premiumIds = await _db.UserPremiumSubscriptions.AsNoTracking()
            .Where(x => ids.Contains(x.UserId) && (x.Status == "ACTIVE" || x.Status == "TRIAL") && x.EndAtUtc > DateTime.UtcNow)
            .Select(x => x.UserId).ToListAsync(ct);
        if (premiumIds.Count != ids.Length)
            return BadRequest(new { error = "Every group member must have an active Premium subscription." });

        return Ok(users.Select(x => new { x.Id, x.Username }).ToArray());
    }

    // ==========================================
    // 4. CREATE SEPAY QR PAYMENT
    // ==========================================
    // IMPORTANT:
    // This endpoint is intended for standalone APK.
    // Production must enforce distribution eligibility.
    [Authorize]
    [HttpPost("qr-payments")]
    public async Task<IActionResult> CreateQr(
        [FromBody] CreateQrRequest request,
        CancellationToken ct)
    {
        if (request == null ||
            string.IsNullOrWhiteSpace(request.PlanCode))
        {
            return BadRequest(new
            {
                error = "PlanCode is required"
            });
        }

        var plan = await _db.PremiumPlans
            .SingleOrDefaultAsync(
                p => p.Code == request.PlanCode
                     && p.IsActive,
                ct);

        if (plan == null)
        {
            return BadRequest(new
            {
                error = "Unknown premium plan"
            });
        }

        // Unique transfer content:
        // DISA + 24 hexadecimal characters.
        string orderCode = "DISA" +
            Convert.ToHexString(
                RandomNumberGenerator.GetBytes(12));

        var now = DateTime.UtcNow;

        var payment = new PremiumPayment
        {
            UserId = CurrentUserId(),
            PlanId = plan.Id,
            Provider = "SEPAY",
            AmountVnd = plan.PriceVnd,
            OrderCode = orderCode,
            Status = "PENDING",
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddMinutes(15)
        };

        // Validate QR configuration before saving.
        string qrUrl;

        try
        {
            qrUrl = _qr.QrUrl(
                orderCode,
                payment.AmountVnd);
        }
        catch (InvalidOperationException)
        {
            return StatusCode(503, new
            {
                error = "Payment service is not configured"
            });
        }

        // Save new payment.
        _db.PremiumPayments.Add(payment);

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            paymentId = payment.Id,
            orderCode,
            planCode = plan.Code,
            planName = plan.Name,
            amount = payment.AmountVnd,
            status = payment.Status,
            qrUrl,
            bankCode = _qr.BankCode,
            bankAccount = _qr.BankAccount,
            transferContent = orderCode,
            expiresAtUtc = payment.ExpiresAtUtc
        });
    }

    // ==========================================
    // 5. CHECK PAYMENT STATUS
    // ==========================================
    [Authorize]
    [HttpGet("payments/{id:long}")]
    public async Task<IActionResult> Status(
        long id,
        CancellationToken ct)
    {
        var userId = CurrentUserId();

        var payment = await _db.PremiumPayments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                p => p.Id == id
                     && p.UserId == userId,
                ct);

        if (payment == null)
        {
            return NotFound(new
            {
                error = "Payment not found"
            });
        }

        return Ok(new
        {
            payment.Id,
            payment.PlanId,
            payment.Provider,
            payment.Status,
            payment.AmountVnd,
            payment.OrderCode,
            payment.CreatedAtUtc,
            payment.ExpiresAtUtc,
            payment.PaidAtUtc,
            payment.AccessUntilUtc
        });
    }

    // ==========================================
    // 6. MY PAYMENT HISTORY
    // ==========================================
    [Authorize]
    [HttpGet("history")]
    public async Task<IActionResult> History(
        CancellationToken ct)
    {
        var userId = CurrentUserId();

        var history = await _db.PremiumPayments
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Take(100)
            .Select(p => new
            {
                p.Id,
                p.PlanId,
                p.Provider,
                p.Status,
                p.AmountVnd,
                p.CreatedAtUtc,
                p.PaidAtUtc,
                p.AccessUntilUtc
            })
            .ToListAsync(ct);

        return Ok(history);
    }

    // ==========================================
    // 7. GOOGLE PLAY PURCHASE VERIFICATION
    // ==========================================
    [Authorize]
    [HttpPost("google/verify")]
    public async Task<IActionResult> Google(
        [FromBody] VerifyGoogleRequest body,
        CancellationToken ct)
    {
        var plan = await _db.PremiumPlans
            .SingleOrDefaultAsync(
                p => p.GoogleProductId == body.ProductId
                     && p.IsActive,
                ct);

        if (plan == null)
        {
            return BadRequest(new
            {
                error = "Unknown Google product"
            });
        }

        StorePurchase verified;

        try
        {
            verified = await _google.VerifyAsync(
                body.ProductId,
                body.PurchaseToken,
                ct);
        }
        catch (Exception)
        {
            return BadRequest(new
            {
                error = "Google purchase could not be verified"
            });
        }

        // Bind verified product to requested plan.
        if (verified.ProductId != body.ProductId)
        {
            return BadRequest(new
            {
                error = "Google product mismatch"
            });
        }

        string tokenHash =
            Convert.ToHexString(
                SHA256.HashData(
                    Encoding.UTF8.GetBytes(
                        body.PurchaseToken)));

        var result = await ActivateStorePurchase(
            "GOOGLE",
            verified,
            plan,
            tokenHash,
            ct);

        if (result is OkObjectResult)
        {
            try
            {
                await _google.ConsumeAsync(
                    body.ProductId,
                    body.PurchaseToken,
                    ct);
            }
            catch (Exception)
            {
                // Production:
                // Record failure and retry consumption.
            }
        }

        return result;
    }

    // ==========================================
    // 8. APPLE PURCHASE VERIFICATION
    // ==========================================
    [Authorize]
    [HttpPost("apple/verify")]
    public async Task<IActionResult> Apple(
        [FromBody] VerifyAppleRequest body,
        CancellationToken ct)
    {
        StorePurchase verified;

        try
        {
            verified = _apple.Verify(
                body.SignedTransactionInfo);
        }
        catch (Exception)
        {
            return BadRequest(new
            {
                error = "Apple transaction could not be verified"
            });
        }

        var plan = await _db.PremiumPlans
            .SingleOrDefaultAsync(
                p => p.AppleProductId == verified.ProductId
                     && p.IsActive,
                ct);

        if (plan == null)
        {
            return BadRequest(new
            {
                error = "Unknown Apple product"
            });
        }

        return await ActivateStorePurchase(
            "APPLE",
            verified,
            plan,
            null,
            ct);
    }

    // ==========================================
    // 9. ACTIVATE VERIFIED STORE PURCHASE
    // ==========================================
    private async Task<IActionResult> ActivateStorePurchase(
        string provider,
        StorePurchase verified,
        PremiumPlan plan,
        string? tokenHash,
        CancellationToken ct)
    {
        var userId = CurrentUserId();

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                ct);

        var previous = await _db.PremiumPayments
            .SingleOrDefaultAsync(
                p => p.Provider == provider
                  && p.ProviderTransactionId
                     == verified.TransactionId,
                ct);

        if (previous != null)
        {
            if (previous.UserId != userId)
            {
                return Conflict(new
                {
                    error = "Purchase belongs to another user"
                });
            }

            return Ok(new
            {
                status = previous.Status,
                expiresAtUtc = previous.AccessUntilUtc,
                alreadyProcessed = true
            });
        }

        var now = DateTime.UtcNow;

        var payment = new PremiumPayment
        {
            UserId = userId,
            PlanId = plan.Id,
            Plan = plan,
            Provider = provider,
            Status = "PENDING",
            AmountVnd = plan.PriceVnd,
            OrderCode = provider + "-"
                + verified.TransactionId,
            ProviderTransactionId =
                verified.TransactionId,
            StoreTokenHash = tokenHash,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddMinutes(30)
        };

        _db.PremiumPayments.Add(payment);

        await _db.SaveChangesAsync(ct);

        var expiry = await _activator.ActivateAsync(
            payment,
            now,
            ct);

        await transaction.CommitAsync(ct);

        return Ok(new
        {
            status = "PAID",
            expiresAtUtc = expiry
        });
    }
}
