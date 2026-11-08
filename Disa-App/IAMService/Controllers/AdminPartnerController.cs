using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace IAMService.Controllers;
public record ReviewDto(bool IsApproved,string? Reason);
public record PartnerStatusDto(string Status);
public record LockUserDto(bool IsLocked);
[ApiController][Authorize(Roles="Admin")][Route("api/admin/partner-portal")]
public class AdminPartnerController(IAMDbContext db):ControllerBase {
 [HttpGet("dashboard")]public async Task<IActionResult> Dashboard()=>Ok(new{TotalUsers=await db.Users.CountAsync(),TotalPartners=await db.PartnerProfiles.CountAsync(),PendingRequests=await db.PartnerContentRequests.CountAsync(r=>r.Status=="Pending"),ApprovedRequests=await db.PartnerContentRequests.CountAsync(r=>r.Status=="Approved"),TotalInvoices=await db.PartnerInvoices.CountAsync(),TotalPaid=await db.PartnerInvoices.Where(i=>i.Status=="Paid").SumAsync(i=>(decimal?)i.Amount)??0});
 [HttpGet("users")]public async Task<IActionResult> Users(int page=1,int size=20){page=Math.Max(1,page);size=Math.Clamp(size,1,100);return Ok(await db.Users.AsNoTracking().OrderBy(x=>x.CreatedAt).Skip((page-1)*size).Take(size).Select(x=>new{x.Id,x.Username,x.Email,x.IsActive,x.CreatedAt}).ToListAsync());}
 [HttpPatch("users/{id:guid}/lock")]public async Task<IActionResult> Lock(Guid id,LockUserDto x){var u=await db.Users.FindAsync(id);if(u==null)return NotFound();if(u.Id==Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!))return BadRequest("Cannot lock yourself");u.IsActive=!x.IsLocked;await db.SaveChangesAsync();return NoContent();}
 [HttpGet("partners")]public async Task<IActionResult> Partners()=>Ok(await db.PartnerProfiles.AsNoTracking().Select(x=>new{x.Id,x.BusinessName,x.OwnerName,x.Email,x.Status,x.CreatedAt}).ToListAsync());
 [HttpPatch("partners/{id:guid}/status")]public async Task<IActionResult> Status(Guid id,PartnerStatusDto x){if(!new[]{"PendingApproval","Active","Rejected","Suspended"}.Contains(x.Status))return BadRequest();var p=await db.PartnerProfiles.FindAsync(id);if(p==null)return NotFound();p.Status=x.Status;p.UpdatedAt=DateTime.UtcNow;await db.SaveChangesAsync();return NoContent();}
 [HttpGet("requests")]public async Task<IActionResult> Requests(string? status=null)=>Ok(await db.PartnerContentRequests.AsNoTracking().Where(x=>status==null||x.Status==status).OrderByDescending(x=>x.CreatedAt).Select(x=>new{x.Id,x.PartnerId,x.Title,x.Status,x.CreatedAt}).ToListAsync());
 [HttpGet("requests/{id:guid}")]public async Task<IActionResult> Request(Guid id){var r=await db.PartnerContentRequests.AsNoTracking().Include(x=>x.Images).FirstOrDefaultAsync(x=>x.Id==id);return r==null?NotFound():Ok(r);}
 [HttpPost("requests/{id:guid}/review")]public async Task<IActionResult> Review(Guid id,ReviewDto x){if(!x.IsApproved&&string.IsNullOrWhiteSpace(x.Reason))return BadRequest("Reason required");await using var tx=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);var r=await db.PartnerContentRequests.FirstOrDefaultAsync(x=>x.Id==id);if(r==null)return NotFound();if(r.Status!="Pending")return Conflict("Request is not pending");var old=r.Status;r.Status=x.IsApproved?"Approved":"Rejected";r.RejectReason=x.IsApproved?null:x.Reason;r.ReviewedAt=DateTime.UtcNow;r.ReviewedBy=Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);r.UpdatedAt=DateTime.UtcNow;db.PartnerReviewAudits.Add(new PartnerReviewAudit{RequestId=id,AdminId=r.ReviewedBy.Value,OldStatus=old,NewStatus=r.Status,Reason=x.Reason});await db.SaveChangesAsync();await tx.CommitAsync();return Ok(new{r.Status});}
}
