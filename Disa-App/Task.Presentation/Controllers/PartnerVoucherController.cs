using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.PartnerVouchers;

namespace Task.Presentation.Controllers;

public record ClaimPartnerVoucher(string? AcquisitionContextToken, Guid? TripId = null);
public record VerifyPartnerVoucher(Guid LocationId, string? PresentationToken, string? ShortCode, decimal EligibleSubtotal, string? OrderRef);
public record ConfirmPartnerVoucher(string VerificationTicket);
public record QuotaInput(int TotalQuota, string Reason);
public record AdjustmentInput(string Reason);
public record CampaignInput(Guid LocationId, string Title, string Terms, string DiscountType, int PercentageBps, decimal FixedAmount, decimal? MaxDiscountAmount, decimal MinSpend, string UsageMode, int ValidDays, int TotalQuota, DateTime ClaimStartsAt, DateTime ClaimEndsAt, DateTime RedeemEndsAt, string DataMode = "INTERNAL_TEST");

// IAM remains authoritative for account/partner/location scope. Never grant
// merchant access merely because a JWT contains Partner or global Manager.
public class Oc3IamAccess(IHttpClientFactory clients, IConfiguration config)
{
    public async System.Threading.Tasks.Task Check(HttpContext context, Guid? location = null, bool staff = false, Guid? travelerId = null)
    {
        var baseUrl = config["PartnerVouchers:IamBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl)) throw new VoucherError("SERVICE_UNAVAILABLE", "Chưa cấu hình IAM cho voucher.", 503);
        using var request = new HttpRequestMessage(HttpMethod.Get, baseUrl.TrimEnd('/') + "/api/oc3/session" + (location.HasValue ? $"?locationId={location}&staff={staff.ToString().ToLowerInvariant()}&travelerId={travelerId}" : ""));
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(context.Request.Headers.Authorization.ToString());
        using var response = await clients.CreateClient("Oc3Iam").SendAsync(request, context.RequestAborted);
        if ((int)response.StatusCode >= 500) throw new VoucherError("SERVICE_UNAVAILABLE", "Máy chủ xác thực tạm thời không khả dụng.", 503);
        if (!response.IsSuccessStatusCode) throw new VoucherError("STAFF_FORBIDDEN", "Tài khoản hoặc quyền địa điểm không còn hợp lệ.", response.StatusCode is System.Net.HttpStatusCode.Unauthorized ? 401 : 403);
    }
}

[ApiController, Authorize, Route("api/v2")]
public class PartnerVoucherController(TaskDbContext db, PartnerVoucherService service, Oc3IamAccess access, global::Task.Presentation.PartnerTripOfferMatcher matcher) : ControllerBase
{
    Guid UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : throw new VoucherError("AUTH_REQUIRED", "Cần đăng nhập.", 401);
    string Key => Request.Headers["Idempotency-Key"].FirstOrDefault() ?? throw new VoucherError("IDEMPOTENCY_KEY_REQUIRED", "Thiếu Idempotency-Key.", 400);

    [HttpGet("me/offers")]
    public async System.Threading.Tasks.Task<IActionResult> Offers(string surface = "home", Guid? locationId = null)
    { await access.Check(HttpContext); return Ok(await service.Offers(UserId, surface == "home" ? "HOME" : "ITINERARY", locationId)); }
    [HttpPost("me/campaigns/{id:guid}/claim")]
    public async System.Threading.Tasks.Task<IActionResult> Claim(Guid id, ClaimPartnerVoucher body)
    {
        var location = await db.Set<Campaign>().Where(c => c.Id == id).Select(c => (Guid?)c.LocationId).SingleOrDefaultAsync() ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy ưu đãi.", 404);
        await access.Check(HttpContext, location);
        if (body.TripId.HasValue)
        {
            var candidates = await matcher.Match(HttpContext, UserId, body.TripId.Value);
            if (!candidates.Any(c => JsonSerializer.SerializeToElement(c, new JsonSerializerOptions(JsonSerializerDefaults.Web)).GetProperty("campaignId").GetGuid() == id))
                throw new VoucherError("TRIP_OFFER_MISMATCH", "Ưu đãi không khớp điểm dừng trong lịch trình.");
        }
        return Ok(await service.Claim(id, UserId, Key, body.AcquisitionContextToken, body.TripId));
    }
    [HttpGet("me/trips/{id:guid}/offers")]
    public async System.Threading.Tasks.Task<IActionResult> TripOffers(Guid id)
    { await access.Check(HttpContext); return Ok(await matcher.Match(HttpContext, UserId, id)); }
    [HttpGet("me/vouchers")]
    public async System.Threading.Tasks.Task<IActionResult> Wallet(string bucket = "active", int page = 1)
    { await access.Check(HttpContext); if (bucket is not ("active" or "history")) return BadRequest(); return Ok(await service.Wallet(UserId, bucket, page)); }
    [HttpGet("me/vouchers/{id:guid}")]
    public async System.Threading.Tasks.Task<IActionResult> Detail(Guid id)
    { await access.Check(HttpContext); return Ok(service.WalletItem(await service.GetOwned(id, UserId))); }
    [HttpPost("me/vouchers/{id:guid}/presentations")]
    public async System.Threading.Tasks.Task<IActionResult> Present(Guid id)
    {
        var v = await service.GetOwned(id, UserId); await access.Check(HttpContext, v.Campaign.LocationId);
        Response.Headers.CacheControl = "no-store"; return Ok(await service.Present(id, UserId));
    }
    [HttpDelete("me/vouchers/{id:guid}/presentations/current")]
    public async System.Threading.Tasks.Task<IActionResult> RevokePresentation(Guid id)
    {
        await access.Check(HttpContext); await service.GetOwned(id, UserId);
        await db.Set<global::Task.Infrastructure.PartnerVouchers.Presentation>().Where(p => p.VoucherInstanceId == id && p.Status == "ACTIVE").ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "REVOKED"));
        return NoContent();
    }
    [HttpPost("partner/voucher-verifications")]
    public async System.Threading.Tasks.Task<IActionResult> Verify(VerifyPartnerVoucher body)
    {
        await access.Check(HttpContext, body.LocationId, true);
        var p = await service.FindPresentation(body.PresentationToken, body.ShortCode);
        await access.Check(HttpContext, body.LocationId, true, p.Voucher.TravelerId);
        Response.Headers.CacheControl = "no-store";
        return Ok(await service.Verify(UserId, body.LocationId, body.PresentationToken, body.ShortCode, body.EligibleSubtotal, body.OrderRef));
    }
    [HttpPost("partner/redemptions")]
    public async System.Threading.Tasks.Task<IActionResult> Confirm(ConfirmPartnerVoucher body)
    {
        var verification = await service.FindVerification(body.VerificationTicket);
        await access.Check(HttpContext, verification.LocationId, true, verification.Presentation.Voucher.TravelerId);
        return Ok(await service.Redeem(UserId, body.VerificationTicket, Key));
    }
    [HttpGet("partner/redemptions")]
    public async System.Threading.Tasks.Task<IActionResult> Redemptions(Guid locationId, int page = 1)
    {
        await access.Check(HttpContext, locationId, true);
        return Ok(await db.Set<Redemption>().AsNoTracking().Where(r => r.LocationId == locationId && r.StaffId == UserId).OrderByDescending(r => r.RedeemedAt).Skip((Math.Max(1, page) - 1) * 50).Take(50)
            .Select(r => new { r.Id, r.ReceiptRef, r.Voucher.VoucherRef, r.OrderRef, r.EligibleSubtotal, r.DiscountAmount, r.NetAmount, r.RedeemedAt, r.Voided }).ToListAsync());
    }
    [HttpPost("me/support-tickets")]
    public async System.Threading.Tasks.Task<IActionResult> Support(SupportTicket body)
    {
        await access.Check(HttpContext);
        if (string.IsNullOrWhiteSpace(body.Description) || body.Description.Length > 2000 || body.Category.Length > 60) return BadRequest();
        if (body.VoucherId.HasValue) await service.GetOwned(body.VoucherId.Value, UserId);
        var ticket = new SupportTicket { UserId = UserId, VoucherId = body.VoucherId, Description = body.Description, Category = body.Category };
        db.Add(ticket); await db.SaveChangesAsync(); return Ok(new { ticket.Id, ticket.Status });
    }
    [HttpGet("me/support-tickets")]
    public async System.Threading.Tasks.Task<IActionResult> MySupport()
    { await access.Check(HttpContext); return Ok(await db.Set<SupportTicket>().AsNoTracking().Where(t => t.UserId == UserId).OrderByDescending(t => t.CreatedAt).Take(50).Select(t => new { t.Id, t.Description, t.Status, t.CreatedAt }).ToListAsync()); }
    [Authorize(Roles = "Admin"), HttpGet("admin/support-tickets")]
    public async System.Threading.Tasks.Task<IActionResult> AdminSupport()
    { await access.Check(HttpContext); return Ok(await db.Set<SupportTicket>().AsNoTracking().OrderByDescending(t => t.CreatedAt).Take(100).ToListAsync()); }
    [AllowAnonymous, HttpGet("public/qr/{qrKey}")]
    public async System.Threading.Tasks.Task<IActionResult> Qr(string qrKey)
    {
        var c = await db.Set<Campaign>().AsNoTracking().Include(c => c.Location).SingleOrDefaultAsync(c => c.QrKey == qrKey && c.Location.Active && c.Status != "DRAFT");
        if (c == null) return NotFound();
        return Ok(new { campaignId = c.Id, c.LocationId, c.Title, c.Terms, partnerName = c.Location.Name, c.Location.Address, availableToClaim = c.Status == "ACTIVE" && c.ClaimStartsAt <= DateTime.UtcNow && c.ClaimEndsAt > DateTime.UtcNow ? c.TotalQuota - c.IssuedCount : 0, c.ClaimEndsAt, c.RedeemEndsAt, serverNow = DateTime.UtcNow });
    }
    [AllowAnonymous, HttpPost("public/acquisition-contexts")]
    public async System.Threading.Tasks.Task<IActionResult> Context([FromBody] string qrKey)
    {
        var c = await db.Set<Campaign>().SingleOrDefaultAsync(c => c.QrKey == qrKey && c.Status == "ACTIVE" && c.ClaimEndsAt > DateTime.UtcNow) ?? throw new VoucherError("CAMPAIGN_INACTIVE", "Ưu đãi không còn hoạt động.");
        var token = VoucherRules.Token(); var ctx = new AcquisitionContext { CampaignId = c.Id, TokenHash = VoucherRules.Hash(token), ExpiresAt = DateTime.UtcNow.AddDays(7) };
        db.Add(ctx); await db.SaveChangesAsync(); Response.Headers.CacheControl = "no-store"; return Ok(new { acquisitionContextToken = token, ctx.ExpiresAt, campaignId = c.Id });
    }
    [Authorize(Roles = "Admin"), HttpPost("admin/campaigns")]
    public async System.Threading.Tasks.Task<IActionResult> Create(CampaignInput x)
    {
        await access.Check(HttpContext);
        var l = await db.Set<LocationSnapshot>().SingleOrDefaultAsync(l => l.Id == x.LocationId && l.Active) ?? throw new VoucherError("LOCATION_NOT_READY", "Địa điểm chưa được publish/sync.");
        if (string.IsNullOrWhiteSpace(x.Title) || x.Title.Length > 200 || string.IsNullOrWhiteSpace(x.Terms) || x.Terms.Length > 5000 || x.TotalQuota < 1 || x.TotalQuota > 100000 || x.ValidDays is < 1 or > 365 || x.ClaimStartsAt >= x.ClaimEndsAt || x.ClaimEndsAt > x.RedeemEndsAt || x.RedeemEndsAt <= DateTime.UtcNow || x.MinSpend < 0 || x.FixedAmount < 0 || x.MaxDiscountAmount < 0 || x.PercentageBps is < 0 or > 10000 || x.DiscountType is not ("PERCENT" or "FIXED" or "GIFT") || x.UsageMode is not ("IMMEDIATE_OR_LATER" or "RETURN_VISIT") || x.DataMode is not ("INTERNAL_TEST" or "REAL" or "DEMO")) return BadRequest(new { code = "INVALID_CAMPAIGN" });
        var c = new Campaign { LocationId = l.Id, Title = x.Title, Terms = x.Terms, DiscountType = x.DiscountType, PercentageBps = x.PercentageBps, FixedAmount = x.FixedAmount, MaxDiscountAmount = x.MaxDiscountAmount, MinSpend = x.MinSpend, UsageMode = x.UsageMode, ValidDays = x.ValidDays, TotalQuota = x.TotalQuota, ClaimStartsAt = x.ClaimStartsAt.ToUniversalTime(), ClaimEndsAt = x.ClaimEndsAt.ToUniversalTime(), RedeemEndsAt = x.RedeemEndsAt.ToUniversalTime(), DataMode = x.DataMode, CreatedBy = UserId };
        db.Add(c); service.Event("campaign_created", UserId, c.Id, c.DataMode); await db.SaveChangesAsync(); return Ok(new { c.Id, c.QrKey, c.Status });
    }
    [Authorize(Roles = "Admin"), HttpGet("admin/campaigns")]
    public async System.Threading.Tasks.Task<IActionResult> Campaigns()
    { await access.Check(HttpContext); return Ok(await db.Set<Campaign>().AsNoTracking().OrderByDescending(c => c.CreatedAt).Take(100).ToListAsync()); }
    [Authorize(Roles = "Admin"), HttpPost("admin/campaigns/{id:guid}/{command}")]
    public async System.Threading.Tasks.Task<IActionResult> CampaignState(Guid id, string command)
    {
        await access.Check(HttpContext);
        return Ok(await service.ChangeState(id, UserId, command));
    }
    [Authorize(Roles = "Admin"), HttpGet("admin/reports/oc3")]
    public async System.Threading.Tasks.Task<IActionResult> Report(string dataMode = "REAL")
    {
        await access.Check(HttpContext);
        var campaigns = db.Set<Campaign>().Where(c => c.DataMode == dataMode);
        var vouchers = db.Set<VoucherInstance>().Where(v => v.Campaign.DataMode == dataMode);
        var redemptions = db.Set<Redemption>().Where(r => r.Voucher.Campaign.DataMode == dataMode);
        return Ok(new { assessmentModel = "APPROVED_FREE_PILOT", dataMode, campaignLocations = await campaigns.Select(c => c.LocationId).Distinct().CountAsync(), uniqueClaimants = await vouchers.Select(v => v.TravelerId).Distinct().CountAsync(), claims = await vouchers.CountAsync(), redemptions = await redemptions.CountAsync(), voidedRedemptions = await redemptions.CountAsync(r => r.Voided), uniqueRedeemingStaff = await redemptions.Select(r => r.StaffId).Distinct().CountAsync(), disaRevenue = (decimal?)null, note = "Voucher redemption is not proof of payment. DISA revenue is not measured by this module; verify IAM payment evidence separately.", serverNow = DateTime.UtcNow });
    }
    [Authorize(Roles = "Admin"), HttpPost("admin/campaigns/{id:guid}/quota-adjustments")]
    public async System.Threading.Tasks.Task<IActionResult> Quota(Guid id, QuotaInput body)
    { await access.Check(HttpContext); return Ok(await service.AdjustQuota(id, UserId, body.TotalQuota, body.Reason)); }
    [Authorize(Roles = "Admin"), HttpPost("admin/redemptions/{id:guid}/adjustments")]
    public async System.Threading.Tasks.Task<IActionResult> Adjustment(Guid id, AdjustmentInput body)
    { await access.Check(HttpContext); return Ok(await service.VoidRedemption(id, UserId, body.Reason)); }
    [HttpGet("partner/reports/redemptions.csv")]
    public async System.Threading.Tasks.Task<IActionResult> Csv(Guid locationId)
    {
        await access.Check(HttpContext, locationId, true);
        var rows = await db.Set<Redemption>().AsNoTracking().Where(r => r.LocationId == locationId && r.StaffId == UserId).OrderByDescending(r => r.RedeemedAt).Take(10000)
            .Select(r => new { r.ReceiptRef, r.Voucher.VoucherRef, r.OrderRef, r.EligibleSubtotal, r.DiscountAmount, r.NetAmount, r.RedeemedAt, r.Voided }).ToListAsync();
        static string Cell(string? s) { s ??= ""; if ((s.TrimStart().Length > 0 && "=+-@".Contains(s.TrimStart()[0])) || s.StartsWith("\t") || s.StartsWith("\r")) s = "'" + s; return "\"" + s.Replace("\"", "\"\"") + "\""; }
        var csv = new System.Text.StringBuilder("receiptRef,voucherRef,orderRef,eligibleSubtotal,discountAmount,netAmount,redeemedAt,voided\r\n");
        foreach (var r in rows) csv.AppendLine(string.Join(",", Cell(r.ReceiptRef), Cell(r.VoucherRef), Cell(r.OrderRef), r.EligibleSubtotal.ToString(System.Globalization.CultureInfo.InvariantCulture), r.DiscountAmount.ToString(System.Globalization.CultureInfo.InvariantCulture), r.NetAmount.ToString(System.Globalization.CultureInfo.InvariantCulture), r.RedeemedAt.ToString("O"), r.Voided));
        return File(System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(csv.ToString())).ToArray(), "text/csv; charset=utf-8", "disa-redemptions.csv");
    }
}
