using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace IAMService.Controllers;
public record UpdatePartnerDto(string BusinessName,string BusinessType,string OwnerName,string PhoneNumber,string Address,string? TaxCode);
[ApiController][Authorize(Roles="Partner")][Route("api/partner")]
public class PartnerController(IAMDbContext db):ControllerBase {
 Guid Uid=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
 [HttpGet("me")] public async Task<IActionResult> Me(){var p=await db.PartnerProfiles.AsNoTracking().Where(x=>x.UserId==Uid).Select(x=>new{x.Id,x.BusinessName,x.BusinessType,x.OwnerName,x.PhoneNumber,x.Email,x.Address,x.TaxCode,x.Status}).FirstOrDefaultAsync();return p==null?NotFound():Ok(p);}
 [HttpPut("me")]public async Task<IActionResult> Update(UpdatePartnerDto x){var p=await db.PartnerProfiles.FirstOrDefaultAsync(v=>v.UserId==Uid);if(p==null)return NotFound();p.BusinessName=x.BusinessName;p.BusinessType=x.BusinessType;p.OwnerName=x.OwnerName;p.PhoneNumber=x.PhoneNumber;p.Address=x.Address;p.TaxCode=x.TaxCode;p.UpdatedAt=DateTime.UtcNow;await db.SaveChangesAsync();return NoContent();}
 [HttpGet("dashboard")]public async Task<IActionResult> Dashboard(){var p=await db.PartnerProfiles.FirstOrDefaultAsync(v=>v.UserId==Uid);if(p==null)return NotFound();return Ok(new{TotalRequests=await db.PartnerContentRequests.CountAsync(x=>x.PartnerId==p.Id),PendingRequests=await db.PartnerContentRequests.CountAsync(x=>x.PartnerId==p.Id&&x.Status=="Pending"),Invoices=await db.PartnerInvoices.CountAsync(x=>x.PartnerId==p.Id)});}
}
