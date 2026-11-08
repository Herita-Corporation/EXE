using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.PartnerVouchers;

namespace Task.Presentation.Controllers;
[ApiController, AllowAnonymous, Route("api/v2/internal/locations")]
public class PartnerLocationSyncController(TaskDbContext db, IConfiguration config) : ControllerBase
{
    [HttpPost]
    public async System.Threading.Tasks.Task<IActionResult> Sync(LocationSnapshot input)
    {
        var expected = config["PartnerVouchers:SyncKey"];
        var given = Request.Headers["X-Disa-Sync-Key"].ToString();
        if (string.IsNullOrWhiteSpace(expected) || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(expected)), SHA256.HashData(Encoding.UTF8.GetBytes(given)))) return Unauthorized();
        if (input.Id == Guid.Empty || input.PartnerId == Guid.Empty || input.Version < 1 || input.Latitude is < -90 or > 90 || input.Longitude is < -180 or > 180 || input.Name.Length > 250 || input.Address.Length > 1000) return BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var current = await db.Set<LocationSnapshot>().SingleOrDefaultAsync(l => l.Id == input.Id);
        if (current == null) db.Add(input);
        else if (input.Version > current.Version)
        {
            if (current.PartnerId != input.PartnerId) return Conflict();
            db.Entry(current).CurrentValues.SetValues(input);
        }
        await db.SaveChangesAsync(); await tx.CommitAsync(); return NoContent();
    }
}
