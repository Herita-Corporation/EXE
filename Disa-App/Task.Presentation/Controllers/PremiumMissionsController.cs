using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Services;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.Premium;

namespace Task.Presentation.Controllers;

public record CreatePremiumGroupRequest(Guid ProvinceId, string[] Accounts);
public record ImportPremiumVoucherRequest(Guid ProvinceId, Guid? MissionId, string Scope, string Provider, string Category, string Title, string Benefit, string Terms, string Code, string? RedemptionUrl, DateTime ExpiresAtUtc);
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

    [HttpGet("special-vouchers")]
    public async global::System.Threading.Tasks.Task<IActionResult> Vouchers()
    {
        await RequirePremium();
        var vouchers = await db.Set<PremiumVoucherCode>().AsNoTracking().Where(x => x.AssignedToUserId == UserId && x.RedeemedAtUtc == null && x.ExpiresAtUtc > DateTime.UtcNow)
            .Join(db.Set<PremiumMissionAssignment>(), v => v.Id, a => a.VoucherCodeId, (v, a) => new { v, a })
            .Where(x => x.a.CompletedAtUtc != null).ToListAsync();
        return Ok(vouchers.Select(x => new
        {
            voucher = new { id = x.v.Id, provider = x.v.Provider, category = x.v.Category, title = x.v.Title, benefit = x.v.Benefit, terms = x.v.Terms, code = x.v.Code, disaPointCost = 0 },
            redemptionUrl = x.v.RedemptionUrl,
            scope = x.a.GroupId.HasValue ? "groups" : "special",
            scopeId = x.a.GroupId ?? x.v.ProvinceId,
            missionId = x.a.MissionId
        }));
    }

    [HttpPost("{scope:regex(^(special|groups)$)}/{scopeId:guid}/{missionId:guid}/redeem")]
    public async global::System.Threading.Tasks.Task<IActionResult> Redeem(string scope, Guid scopeId, Guid missionId)
    {
        await RequirePremium();
        var groupId = scope == "groups" ? scopeId : (Guid?)null;
        var assignment = await db.Set<PremiumMissionAssignment>().Include(x => x.Mission).SingleOrDefaultAsync(x => x.MissionId == missionId && x.UserId == UserId && x.GroupId == groupId && x.CompletedAtUtc != null);
        if (assignment?.VoucherCodeId is null) return NotFound();
        var voucher = await db.Set<PremiumVoucherCode>().SingleAsync(x => x.Id == assignment.VoucherCodeId && x.AssignedToUserId == UserId);
        if (voucher.ExpiresAtUtc <= DateTime.UtcNow) return Conflict(new { message = "Voucher đã hết hạn." });
        voucher.RedeemedAtUtc ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { redemptionUrl = voucher.RedemptionUrl, code = voucher.Code });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("special-vouchers/import")]
    public async global::System.Threading.Tasks.Task<IActionResult> Import(ImportPremiumVoucherRequest request)
    {
        if (request.Scope is not ("SPECIAL" or "GROUP") || string.IsNullOrWhiteSpace(request.Code) || request.ExpiresAtUtc <= DateTime.UtcNow)
            return BadRequest(new { message = "Voucher không hợp lệ." });
        if (!await db.Set<PremiumProvince>().AnyAsync(x => x.Id == request.ProvinceId)) return NotFound();
        if (request.MissionId.HasValue && !await db.Set<PremiumMissionDefinition>().AnyAsync(x => x.Id == request.MissionId && x.ProvinceId == request.ProvinceId)) return BadRequest(new { message = "Nhiệm vụ không thuộc tỉnh/thành đã chọn." });
        db.Add(new PremiumVoucherCode { ProvinceId = request.ProvinceId, MissionId = request.MissionId, Scope = request.Scope, Provider = request.Provider, Category = request.Category, Title = request.Title, Benefit = request.Benefit, Terms = request.Terms, Code = request.Code.Trim(), RedemptionUrl = request.RedemptionUrl, ExpiresAtUtc = request.ExpiresAtUtc.ToUniversalTime() });
        await db.SaveChangesAsync();
        return Ok();
    }

    private async global::System.Threading.Tasks.Task<List<PremiumMissionDefinition>> Definitions(Guid provinceId) => await db.Set<PremiumMissionDefinition>().Include(x => x.Province).Where(x => x.ProvinceId == provinceId && x.IsActive).OrderBy(x => x.SortOrder).ToListAsync();

    private async global::System.Threading.Tasks.Task AcceptOne(PremiumMissionDefinition mission, Guid userId, Guid? groupId)
    {
        if (await db.Set<PremiumMissionAssignment>().AnyAsync(x => x.MissionId == mission.Id && x.UserId == userId && x.GroupId == groupId)) return;
        var scope = groupId.HasValue ? "GROUP" : "SPECIAL";
        var voucher = await db.Set<PremiumVoucherCode>().OrderBy(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.ProvinceId == mission.ProvinceId && x.Scope == scope && x.AssignedToUserId == null && x.ExpiresAtUtc > DateTime.UtcNow && (x.MissionId == mission.Id || x.MissionId == null));
        if (voucher is null) throw new PremiumApiException(409, $"Chưa đủ voucher còn hiệu lực cho nhiệm vụ: {mission.Title}.");
        voucher.AssignedToUserId = userId; voucher.GroupId = groupId; voucher.AssignedAtUtc = DateTime.UtcNow;
        db.Add(new PremiumMissionAssignment { MissionId = mission.Id, UserId = userId, GroupId = groupId, VoucherCodeId = voucher.Id });
    }

    private async global::System.Threading.Tasks.Task<List<PremiumMissionView>> Missions(Guid provinceId, Guid? groupId, Guid userId)
    {
        var definitions = await Definitions(provinceId);
        var assignments = await db.Set<PremiumMissionAssignment>().AsNoTracking().Where(x => x.UserId == userId && x.GroupId == groupId).ToDictionaryAsync(x => x.MissionId);
        return definitions.Select(m => new PremiumMissionView(m.Id, m.Province.Name, m.Title, m.EvidenceType == "VIDEO" ? "video" : "photo", m.Instruction, m.PlaceName, m.Province.Name, m.PlaceQuery, assignments.ContainsKey(m.Id), assignments.TryGetValue(m.Id, out var assignment) ? assignment.CompletedAtUtc : null)).ToList();
    }

    private static object GroupSummary(PremiumGroup group, int completed) => new { id = group.Id, provinceId = group.ProvinceId, provinceName = group.Province.Name, memberCount = group.Members.Count, completedCount = completed, members = group.Members.Select(x => new { id = x.UserId, username = x.DisplayName }) };
    private static object Voucher(PremiumVoucherCode voucher, bool showCode) => new { voucher = new { id = voucher.Id, provider = voucher.Provider, category = voucher.Category, title = voucher.Title, benefit = voucher.Benefit, terms = voucher.Terms, code = showCode ? voucher.Code : null, disaPointCost = 0 }, redemptionUrl = voucher.RedemptionUrl };
}
