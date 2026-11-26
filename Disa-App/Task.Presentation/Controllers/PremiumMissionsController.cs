using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Services;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.Premium;

namespace Task.Presentation.Controllers;

public record CreatePremiumGroupRequest(Guid ProvinceId, string[] Accounts);
public record ImportPremiumOfferRequest(Guid ProvinceId, Guid? MissionId, string Scope, string Provider, string Category, string Title, string Benefit, string Terms, string PublicUrl, DateTime? StartsAtUtc, DateTime? ExpiresAtUtc);
public sealed record PremiumMissionView(Guid Id, string ProvinceName, string Title, string EvidenceType, string Instruction, string PlaceName, string Locality, string PlaceQuery, bool Accepted, DateTime? CompletedAt);

[ApiController, Authorize, Route("api/premium")]
public sealed class PremiumMissionsController(TaskDbContext db, PremiumIamClient iam, IFileStorageService files, IConfiguration config) : ControllerBase
{
    private Guid UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id)
        ? id : throw new PremiumApiException(401, "Bạn cần đăng nhập.");

    private async global::System.Threading.Tasks.Task RequirePremium() => await iam.RequireActive(HttpContext);

    [HttpGet("provinces")]
    public async global::System.Threading.Tasks.Task<IActionResult> Provinces()
    {
        await RequirePremium();
        return Ok(await db.Set<PremiumProvince>().AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name)
            .Select(x => new { id = x.Id, name = x.Name }).ToListAsync());
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
        var definitions = await Definitions(provinceId);
        if (definitions.Count != 8) return Conflict(new { message = "Danh mục nhiệm vụ của tỉnh/thành chưa hoàn chỉnh." });
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
        if (accounts.Length is < 1 or > 19) return BadRequest(new { message = "Nhóm cần từ 2 đến 20 thành viên, gồm cả bạn." });
        var province = await db.Set<PremiumProvince>().SingleOrDefaultAsync(x => x.Id == request.ProvinceId && x.IsActive);
        if (province is null) return NotFound();
        var resolved = await iam.ResolveMembers(HttpContext, accounts);
        if (resolved.Any(x => x.Id == UserId)) return BadRequest(new { message = "Không nhập lại tài khoản của bạn trong danh sách thành viên." });
        var members = resolved.Append(new PremiumMember(UserId, User.Identity?.Name ?? "Bạn")).ToArray();
        var definitions = await Definitions(province.Id);
        if (definitions.Count != 8) return Conflict(new { message = "Danh mục nhiệm vụ của tỉnh/thành chưa hoàn chỉnh." });

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
    public async global::System.Threading.Tasks.Task<IActionResult> Submit(string scope, Guid scopeId, Guid missionId, [FromForm] IFormFile? photo, [FromForm] IFormFile? video)
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
        if (assignment.Mission.EvidenceType == "PHOTO" && photo is null || assignment.Mission.EvidenceType == "VIDEO" && video is null)
            return BadRequest(new { message = "Loại minh chứng không đúng với yêu cầu nhiệm vụ." });

        try
        {
            string url;
            if (photo is not null) { await MissionMediaValidator.Photo(photo); url = await files.UploadImageAsync(photo); }
            else { _ = await MissionMediaValidator.Duration(video!, config["MissionValidation:FfprobePath"] ?? "ffprobe", HttpContext.RequestAborted); url = await files.UploadVideoAsync(video!); }
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            if (groupId.HasValue)
            {
                var all = await db.Set<PremiumMissionAssignment>().Where(x => x.GroupId == groupId && x.MissionId == missionId).ToListAsync();
                if (all.Count == 0) return NotFound();
                foreach (var item in all) { item.CompletedAtUtc = DateTime.UtcNow; item.EvidenceUrl = url; }
            }
            else { assignment.CompletedAtUtc = DateTime.UtcNow; assignment.EvidenceUrl = url; }
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

    private async global::System.Threading.Tasks.Task AcceptOne(PremiumMissionDefinition mission, Guid userId, Guid? groupId)
    {
        if (await db.Set<PremiumMissionAssignment>().AnyAsync(x => x.MissionId == mission.Id && x.UserId == userId && x.GroupId == groupId)) return;
        db.Add(new PremiumMissionAssignment { MissionId = mission.Id, UserId = userId, GroupId = groupId });
    }

    private async global::System.Threading.Tasks.Task<List<PremiumMissionView>> Missions(Guid provinceId, Guid? groupId, Guid userId)
    {
        var definitions = await Definitions(provinceId);
        var assignments = await db.Set<PremiumMissionAssignment>().AsNoTracking().Where(x => x.UserId == userId && x.GroupId == groupId).ToDictionaryAsync(x => x.MissionId);
        return definitions.Select(m => new PremiumMissionView(m.Id, m.Province.Name, m.Title, m.EvidenceType == "VIDEO" ? "video" : "photo", m.Instruction, m.PlaceName, m.Province.Name, m.PlaceQuery, assignments.ContainsKey(m.Id), assignments.TryGetValue(m.Id, out var assignment) ? assignment.CompletedAtUtc : null)).ToList();
    }

    private static object GroupSummary(PremiumGroup group, int completed) => new { id = group.Id, provinceId = group.ProvinceId, provinceName = group.Province.Name, memberCount = group.Members.Count, completedCount = completed, members = group.Members.Select(x => new { id = x.UserId, username = x.DisplayName }) };
}
