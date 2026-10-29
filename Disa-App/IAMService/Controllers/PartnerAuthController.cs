using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace IAMService.Controllers;
public record PartnerRegisterDto(string Username,string Email,string Password,string BusinessName,string BusinessType,string OwnerName,string PhoneNumber,string Address,string? TaxCode);
public record PartnerLoginDto(string Email,string Password);
[ApiController][Route("api/partner-auth")]
public class PartnerAuthController(IAMDbContext db,BCryptPassworkHasher hasher,JwtTokenGenerator jwt):ControllerBase {
 [HttpPost("register")] public async Task<IActionResult> Register(PartnerRegisterDto x){
 if(string.IsNullOrWhiteSpace(x.Email)||string.IsNullOrWhiteSpace(x.BusinessName)||x.Password.Length<8)return BadRequest("Invalid registration data");
 if(await db.Users.AnyAsync(u=>u.Email==x.Email||u.Username==x.Username))return Conflict("Account already exists");
 var role=await db.Roles.FirstOrDefaultAsync(r=>r.Name=="Partner");if(role==null)return StatusCode(503,"Partner role not configured");
 var user=new User{Id=Guid.NewGuid(),Username=x.Username,Email=x.Email,PasswordHash=hasher.Hash(x.Password),IsActive=true,CreatedAt=DateTime.UtcNow};user.Roles.Add(role);
 await using var tx=await db.Database.BeginTransactionAsync();db.Users.Add(user);
 db.PartnerProfiles.Add(new PartnerProfile{UserId=user.Id,BusinessName=x.BusinessName,BusinessType=x.BusinessType,OwnerName=x.OwnerName,PhoneNumber=x.PhoneNumber,Email=x.Email,Address=x.Address,TaxCode=x.TaxCode});await db.SaveChangesAsync();await tx.CommitAsync();return Ok(new{user.Id,Status="PendingApproval"}); }
 [HttpPost("login")] public async Task<IActionResult> Login(PartnerLoginDto x){var user=await db.Users.Include(u=>u.Roles).ThenInclude(r=>r.Permissions).FirstOrDefaultAsync(u=>u.Email==x.Email);if(user==null||!user.IsActive||!user.Roles.Any(r=>r.Name=="Partner")||string.IsNullOrEmpty(user.PasswordHash)||!hasher.Verify(x.Password,user.PasswordHash))return Unauthorized();var profile=await db.PartnerProfiles.FirstOrDefaultAsync(p=>p.UserId==user.Id);if(profile==null||profile.Status!="Active")return StatusCode(403,new{message="Partner account not yet approved or suspended",status=profile?.Status});return Ok(new{AccessToken=jwt.Generate(user)});}
}
