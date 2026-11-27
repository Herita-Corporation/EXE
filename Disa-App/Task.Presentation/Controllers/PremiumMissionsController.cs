using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Services;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.Premium;
using Task.Infrastructure.PartnerVouchers;

namespace Task.Presentation.Controllers;

public record CreatePremiumGroupRequest(Guid ProvinceId, string[] Accounts);
public record ImportPremiumOfferRequest(Guid ProvinceId, Guid? MissionId, string Scope, string Provider, string Category, string Title, string Benefit, string Terms, string PublicUrl, DateTime? StartsAtUtc, DateTime? ExpiresAtUtc);
public sealed record PremiumMissionView(Guid Id, string ProvinceName, string Title, string EvidenceType, string Instruction, string PlaceName, string Locality, string PlaceQuery, bool Accepted, DateTime? CompletedAt, DiscoveryCheckpoint? Checkpoint, int BonusPoints);

[ApiController, Authorize, Route("api/premium")]
public sealed class PremiumMissionsController(TaskDbContext db, PremiumIamClient iam, PremiumTripEligibilityClient trips, IFileStorageService files, IConfiguration config) : ControllerBase
{
    private Guid UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id)
        ? id : throw new PremiumApiException(401, "Bạn cần đăng nhập.");

    private async global::System.Threading.Tasks.Task RequirePremium() => await iam.RequireActive(HttpContext);

    [HttpGet("provinces")]
    public async global::System.Threading.Tasks.Task<IActionResult> Provinces()
    {
        await RequirePremium();
        return Ok(await db.Set<PremiumProvince>().AsNoTracking().Where(x => x.IsActive && x.AreaType == "PROVINCE").OrderBy(x => x.Name)
            .Select(x => new { id = x.Id, name = x.Name }).ToListAsync());
    }

    [HttpGet("mission-areas")]
    public async global::System.Threading.Tasks.Task<IActionResult> MissionAreas()
    {
        await RequirePremium();
        var areas = await db.Set<PremiumProvince>().AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.AreaType == "DESTINATION" ? 0 : 1).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.AreaType, x.ParentProvinceId, x.Aliases }).ToListAsync();
        var names = areas.ToDictionary(x => x.Id, x => x.Name);
        return Ok(areas.Select(x => new { id = x.Id, name = x.Name, areaType = x.AreaType, parentProvinceId = x.ParentProvinceId, parentProvinceName = x.ParentProvinceId.HasValue && names.TryGetValue(x.ParentProvinceId.Value, out var name) ? name : null, aliases = x.Aliases.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) }));
    }

    [HttpGet("mission-areas/{provinceId:guid}/eligibility")]
    public async global::System.Threading.Tasks.Task<IActionResult> Eligibility(Guid provinceId)
    {
        await RequirePremium();
        var result = await trips.Check(HttpContext, await Area(provinceId));
        return Ok(new { eligible = result.Eligible, itineraryId = result.ItineraryId, message = result.Message });
    }

    [HttpGet("special/{provinceId:guid}")]
    public async global::System.Threading.Tasks.Task<IActionResult> Special(Guid provinceId)
    {
        await RequirePremium();
        var missions = await Missions(provinceId, null, UserId);
        return Ok(missions);
    }

    [HttpPost("special/{provinceId:guid}/accept-all")]
    public async global::System.Threading.Tasks.Task<IActionResult> AcceptAll(Guid provinceId)
    {
        await RequirePremium();
        await RequireOngoingTrip(provinceId);
        var definitions = await Definitions(provinceId);
        if (definitions.Count != 10) return Conflict(new { message = "Danh mục nhiệm vụ của khu vực chưa hoàn chỉnh." });
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        foreach (var mission in definitions)
            await AcceptOne(mission, UserId, null);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(await Missions(provinceId, null, UserId));
    }

    [HttpPost("special/{provinceId:guid}/{missionId:guid}/accept")]
    public async global::System.Threading.Tasks.Task<IActionResult> Accept(Guid provinceId, Guid missionId)
    {
        await RequirePremium();
        await RequireOngoingTrip(provinceId);
        var mission = await db.Set<PremiumMissionDefinition>().SingleOrDefaultAsync(x => x.Id == missionId && x.ProvinceId == provinceId && x.IsActive);
        if (mission is null) return NotFound();
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        await AcceptOne(mission, UserId, null);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok((await Missions(provinceId, null, UserId)).Single(x => x.Id == missionId));
    }

    [HttpGet("groups")]
    public async global::System.Threading.Tasks.Task<IActionResult> Groups()
    {
        await RequirePremium();
        var groups = await db.Set<PremiumGroup>().AsNoTracking().Include(x => x.Province).Include(x => x.Members)
            .Where(x => x.Members.Any(m => m.UserId == UserId)).OrderByDescending(x => x.CreatedAtUtc).ToListAsync();
        var result = new List<object>();
        foreach (var group in groups)
        {
            var completed = await db.Set<PremiumMissionAssignment>().CountAsync(x => x.GroupId == group.Id && x.UserId == UserId && x.CompletedAtUtc != null);
            result.Add(GroupSummary(group, completed));
        }
        return Ok(result);
    }

    [HttpPost("groups")]
    public async global::System.Threading.Tasks.Task<IActionResult> CreateGroup(CreatePremiumGroupRequest request)
    {
        await RequirePremium();
        var accounts = request.Accounts?.Select(x => x.Trim()).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray() ?? [];
        if (accounts.Length is < 1 or > 9) return BadRequest(new { message = "Nhóm cần từ 2 đến 10 thành viên, gồm cả bạn." });
        var province = await db.Set<PremiumProvince>().SingleOrDefaultAsync(x => x.Id == request.ProvinceId && x.IsActive);
        if (province is null) return NotFound();
        var resolved = await iam.ResolveMembers(HttpContext, accounts);
        if (resolved.Any(x => x.Id == UserId)) return BadRequest(new { message = "Không nhập lại tài khoản của bạn trong danh sách thành viên." });
        var members = resolved.Append(new PremiumMember(UserId, User.Identity?.Name ?? "Bạn")).ToArray();
        var definitions = await Definitions(province.Id);
        if (definitions.Count != 10) return Conflict(new { message = "Danh mục nhiệm vụ của khu vực chưa hoàn chỉnh." });

        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var group = new PremiumGroup { ProvinceId = province.Id, Province = province, CreatedByUserId = UserId };
        foreach (var member in members) group.Members.Add(new PremiumGroupMember { UserId = member.Id, DisplayName = member.Username });
        db.Add(group);
        await db.SaveChangesAsync();
        foreach (var mission in definitions)
            foreach (var member in members)
                await AcceptOne(mission, member.Id, group.Id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(GroupSummary(group, 0));
    }

    [HttpGet("groups/{groupId:guid}")]
    public async global::System.Threading.Tasks.Task<IActionResult> Group(Guid groupId)
    {
        await RequirePremium();
        var group = await db.Set<PremiumGroup>().AsNoTracking().Include(x => x.Province).Include(x => x.Members).SingleOrDefaultAsync(x => x.Id == groupId && x.Members.Any(m => m.UserId == UserId));
        if (group is null) return NotFound();
        var missions = await Missions(group.ProvinceId, group.Id, UserId);
        var completed = await db.Set<PremiumMissionAssignment>().CountAsync(x => x.GroupId == groupId && x.UserId == UserId && x.CompletedAtUtc != null);
        return Ok(new
        {
            id = group.Id,
            provinceId = group.ProvinceId,
            provinceName = group.Province.Name,
            memberCount = group.Members.Count,
            completedCount = completed,
            members = group.Members.Select(x => new { id = x.UserId, username = x.DisplayName }),
            missions
        });
    }

    [HttpPost("{scope:regex(^(special|groups)$)}/{scopeId:guid}/{missionId:guid}/submit")]
    [RequestSizeLimit(105_000_000)]
    public async global::System.Threading.Tasks.Task<IActionResult> Submit(string scope, Guid scopeId, Guid missionId, [FromForm] IFormFile? photo, [FromForm] IFormFile? video, [FromForm] double? latitude, [FromForm] double? longitude, [FromForm] double? accuracy, [FromForm] DateTimeOffset? capturedAtUtc)
    {
        await RequirePremium();
        var groupId = scope == "groups" ? scopeId : (Guid?)null;
        var provinceId = scope == "groups"
            ? await db.Set<PremiumGroup>().Where(x => x.Id == scopeId && x.Members.Any(m => m.UserId == UserId)).Select(x => (Guid?)x.ProvinceId).SingleOrDefaultAsync()
            : scopeId;
        if (!provinceId.HasValue) return NotFound();
        var assignment = await db.Set<PremiumMissionAssignment>().Include(x => x.Mission).SingleOrDefaultAsync(x => x.MissionId == missionId && x.UserId == UserId && x.GroupId == groupId && x.Mission.ProvinceId == provinceId);
        if (assignment is null) return Conflict(new { message = "Hãy nhận nhiệm vụ trước khi nộp minh chứng." });
        if (assignment.CompletedAtUtc != null) return Conflict(new { message = "Nhiệm vụ đã hoàn thành." });
        var rule = DiscoveryCheckpoint.For((await Area(provinceId.Value)).Name, assignment.Mission.SortOrder);
        var now = DateTimeOffset.UtcNow;
        if (rule is not null && (latitude is null || longitude is null || accuracy is null || capturedAtUtc is null
            || !rule.Matches(latitude.Value, longitude.Value, accuracy.Value, capturedAtUtc.Value, now)))
            return BadRequest(new { message = "Cần GPS mới, chính xác trong 65 m và cách điểm nhiệm vụ không quá 120 m." });
        if (rule?.RequiresWindow == true && rule.BonusAt(now) == 0)
            return BadRequest(new { message = $"Nhiệm vụ chỉ mở từ {rule.FromHour}:00 đến trước {rule.UntilHour}:00 (giờ Việt Nam)." });
        if ((photo is null) == (video is null) || assignment.Mission.EvidenceType == "PHOTO" && photo is null || assignment.Mission.EvidenceType == "VIDEO" && video is null)
            return BadRequest(new { message = "Loại minh chứng không đúng với yêu cầu nhiệm vụ." });

        try
        {
            string url;
            if (photo is not null) { await MissionMediaValidator.Photo(photo); url = await files.UploadImageAsync(photo); }
            else { var seconds = await MissionMediaValidator.Duration(video!, config["MissionValidation:FfprobePath"] ?? "ffprobe", HttpContext.RequestAborted); if (seconds < 5) return BadRequest(new { message = "Video cần dài ít nhất 5 giây." }); url = await files.UploadVideoAsync(video!); }
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var all = await db.Set<PremiumMissionAssignment>().Where(x => x.MissionId == missionId && x.GroupId == groupId
                && (groupId != null || x.UserId == UserId)).ToListAsync();
            // Reload the original tracked assignment inside the transaction as well.
            await db.Entry(assignment).ReloadAsync();
            if (all.Any(x => x.CompletedAtUtc.HasValue)) return Conflict(new { message = "Nhiệm vụ đã hoàn thành." });
            var bonus = rule?.BonusAt(now) ?? 0;
            var awarded = await db.Set<PremiumMissionAssignment>().Where(x => x.MissionId == missionId && x.BonusPoints > 0).Select(x => x.UserId).ToListAsync();
            foreach (var item in all) {
                item.CompletedAtUtc = now.UtcDateTime; item.EvidenceUrl = url;
                item.BonusPoints = awarded.Contains(item.UserId) ? 0 : bonus;
            }
            var campaignKey = config[$"DiscoveryRewards:{missionId}"];
            if (!string.IsNullOrWhiteSpace(campaignKey)) {
                if (!Guid.TryParse(campaignKey, out var campaignId)) throw new InvalidOperationException("Cấu hình chiến dịch voucher không hợp lệ.");
                await IssueCampaignRewards(all, campaignId, now.UtcDateTime);
            } else await IssueVirtualVouchers(all, assignment.Mission.SortOrder, rule?.PartnerKey);
            await db.SaveChangesAsync(); await tx.CommitAsync();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        return Ok((await Missions(provinceId.Value, groupId, UserId)).Single(x => x.Id == missionId));
    }

    // Completed missions unlock reusable public partner links. No private
    // voucher code is allocated or exposed to the client.
    [HttpGet("special-offers")]
    public async global::System.Threading.Tasks.Task<IActionResult> Offers()
    {
        await RequirePremium();
        var now = DateTime.UtcNow;
        var assignments = await db.Set<PremiumMissionAssignment>().AsNoTracking()
            .Include(x => x.Mission)
            .Where(x => x.UserId == UserId && x.CompletedAtUtc != null)
            .ToListAsync();
        var offers = await db.Set<PremiumPublicOffer>().AsNoTracking()
            .Where(x => x.IsActive
                && (x.StartsAtUtc == null || x.StartsAtUtc <= now)
                && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now))
            .ToListAsync();

        var result = assignments.SelectMany(assignment => offers
            .Where(offer => offer.ProvinceId == assignment.Mission.ProvinceId
                && offer.Scope == (assignment.GroupId.HasValue ? "GROUP" : "SPECIAL")
                && (offer.MissionId == null || offer.MissionId == assignment.MissionId))
            .Select(offer => new
            {
                offer = new
                {
                    id = offer.Id,
                    provider = offer.Provider,
                    category = offer.Category,
                    title = offer.Title,
                    benefit = offer.Benefit,
                    terms = offer.Terms,
                    publicUrl = offer.PublicUrl,
                    startsAtUtc = offer.StartsAtUtc,
                    expiresAtUtc = offer.ExpiresAtUtc
                },
                scope = assignment.GroupId.HasValue ? "groups" : "special",
                scopeId = assignment.GroupId ?? assignment.Mission.ProvinceId,
                missionId = assignment.MissionId
            }))
            .GroupBy(x => x.offer.id)
            .Select(x => x.First());
        return Ok(result);
    }

    [HttpGet("vouchers")]
    public async global::System.Threading.Tasks.Task<IActionResult> VirtualVouchers()
    {
        await RequirePremium();
        var vouchers = await db.Set<PremiumVirtualVoucher>().AsNoTracking()
            .Include(x => x.Template).Include(x => x.Assignment).ThenInclude(x => x.Mission).ThenInclude(x => x.Province)
            .Where(x => x.UserId == UserId).OrderByDescending(x => x.IssuedAtUtc).ToListAsync();
        return Ok(vouchers.Select(x => new
        {
            id = x.Id, issuedAtUtc = x.IssuedAtUtc, missionId = x.Assignment.MissionId,
            missionTitle = x.Assignment.Mission.Title, areaName = x.Assignment.Mission.Province.Name,
            partnerKey = x.Template.PartnerKey, provider = x.Template.Provider, category = x.Template.Category,
            title = x.Template.Title, benefit = x.Template.Benefit, terms = x.Template.Terms, publicUrl = x.Template.PublicUrl
        }));
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("special-offers/import")]
    public async global::System.Threading.Tasks.Task<IActionResult> ImportPublicOffer(ImportPremiumOfferRequest request)
    {
        if (request.Scope is not ("SPECIAL" or "GROUP")
            || string.IsNullOrWhiteSpace(request.Provider)
            || string.IsNullOrWhiteSpace(request.Title)
            || !Uri.TryCreate(request.PublicUrl, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || request.ExpiresAtUtc is not null && request.ExpiresAtUtc <= DateTime.UtcNow)
            return BadRequest(new { message = "Public offer is invalid." });
        if (!await db.Set<PremiumProvince>().AnyAsync(x => x.Id == request.ProvinceId)) return NotFound();
        if (request.MissionId.HasValue && !await db.Set<PremiumMissionDefinition>().AnyAsync(x => x.Id == request.MissionId && x.ProvinceId == request.ProvinceId)) return BadRequest(new { message = "Mission does not belong to the selected province." });

        db.Add(new PremiumPublicOffer
        {
            ProvinceId = request.ProvinceId,
            MissionId = request.MissionId,
            Scope = request.Scope,
            Provider = request.Provider.Trim(),
            Category = request.Category.Trim(),
            Title = request.Title.Trim(),
            Benefit = request.Benefit.Trim(),
            Terms = request.Terms.Trim(),
            PublicUrl = uri.AbsoluteUri,
            StartsAtUtc = request.StartsAtUtc?.ToUniversalTime(),
            ExpiresAtUtc = request.ExpiresAtUtc?.ToUniversalTime()
        });
        await db.SaveChangesAsync();
        return Ok();
    }

    private async global::System.Threading.Tasks.Task<List<PremiumMissionDefinition>> Definitions(Guid provinceId) => await db.Set<PremiumMissionDefinition>().Include(x => x.Province).Where(x => x.ProvinceId == provinceId && x.IsActive).OrderBy(x => x.SortOrder).ToListAsync();

    private async global::System.Threading.Tasks.Task<PremiumProvince> Area(Guid id) => await db.Set<PremiumProvince>().SingleOrDefaultAsync(x => x.Id == id && x.IsActive)
        ?? throw new PremiumApiException(404, "Không tìm thấy khu vực nhiệm vụ.", "PREMIUM_MISSION_AREA_NOT_FOUND");

    private async global::System.Threading.Tasks.Task RequireOngoingTrip(Guid areaId)
    {
        var eligibility = await trips.Check(HttpContext, await Area(areaId));
        if (!eligibility.Eligible)
            throw new PremiumApiException(409, eligibility.Message ?? "Bạn cần có hành trình đang diễn ra tại khu vực này.", "PREMIUM_ONGOING_ITINERARY_REQUIRED");
    }

    private async global::System.Threading.Tasks.Task IssueVirtualVouchers(IEnumerable<PremiumMissionAssignment> assignments, int sortOrder, string? partnerKey)
    {
        var templates = await db.Set<PremiumVirtualVoucherTemplate>().Where(x => x.IsActive).OrderBy(x => x.PartnerKey).ToListAsync();
        if (templates.Count == 0) throw new PremiumApiException(503, "Danh mục voucher demo chưa sẵn sàng.", "PREMIUM_VOUCHER_CATALOG_UNAVAILABLE");
        var ids = assignments.Select(x => x.Id).ToArray();
        var issued = await db.Set<PremiumVirtualVoucher>().Where(x => ids.Contains(x.AssignmentId)).Select(x => x.AssignmentId).ToListAsync();
        var known = issued.ToHashSet();
        var template = templates.FirstOrDefault(x => x.PartnerKey == partnerKey) ?? templates[(sortOrder - 1) % templates.Count];
        foreach (var assignment in assignments.Where(x => !known.Contains(x.Id)))
            db.Add(new PremiumVirtualVoucher { AssignmentId = assignment.Id, UserId = assignment.UserId, TemplateId = template.Id });
    }

    // Real campaigns must explicitly opt into this reward channel. This code shares
    // the completion transaction and the wallet's unique (CampaignId, TravelerId) index.
    private async global::System.Threading.Tasks.Task IssueCampaignRewards(List<PremiumMissionAssignment> all, Guid id, DateTime now)
    {
        var c = await db.Set<Campaign>().Include(x => x.Location).SingleOrDefaultAsync(x => x.Id == id);
        if (c == null || c.DataMode != "REAL" || !c.Location.Active || c.Status != "ACTIVE"
            || now < c.ClaimStartsAt || now >= c.ClaimEndsAt || !c.AllowedSources.Split(',').Contains("SPECIAL_MISSION"))
            throw new InvalidOperationException("Chiến dịch thưởng chưa mở hoặc đã kết thúc.");
        var owners = all.Select(a => a.UserId).ToArray();
        var existing = await db.Set<VoucherInstance>().Where(v => v.CampaignId == id && owners.Contains(v.TravelerId)).Select(v => v.TravelerId).ToListAsync();
        var recipients = owners.Except(existing).ToArray();
        var from = VoucherRules.RedeemableFrom(c, now);
        var expires = new[] { now.AddDays(c.ValidDays), c.RedeemEndsAt }.Min();
        if (from >= expires || recipients.Length > c.TotalQuota - c.IssuedCount)
            throw new InvalidOperationException("Không còn đủ voucher hợp lệ cho cả nhóm. Chưa ghi nhận hoàn thành.");
        foreach (var user in recipients) {
            var v = new VoucherInstance { CampaignId = id, TravelerId = user, Source = "SPECIAL_MISSION", IssuedAt = now, RedeemableFrom = from, ExpiresAt = expires,
                TermsSnapshotJson = System.Text.Json.JsonSerializer.Serialize(new { c.Title, c.Terms, c.DiscountType, c.PercentageBps, c.FixedAmount, c.MinSpend, c.MaxDiscountAmount }, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)) };
            db.Add(v); db.Add(new BusinessEvent { EventType = "voucher_claimed", ActorId = user, EntityId = v.Id, DataMode = c.DataMode, Detail = v.Source });
        }
        c.IssuedCount += recipients.Length;
    }

    private async global::System.Threading.Tasks.Task AcceptOne(PremiumMissionDefinition mission, Guid userId, Guid? groupId)
    {
        if (await db.Set<PremiumMissionAssignment>().AnyAsync(x => x.MissionId == mission.Id && x.UserId == userId && x.GroupId == groupId)) return;
        db.Add(new PremiumMissionAssignment { MissionId = mission.Id, UserId = userId, GroupId = groupId });
    }

    private async global::System.Threading.Tasks.Task<List<PremiumMissionView>> Missions(Guid provinceId, Guid? groupId, Guid userId)
    {
        var definitions = await Definitions(provinceId);
        var assignments = await db.Set<PremiumMissionAssignment>().AsNoTracking().Where(x => x.UserId == userId && x.GroupId == groupId).ToDictionaryAsync(x => x.MissionId);
        return definitions.Select(m => new PremiumMissionView(m.Id, m.Province.Name, m.Title, m.EvidenceType == "VIDEO" ? "video" : "photo", m.Instruction, m.PlaceName, m.Province.Name, m.PlaceQuery, assignments.ContainsKey(m.Id), assignments.TryGetValue(m.Id, out var assignment) ? assignment.CompletedAtUtc : null, DiscoveryCheckpoint.For(m.Province.Name, m.SortOrder), assignment?.BonusPoints ?? 0)).ToList();
    }

    private static object GroupSummary(PremiumGroup group, int completed) => new { id = group.Id, provinceId = group.ProvinceId, provinceName = group.Province.Name, memberCount = group.Members.Count, completedCount = completed, members = group.Members.Select(x => new { id = x.UserId, username = x.DisplayName }) };
}
