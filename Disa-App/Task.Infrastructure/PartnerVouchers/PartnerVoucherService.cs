using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.PartnerVouchers;

public class PartnerVoucherService(TaskDbContext db, IConfiguration config)
{
    string CodeHash(string code)
    {
        var key = config["PartnerVouchers:TokenKey"];
        if (key == null || key.Length < 32) throw new VoucherError("SERVICE_UNAVAILABLE", "Chưa cấu hình khóa bảo vệ voucher.", 503);
        return Convert.ToHexString(System.Security.Cryptography.HMACSHA256.HashData(System.Text.Encoding.UTF8.GetBytes(key), System.Text.Encoding.UTF8.GetBytes(code)));
    }
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public object WalletItem(VoucherInstance v)
    {
        var now = DateTime.UtcNow;
        var status = VoucherRules.EffectiveStatus(v, now);
        var ready = status == "ISSUED" && now >= v.RedeemableFrom && v.Campaign.Location.Active && v.Campaign.Status != "REDEMPTION_SUSPENDED";
        return new { voucherId = v.Id, v.VoucherRef, v.CampaignId, v.Campaign.LocationId, locationName = v.Campaign.Location.Name, address = v.Campaign.Location.Address, v.Campaign.Location.Latitude, v.Campaign.Location.Longitude,
            v.Campaign.Title, v.Campaign.Terms, termsSnapshot = JsonSerializer.Deserialize<JsonElement>(v.TermsSnapshotJson), status, bucket = status == "ISSUED" ? "active" : "history",
            displayState = status != "ISSUED" ? status : now < v.RedeemableFrom ? "WAITING_FOR_NEXT_VISIT" : ready ? "READY_TO_USE" : "TEMPORARILY_SUSPENDED",
            v.IssuedAt, v.RedeemableFrom, v.ExpiresAt, v.RedeemedAt, canPresent = ready, serverNow = now };
    }
    public IQueryable<VoucherInstance> Owned(Guid user) => db.Set<VoucherInstance>().Include(v => v.Campaign).ThenInclude(c => c.Location).Where(v => v.TravelerId == user);
    public async System.Threading.Tasks.Task<VoucherInstance> GetOwned(Guid id, Guid user) => await Owned(user).SingleOrDefaultAsync(v => v.Id == id) ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy voucher.", 404);
    public async System.Threading.Tasks.Task<object[]> Wallet(Guid user, string bucket, int page)
    {
        var now = DateTime.UtcNow;
        var q = Owned(user).AsNoTracking();
        q = bucket == "active" ? q.Where(v => v.Status == "ISSUED" && v.ExpiresAt > now) : q.Where(v => v.Status != "ISSUED" || v.ExpiresAt <= now);
        return (await q.OrderBy(v => v.ExpiresAt).Skip((Math.Max(page, 1) - 1) * 50).Take(50).ToListAsync()).Select(WalletItem).ToArray();
    }
    public async System.Threading.Tasks.Task<object[]> Offers(Guid user, string source, Guid? locationId)
    {
        var allowTest = bool.TryParse(config["PartnerVouchers:AllowTestCampaigns"], out var test) && test;
        if (!new[] { "HOME", "ITINERARY", "ACQUISITION_QR" }.Contains(source)) throw new VoucherError("INVALID_SOURCE", "Nguồn không hợp lệ.");
        var now = DateTime.UtcNow;
        var campaigns = await db.Set<Campaign>().AsNoTracking().Include(c => c.Location)
            .Where(c => c.Location.Active && (c.DataMode == "REAL" || allowTest) && (locationId == null || c.LocationId == locationId) && c.Status == "ACTIVE" && c.ClaimStartsAt <= now && c.ClaimEndsAt > now)
            .OrderBy(c => c.ClaimEndsAt).Take(100).ToListAsync();
        if (campaigns.Count == 0) return Array.Empty<object>();
        // Do not serialize a local Guid[] through OPENJSON: the team's local
        // SQL Server can run at a pre-2016 compatibility level. This join uses
        // ordinary predicates and preserves the same wallet ownership rule.
        var owned = await db.Set<VoucherInstance>().AsNoTracking().Where(v => v.TravelerId == user && v.Campaign.Status == "ACTIVE" && v.Campaign.ClaimStartsAt <= now && v.Campaign.ClaimEndsAt > now).ToListAsync();
        return campaigns.Where(c => c.AllowedSources.Split(',').Contains(source)).Select(c => new { C = c, V = owned.SingleOrDefault(v => v.CampaignId == c.Id) })
            .Where(x => x.V != null ? VoucherRules.EffectiveStatus(x.V, now) == "ISSUED" : x.C.IssuedCount < x.C.TotalQuota)
            .Select(x => (object)new { campaignId = x.C.Id, x.C.LocationId, partnerName = x.C.Location.Name, x.C.Location.Address, x.C.Location.Latitude, x.C.Location.Longitude, x.C.Location.ImageUrl,
                x.C.Title, x.C.Terms, x.C.DiscountType, x.C.PercentageBps, x.C.FixedAmount, x.C.MaxDiscountAmount, x.C.MinSpend, x.C.ValidDays, x.C.UsageMode,
                validityDescription = $"Dùng trong {x.C.ValidDays} ngày từ lúc nhận, không quá ngày kết thúc ưu đãi", x.C.ClaimEndsAt, x.C.RedeemEndsAt,
                ownedVoucherId = x.V?.Id, alreadyClaimed = x.V != null, canClaim = x.V == null, expiresAt = x.V?.ExpiresAt, serverNow = now }).ToArray();
    }
    // All competing operations on a campaign share the same transaction-owned SQL lock.
    // The database UNIQUE constraints remain the last defence against duplicate writes.
    async System.Threading.Tasks.Task Lock(string resource)
    {
        if (!db.Database.IsSqlServer()) throw new InvalidOperationException("Partner voucher transactions require SQL Server.");
        await db.Database.ExecuteSqlInterpolatedAsync($@"DECLARE @r int; EXEC @r=sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000,'Voucher lock unavailable',1;");
    }
    async System.Threading.Tasks.Task<object> Atomic(Guid campaignId, Guid actor, string operation, string? key, string hash, Func<System.Threading.Tasks.Task<object>> action)
    {
        if (key is { Length: > 100 } || (key != null && string.IsNullOrWhiteSpace(key))) throw new VoucherError("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key không hợp lệ.", 400);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        if (key != null)
        {
            await Lock($"pv:idem:{actor}:{VoucherRules.Hash(key)}");
            var old = await db.Set<IdempotencyRecord>().SingleOrDefaultAsync(i => i.ActorId == actor && i.Operation == operation && i.Key == key);
            if (old != null)
            {
                if (old.RequestHash != hash) throw new VoucherError("IDEMPOTENCY_KEY_REUSED", "Khóa đã dùng cho yêu cầu khác.", 409);
                await tx.CommitAsync();
                return JsonSerializer.Deserialize<JsonElement>(old.ResponseJson);
            }
        }
        await Lock($"pv:campaign:{campaignId}");
        var response = await action();
        if (key != null) db.Add(new IdempotencyRecord { ActorId = actor, Operation = operation, Key = key, RequestHash = hash, ResponseJson = JsonSerializer.Serialize(response, Json) });
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return response;
    }
    public void Event(string type, Guid actor, Guid entity, string dataMode, string detail = "") => db.Add(new BusinessEvent { EventType = type, ActorId = actor, EntityId = entity, DataMode = dataMode, Detail = detail });
    public async System.Threading.Tasks.Task<object> Claim(Guid campaignId, Guid user, string key, string? contextToken, Guid? tripId = null)
    {
        return await Atomic(campaignId, user, "claim", key, VoucherRules.Hash($"{campaignId}:{contextToken}:{tripId}"), async () =>
        {
            var existing = await Owned(user).SingleOrDefaultAsync(v => v.CampaignId == campaignId);
            if (existing != null) return WalletItem(existing);
            var c = await db.Set<Campaign>().Include(c => c.Location).SingleOrDefaultAsync(c => c.Id == campaignId) ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy ưu đãi.", 404);
            var now = DateTime.UtcNow;
            if (!c.Location.Active || c.Status != "ACTIVE" || now < c.ClaimStartsAt || now >= c.ClaimEndsAt) throw new VoucherError("CAMPAIGN_INACTIVE", "Ưu đãi không còn nhận được.");
            var source = tripId.HasValue ? "ITINERARY" : "HOME";
            if (contextToken != null)
            {
                var h = VoucherRules.Hash(contextToken);
                var ctx = await db.Set<AcquisitionContext>().SingleOrDefaultAsync(x => x.TokenHash == h && x.CampaignId == campaignId && x.ExpiresAt > now);
                if (ctx == null || (ctx.BoundUserId.HasValue && ctx.BoundUserId != user)) throw new VoucherError("CONTEXT_INVALID", "Nguồn nhận ưu đãi không hợp lệ.");
                ctx.BoundUserId = user; source = "ACQUISITION_QR";
            }
            if (!c.AllowedSources.Split(',').Contains(source)) throw new VoucherError("SOURCE_NOT_ELIGIBLE", "Ưu đãi không hỗ trợ nguồn nhận này.");
            if (c.IssuedCount >= c.TotalQuota) throw new VoucherError("STOCK_EXHAUSTED", "Ưu đãi đã hết lượt nhận.", 409);
            var from = VoucherRules.RedeemableFrom(c, now);
            var expires = new[] { now.AddDays(c.ValidDays), c.RedeemEndsAt }.Min();
            if (from >= expires) throw new VoucherError("NO_VALID_WINDOW", "Không còn thời gian sử dụng ưu đãi.");
            var v = new VoucherInstance { CampaignId = c.Id, Campaign = c, TravelerId = user, Source = source, TripId = tripId, IssuedAt = now, RedeemableFrom = from, ExpiresAt = expires,
                TermsSnapshotJson = JsonSerializer.Serialize(new { c.Title, c.Terms, c.DiscountType, c.PercentageBps, c.FixedAmount, c.MinSpend, c.MaxDiscountAmount }, Json) };
            db.Add(v); c.IssuedCount++;
            Event("voucher_claimed", user, v.Id, c.DataMode, source);
            return WalletItem(v);
        });
    }
    public async System.Threading.Tasks.Task<object> Present(Guid id, Guid user)
    {
        var campaignId = await db.Set<VoucherInstance>().Where(v => v.Id == id && v.TravelerId == user).Select(v => (Guid?)v.CampaignId).SingleOrDefaultAsync() ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy voucher.", 404);
        return await Atomic(campaignId, user, "present", null, "", async () =>
        {
            var v = await GetOwned(id, user); var now = DateTime.UtcNow; VoucherRules.CanUse(v, now);
            await db.Set<Presentation>().Where(p => p.VoucherInstanceId == id && p.Status == "ACTIVE").ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "REVOKED"));
            var token = VoucherRules.Token();
            var code = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8))[..10];
            var p = new Presentation { VoucherInstanceId = id, TokenHash = VoucherRules.Hash(token), ShortCodeHash = CodeHash(code), ExpiresAt = new[] { now.AddSeconds(90), v.ExpiresAt }.Min() };
            db.Add(p); Event("voucher_presented", user, id, v.Campaign.DataMode);
            return new { presentationId = p.Id, qrPayload = "disa-voucher:v1:" + token, shortCode = code, p.ExpiresAt, serverNow = now };
        });
    }
    public async System.Threading.Tasks.Task<Presentation> FindPresentation(string? token, string? code)
    {
        if ((string.IsNullOrWhiteSpace(token)) == (string.IsNullOrWhiteSpace(code))) throw new VoucherError("TOKEN_INVALID", "Nhập QR hoặc mã sử dụng.");
        if (token?.Length > 100 || code?.Length > 30) throw new VoucherError("TOKEN_INVALID", "Mã không hợp lệ.");
        var h = token != null ? VoucherRules.Hash(token.StartsWith("disa-voucher:v1:", StringComparison.Ordinal) ? token[16..] : token) : CodeHash(code!.Trim().ToUpperInvariant());
        return await db.Set<Presentation>().Include(p => p.Voucher).ThenInclude(v => v.Campaign).ThenInclude(c => c.Location)
            .SingleOrDefaultAsync(p => token != null ? p.TokenHash == h : p.ShortCodeHash == h && p.Status == "ACTIVE") ?? throw new VoucherError("TOKEN_INVALID", "Mã không hợp lệ.");
    }
    public async System.Threading.Tasks.Task<object> Verify(Guid staff, Guid location, string? token, string? code, decimal subtotal, string? orderRef)
    {
        if (orderRef?.Length > 100) throw new VoucherError("INVALID_ORDER", "Mã hóa đơn quá dài.");
        var p = await FindPresentation(token, code);
        return await Atomic(p.Voucher.CampaignId, staff, "verify", null, "", async () =>
        {
            await db.Entry(p).ReloadAsync(); await db.Entry(p.Voucher).ReloadAsync();
            await db.Entry(p.Voucher.Campaign).ReloadAsync();
            var now = DateTime.UtcNow; VoucherRules.CanUse(p.Voucher, now);
            if (p.Voucher.TravelerId == staff) throw new VoucherError("SELF_REDEMPTION_FORBIDDEN", "Không được xác nhận voucher của chính mình.", 403);
            if (p.Voucher.Campaign.LocationId != location) throw new VoucherError("WRONG_LOCATION", "Voucher không áp dụng tại chi nhánh này.");
            if (p.Status != "ACTIVE" || p.ExpiresAt <= now) throw new VoucherError("TOKEN_EXPIRED", "Mã đã hết hạn, vui lòng tạo mã mới.");
            var ticket = VoucherRules.Token(); var discount = VoucherRules.Discount(p.Voucher.Campaign, subtotal);
            var verification = new Verification { PresentationId = p.Id, StaffId = staff, LocationId = location, TicketHash = VoucherRules.Hash(ticket), Subtotal = subtotal, Discount = discount, OrderRef = orderRef,
                ExpiresAt = new[] { now.AddSeconds(30), p.ExpiresAt, p.Voucher.ExpiresAt }.Min() };
            db.Add(verification); await System.Threading.Tasks.Task.CompletedTask;
            return new { verificationTicket = ticket, verification.ExpiresAt, p.Voucher.VoucherRef, p.Voucher.Campaign.Title, p.Voucher.Campaign.Terms, eligibleSubtotal = subtotal, discountAmount = discount, netAmount = subtotal - discount, canConfirm = true, serverNow = now };
        });
    }
    public async System.Threading.Tasks.Task<Verification> FindVerification(string ticket) => await db.Set<Verification>().Include(v => v.Presentation).ThenInclude(p => p.Voucher).ThenInclude(v => v.Campaign).ThenInclude(c => c.Location)
        .SingleOrDefaultAsync(v => v.TicketHash == VoucherRules.Hash(ticket)) ?? throw new VoucherError("TOKEN_INVALID", "Xác minh không hợp lệ.");
    public async System.Threading.Tasks.Task<object> Redeem(Guid staff, string ticket, string key)
    {
        var verification = await FindVerification(ticket);
        return await Atomic(verification.Presentation.Voucher.CampaignId, staff, "redeem", key, VoucherRules.Hash(ticket), async () =>
        {
            await db.Entry(verification).ReloadAsync();
            var p = verification.Presentation; var v = p.Voucher;
            await db.Entry(p).ReloadAsync(); await db.Entry(v).ReloadAsync(); await db.Entry(v.Campaign).ReloadAsync();
            var now = DateTime.UtcNow;
            if (verification.StaffId != staff || verification.LocationId != v.Campaign.LocationId) throw new VoucherError("STAFF_FORBIDDEN", "Không có quyền xác nhận.", 403);
            if (v.TravelerId == staff) throw new VoucherError("SELF_REDEMPTION_FORBIDDEN", "Không được tự xác nhận.", 403);
            VoucherRules.CanUse(v, now);
            if (verification.ConsumedAt != null || verification.ExpiresAt <= now || p.Status != "ACTIVE" || p.ExpiresAt <= now) throw new VoucherError("TOKEN_EXPIRED", "Xác minh hết hạn, hãy quét lại.");
            var r = new Redemption { VoucherInstanceId = v.Id, LocationId = v.Campaign.LocationId, StaffId = staff, EligibleSubtotal = verification.Subtotal, DiscountAmount = verification.Discount, NetAmount = verification.Subtotal - verification.Discount, OrderRef = verification.OrderRef, RedeemedAt = now };
            db.Add(r); v.Status = "REDEEMED"; v.RedeemedAt = now; p.Status = "CONSUMED"; verification.ConsumedAt = now; v.Campaign.RedeemedCount++;
            Event("voucher_redeemed", staff, r.Id, v.Campaign.DataMode, v.VoucherRef);
            return new { redemptionId = r.Id, r.ReceiptRef, v.VoucherRef, status = "COMMITTED", voucherStatus = "REDEEMED", r.LocationId, r.EligibleSubtotal, r.DiscountAmount, r.NetAmount, r.RedeemedAt };
        });
    }
    public async System.Threading.Tasks.Task<object> ChangeState(Guid id, Guid actor, string action) => await Atomic(id, actor, "campaign-state", null, "", async () =>
    {
        var c = await db.Set<Campaign>().Include(c => c.Location).SingleOrDefaultAsync(c => c.Id == id) ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy.", 404);
        if (action == "publish" && c.Status == "DRAFT" && c.Location.Active) c.Status = "ACTIVE";
        else if (action == "pause-claims") c.Status = "CLAIM_PAUSED";
        else if (action == "suspend-redemptions") c.Status = "REDEMPTION_SUSPENDED";
        else throw new VoucherError("INVALID_TRANSITION", "Không thể đổi trạng thái.", 409);
        Event("campaign_" + action, actor, id, c.DataMode); return new { c.Status };
    });
    public async System.Threading.Tasks.Task<object> AdjustQuota(Guid id, Guid actor, int quota, string reason) => await Atomic(id, actor, "quota", null, "", async () =>
    {
        var c = await db.Set<Campaign>().SingleOrDefaultAsync(c => c.Id == id) ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy ưu đãi.", 404);
        if (quota < c.IssuedCount || quota > 100000 || string.IsNullOrWhiteSpace(reason) || reason.Length > 1000) throw new VoucherError("INVALID_QUOTA", "Quota không được nhỏ hơn số mã đã cấp; cần lý do và xác nhận đối tác.");
        var old = c.TotalQuota; c.TotalQuota = quota; Event("quota_adjusted", actor, id, c.DataMode, $"{old}->{quota}: {reason}"); return new { c.TotalQuota, c.IssuedCount };
    });
    public async System.Threading.Tasks.Task<object> VoidRedemption(Guid id, Guid actor, string reason)
    {
        var campaignId = await db.Set<Redemption>().Where(r => r.Id == id).Select(r => r.Voucher.CampaignId).SingleOrDefaultAsync();
        return await Atomic(campaignId, actor, "void", null, "", async () =>
        {
            var r = await db.Set<Redemption>().Include(r => r.Voucher).ThenInclude(v => v.Campaign).SingleOrDefaultAsync(r => r.Id == id) ?? throw new VoucherError("NOT_FOUND", "Không tìm thấy lượt sử dụng.", 404);
            if (string.IsNullOrWhiteSpace(reason) || reason.Length > 1000) throw new VoucherError("REASON_REQUIRED", "Cần lý do điều chỉnh.");
            if (!r.Voided) { r.Voided = true; r.VoidReason = reason; Event("redemption_voided", actor, id, r.Voucher.Campaign.DataMode, reason); }
            return new { r.Id, r.Voided, voucherStatus = r.Voucher.Status, quotaRecycled = false };
        });
    }
}
