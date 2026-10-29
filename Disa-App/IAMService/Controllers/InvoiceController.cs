using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace IAMService.Controllers;
public record CreateInvoiceDto(Guid PartnerId,decimal Amount,string? Description,DateTime? DueAt);
[ApiController][Authorize][Route("api/invoices")]
public class InvoiceController(IAMDbContext db):ControllerBase {
 bool Admin=>User.IsInRole("Admin");Guid Uid=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
 [HttpPost][Authorize(Roles="Admin")]public async Task<IActionResult> Create(CreateInvoiceDto x){if(x.Amount<0||!await db.PartnerProfiles.AnyAsync(p=>p.Id==x.PartnerId))return BadRequest();var i=new PartnerInvoice{PartnerId=x.PartnerId,Amount=x.Amount,Description=x.Description,DueAt=x.DueAt,InvoiceNumber="DISA-"+DateTime.UtcNow.ToString("yyyyMMdd")+"-"+Guid.NewGuid().ToString("N")[..8]};db.PartnerInvoices.Add(i);await db.SaveChangesAsync();return Ok(new{i.Id,i.InvoiceNumber});}
 [HttpGet][Authorize(Roles="Admin")]public async Task<IActionResult> All()=>Ok(await db.PartnerInvoices.AsNoTracking().ToListAsync());
 [HttpGet("my")][Authorize(Roles="Partner")]public async Task<IActionResult> My()=>Ok(await db.PartnerInvoices.AsNoTracking().Where(i=>i.Partner.UserId==Uid).ToListAsync());
 [HttpGet("{id:guid}")]public async Task<IActionResult> Get(Guid id){var i=await db.PartnerInvoices.AsNoTracking().Where(i=>i.Id==id&&(Admin||i.Partner.UserId==Uid)).Select(i=>new{i.Id,i.InvoiceNumber,i.Amount,i.Description,i.Status,i.IssuedAt,i.DueAt,i.PaidAt}).FirstOrDefaultAsync();return i==null?NotFound():Ok(i);}
 [HttpPatch("{id:guid}/paid")][Authorize(Roles="Admin")]public async Task<IActionResult> Paid(Guid id){var i=await db.PartnerInvoices.FindAsync(id);if(i==null)return NotFound();if(i.Status!="Unpaid"&&i.Status!="Overdue")return Conflict();i.Status="Paid";i.PaidAt=DateTime.UtcNow;await db.SaveChangesAsync();return NoContent();}
}
