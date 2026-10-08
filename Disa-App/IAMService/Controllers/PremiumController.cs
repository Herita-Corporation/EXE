using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Google.Apis.Auth;
using IAM.Application.DTOs.Requests;
using IAM.Application.Interfaces;
using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IAMService.Controllers;

[ApiController]
[Route("api/premium")]
public class PremiumController : ControllerBase
{
    private readonly IAMDbContext _context;
    private readonly IGooglePlayBillingService _billing;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PremiumController> _logger;

    public PremiumController(
        IAMDbContext context,
        IGooglePlayBillingService billing,
        IConfiguration configuration,
        ILogger<PremiumController> logger)
    {
        _context = context;
        _billing = billing;
        _configuration = configuration;
        _logger = logger;
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        return Ok(new { IsPremium = user.IsPremium, PremiumExpiresAt = user.PremiumExpiresAt });
    }

    // Called by the app right after Google's purchase sheet reports success
    // (purchaseUpdatedListener in react-native-iap). Validates the purchase
    // against the Play Developer API before trusting it — the client-side
    // "success" callback alone is not proof of a real purchase.
    [Authorize]
    [HttpPost("verify-purchase")]
    public async Task<IActionResult> VerifyPurchase(VerifyPurchaseRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        // One purchase token must map to exactly one account — refuse if
        // another user already owns it (prevents replaying someone else's
        // token to self-upgrade).
        var ownedByOther = await _context.Users.AnyAsync(
            x => x.Id != userId && x.PremiumPurchaseToken == request.PurchaseToken);
        if (ownedByOther)
            return BadRequest("Giao dịch này đã được dùng cho một tài khoản khác.");

        GooglePlaySubscriptionStatus status;
        try
        {
            status = await _billing.GetSubscriptionAsync(request.ProductId, request.PurchaseToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "google_play_verify_failed");
            return BadRequest("Không xác thực được giao dịch với Google Play.");
        }

        if (!status.IsActive)
            return BadRequest("Giao dịch không còn hiệu lực.");

        if (status.AcknowledgementRequired)
        {
            try
            {
                await _billing.AcknowledgeSubscriptionAsync(request.ProductId, request.PurchaseToken);
            }
            catch (Exception ex)
            {
                // Non-fatal — the user still gets Premium; retry is cheap to
                // skip since Google tolerates re-acknowledging within the
                // 3-day window on the next verify/RTDN pass.
                _logger.LogWarning(ex, "google_play_acknowledge_failed");
            }
        }

        user.IsPremium = true;
        user.PremiumProductId = request.ProductId;
        user.PremiumExpiresAt = status.ExpiresAt;
        user.PremiumPurchaseToken = request.PurchaseToken;
        await _context.SaveChangesAsync();

        return Ok(new { IsPremium = user.IsPremium, PremiumExpiresAt = user.PremiumExpiresAt });
    }

    // Google Cloud Pub/Sub push endpoint — Real-time Developer Notifications.
    // Keeps IsPremium in sync with the subscription's real lifecycle
    // (renewal/cancellation/expiry) without requiring the app to be open.
    // See Google's push-subscription docs: the request carries an OIDC ID
    // token in the Authorization header signed by the service account
    // configured on the Pub/Sub subscription — GooglePlay:PubSubServiceAccountEmail
    // must match that account's email, otherwise this rejects every request.
    [AllowAnonymous]
    [HttpPost("rtdn-webhook")]
    public async Task<IActionResult> RtdnWebhook()
    {
        var expectedEmail = _configuration["GooglePlay:PubSubServiceAccountEmail"];
        if (string.IsNullOrWhiteSpace(expectedEmail))
        {
            _logger.LogWarning("rtdn_webhook_not_configured");
            return Unauthorized();
        }

        var authHeader = Request.Headers.Authorization.ToString();
        if (!authHeader.StartsWith("Bearer ", StringComparison.Ordinal))
            return Unauthorized();

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(authHeader["Bearer ".Length..]);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "rtdn_webhook_invalid_token");
            return Unauthorized();
        }

        if (!string.Equals(payload.Email, expectedEmail, StringComparison.OrdinalIgnoreCase))
            return Unauthorized();

        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var rawBody = await reader.ReadToEndAsync();

        string? purchaseToken = null;
        string? notificationType = null;
        try
        {
            using var envelope = JsonDocument.Parse(rawBody);
            var dataB64 = envelope.RootElement.GetProperty("message").GetProperty("data").GetString();
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(dataB64!));
            using var notification = JsonDocument.Parse(decoded);
            if (notification.RootElement.TryGetProperty("subscriptionNotification", out var sub))
            {
                purchaseToken = sub.GetProperty("purchaseToken").GetString();
                notificationType = sub.GetProperty("notificationType").ToString();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "rtdn_webhook_malformed_payload");
            // Ack anyway (200) — Pub/Sub retries a malformed message forever
            // otherwise, and retrying won't fix a parsing bug.
            return Ok();
        }

        if (purchaseToken == null)
            return Ok(); // Not a subscription notification (e.g. a test/voided-purchase event) — nothing to do.

        var user = await _context.Users.FirstOrDefaultAsync(x => x.PremiumPurchaseToken == purchaseToken);
        if (user == null)
        {
            _logger.LogWarning("rtdn_webhook_unknown_token {NotificationType}", notificationType);
            return Ok();
        }

        try
        {
            var status = await _billing.GetSubscriptionAsync(user.PremiumProductId ?? "", purchaseToken);
            user.IsPremium = status.IsActive;
            user.PremiumExpiresAt = status.ExpiresAt;
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "rtdn_webhook_resync_failed {NotificationType}", notificationType);
        }

        return Ok();
    }
}
