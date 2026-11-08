using System.Security.Claims;
using System.Text.Json;
using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Controllers;

public record ManualPartnerInput(Guid OwnerUserId, string BusinessName, string BusinessType, string OwnerName, string PhoneNumber, string Address);
public record ManualLocationInput(Guid PartnerId, Guid SourceRequestId, string ConsentReference);
public record StaffInput(Guid UserId);
public record LocationRevisionInput(Guid SourceRequestId, string ConsentReference, int ExpectedPublishedVersion);
public record OwnerHandoffInput(Guid OwnerUserId, string Reason);

[ApiController, Authorize, Route("api/oc3")]
public class Oc3PartnerController(IAMDbContext db) : ControllerBase
{
    Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    [HttpGet("session")]
    public async Task<IActionResult> Session(Guid? locationId = null, bool staff = false, Guid? travelerId = null)
    {
        if (!await db.Users.AnyAsync(u => u.Id == Uid && u.IsActive)) return Unauthorized();
        if (locationId.HasValue)
        {
            if (!await db.Set<PartnerLocation>().AnyAsync(l => l.Id == locationId && l.Status == "PUBLISHED" && l.Partner.Status == "Active")) return Forbid();
            if (staff && !await db.Set<PartnerLocationMember>().AnyAsync(m => m.LocationId == locationId && m.UserId == Uid && m.Status == "ACTIVE")) return Forbid();
            if (staff && travelerId.HasValue && !await db.Users.AnyAsync(u => u.Id == travelerId && u.IsActive)) return Forbid();
        }
        return Ok(new { userId = Uid, active = true });
    }
    [HttpGet("memberships")]
    public async Task<IActionResult> Memberships() => Ok(await db.Set<PartnerLocationMember>().AsNoTracking().Where(m => m.UserId == Uid)
        .Select(m => new { m.Id, m.LocationId, m.Status, name = m.Location.SourceRequest.Title }).ToListAsync());
    [HttpPost("memberships/{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id)
    {
        var m = await db.Set<PartnerLocationMember>().SingleOrDefaultAsync(m => m.Id == id && m.UserId == Uid);
        if (m == null) return NotFound(); if (m.Status is not ("INVITED" or "ACTIVE")) return Conflict();
        m.Status = "ACTIVE"; m.AcceptedAt ??= DateTime.UtcNow; await db.SaveChangesAsync(); return NoContent();
    }
    [Authorize(Roles = "Admin"), HttpPost("partners")]
    public async Task<IActionResult> CreatePartner(ManualPartnerInput x)
    {
        var owner = await db.Users.FindAsync(x.OwnerUserId);
        if (owner == null || !owner.IsActive || string.IsNullOrWhiteSpace(x.BusinessName) || x.BusinessName.Length > 250) return BadRequest();
        if (await db.PartnerProfiles.AnyAsync(p => p.UserId == x.OwnerUserId)) return Conflict("Owner already has a PartnerProfile; reuse it.");
        var p = new PartnerProfile { UserId = owner.Id, BusinessName = x.BusinessName, BusinessType = x.BusinessType, OwnerName = x.OwnerName, PhoneNumber = x.PhoneNumber, Email = owner.Email, Address = x.Address };
        await db.Entry(owner).Collection(u => u.Roles).LoadAsync();
        var partnerRole = await db.Roles.SingleOrDefaultAsync(r => r.Name == "Partner");
        if (partnerRole == null) return StatusCode(503, "Partner role is not configured.");
        if (!owner.Roles.Any(r => r.Name == "Partner")) owner.Roles.Add(partnerRole);
        db.Add(p); await db.SaveChangesAsync(); return Ok(new { p.Id, p.Status });
    }
    [Authorize(Roles = "Admin"), HttpPost("partners/{partnerId:guid}/requests")]
    public async Task<IActionResult> CreateRequest(Guid partnerId, PartnerRequestDto x)
    {
        if (!await db.PartnerProfiles.AnyAsync(p => p.Id == partnerId) || string.IsNullOrWhiteSpace(x.Title) || x.Title.Length > 250 || x.Price < 0 || x.Latitude is < -90 or > 90 || x.Longitude is < -180 or > 180) return BadRequest();
        var r = new PartnerContentRequest { PartnerId = partnerId, Title = x.Title, Content = x.Content, Price = x.Price, OpeningTime = x.OpeningTime, ClosingTime = x.ClosingTime, Location = x.Location, Latitude = x.Latitude, Longitude = x.Longitude };
        db.Add(r); await db.SaveChangesAsync(); return Ok(new { r.Id, r.Status });
    }
    [Authorize(Roles = "Admin"), HttpPost("partners/{id:guid}/owner")]
    public async Task<IActionResult> Handoff(Guid id, OwnerHandoffInput x)
    {
        if (string.IsNullOrWhiteSpace(x.Reason) || x.Reason.Length > 1000) return BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var p = await db.PartnerProfiles.FindAsync(id);
        if (p == null) return NotFound();
        if (p.UserId == x.OwnerUserId) return Ok(new { p.Id, ownerUserId = p.UserId });
        var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == x.OwnerUserId && u.IsActive);
        if (user == null || await db.PartnerProfiles.AnyAsync(v => v.UserId == x.OwnerUserId)) return Conflict("New owner must be active and not own another partner profile.");
        var role = await db.Roles.SingleAsync(r => r.Name == "Partner");
        if (!user.Roles.Any(r => r.Name == "Partner")) user.Roles.Add(role);
        db.Add(new PartnerOwnershipAudit { PartnerId = p.Id, PreviousOwnerId = p.UserId, NewOwnerId = user.Id, AdminId = Uid, Reason = x.Reason });
        p.UserId = user.Id; p.Email = user.Email; p.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { p.Id, ownerUserId = p.UserId, note = "Account ownership transferred. Review location staff memberships separately." });
    }
    [Authorize(Roles = "Admin"), HttpPost("requests/{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id)
    { var r = await db.PartnerContentRequests.FindAsync(id); if (r == null) return NotFound(); if (r.Status != "Draft") return Conflict(); r.Status = "Pending"; r.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(); return Ok(new { r.Status }); }
    [Authorize(Roles = "Admin"), HttpPost("locations")]
    public async Task<IActionResult> Location(ManualLocationInput x)
    {
        if (string.IsNullOrWhiteSpace(x.ConsentReference) || x.ConsentReference.Length > 1000 || !await db.PartnerContentRequests.AnyAsync(r => r.Id == x.SourceRequestId && r.PartnerId == x.PartnerId)) return BadRequest();
        var l = new PartnerLocation { PartnerId = x.PartnerId, SourceRequestId = x.SourceRequestId, ConsentReference = x.ConsentReference };
        db.Add(l); await db.SaveChangesAsync(); return Ok(new { l.Id, l.Status });
    }
    [Authorize(Roles = "Admin"), HttpGet("locations")]
    public async Task<IActionResult> Locations() => Ok(await db.Set<PartnerLocation>().AsNoTracking().Select(l => new { l.Id, l.PartnerId, l.SourceRequestId, l.Status, l.PublishedVersion, l.FreeStartsAt, l.FreeEndsAt, name = l.SourceRequest.Title, pendingSync = db.Set<PartnerPublication>().Any(e => e.LocationId == l.Id && e.ProcessedAt == null) }).ToListAsync());
    [Authorize(Roles = "Admin"), HttpPost("locations/{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var l = await db.Set<PartnerLocation>().Include(l => l.Partner).Include(l => l.SourceRequest).ThenInclude(r => r.Images).SingleOrDefaultAsync(l => l.Id == id);
        if (l == null) return NotFound(); var r = l.SourceRequest;
        if (l.Partner.Status != "Active" || r.Status != "Approved" || !r.Latitude.HasValue || !r.Longitude.HasValue || r.Latitude is < -90 or > 90 || r.Longitude is < -180 or > 180 || !r.Price.HasValue || r.Price < 0 || r.OpeningTime == null || r.ClosingTime == null || string.IsNullOrWhiteSpace(r.Location) || string.IsNullOrWhiteSpace(l.ConsentReference)) return BadRequest("Active partner, approved content, consent, GPS, price and opening hours are required.");
        l.Status = "PUBLISHED"; l.PublishedVersion++; l.ConfirmedBy = Uid; l.FreeStartsAt ??= DateTime.UtcNow; l.FreeEndsAt ??= l.FreeStartsAt.Value.AddYears(1);
        db.Add(new PartnerPublication { LocationId = id, Version = l.PublishedVersion, PayloadJson = JsonSerializer.Serialize(new { id = l.Id, partnerId = l.PartnerId, name = r.Title, address = r.Location, latitude = r.Latitude, longitude = r.Longitude, timeZone = l.TimeZone, imageUrl = r.Images.FirstOrDefault()?.ImageUrl ?? "", active = true, version = l.PublishedVersion }) });
        db.PartnerReviewAudits.Add(new PartnerReviewAudit { RequestId = r.Id, AdminId = Uid, OldStatus = r.Status, NewStatus = r.Status, Reason = $"PUBLISH location={l.Id} version={l.PublishedVersion}" });
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(new { l.Id, l.PublishedVersion, publicationStatus = "PENDING_SYNC" });
    }
    [Authorize(Roles = "Admin"), HttpPatch("locations/{id:guid}")]
    public async Task<IActionResult> LocationRevision(Guid id, LocationRevisionInput x)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var l = await db.Set<PartnerLocation>().FindAsync(id); if (l == null) return NotFound();
        if (l.PublishedVersion != x.ExpectedPublishedVersion) return Conflict("VERSION_CONFLICT");
        if (string.IsNullOrWhiteSpace(x.ConsentReference) || x.ConsentReference.Length > 1000 || !await db.PartnerContentRequests.AnyAsync(r => r.Id == x.SourceRequestId && r.PartnerId == l.PartnerId && r.Status == "Approved")) return BadRequest();
        l.SourceRequestId = x.SourceRequestId; l.ConsentReference = x.ConsentReference;
        db.PartnerReviewAudits.Add(new PartnerReviewAudit { RequestId = x.SourceRequestId, AdminId = Uid, OldStatus = "Approved", NewStatus = "Approved", Reason = $"LINK_REVISION location={id}" });
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(new { l.Id, l.PublishedVersion, note = "Publish location again to synchronize the approved revision." });
    }
    [Authorize(Roles = "Admin"), HttpPost("locations/{id:guid}/staff-invitations")]
    public async Task<IActionResult> Invite(Guid id, StaffInput x)
    {
        if (!await db.Set<PartnerLocation>().AnyAsync(l => l.Id == id) || !await db.Users.AnyAsync(u => u.Id == x.UserId && u.IsActive)) return BadRequest();
        var existing = await db.Set<PartnerLocationMember>().SingleOrDefaultAsync(m => m.LocationId == id && m.UserId == x.UserId);
        if (existing != null)
        {
            if (existing.Status != "REVOKED") return Conflict();
            existing.Status = "INVITED"; existing.InvitedBy = Uid; existing.AcceptedAt = null;
            await db.SaveChangesAsync(); return Ok(new { existing.Id, existing.Status });
        }
        var m = new PartnerLocationMember { UserId = x.UserId, LocationId = id, InvitedBy = Uid }; db.Add(m); await db.SaveChangesAsync(); return Ok(new { m.Id, m.Status });
    }
    [Authorize(Roles = "Admin"), HttpDelete("memberships/{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id)
    { var m = await db.Set<PartnerLocationMember>().FindAsync(id); if (m == null) return NotFound(); m.Status = "REVOKED"; await db.SaveChangesAsync(); return NoContent(); }
}
