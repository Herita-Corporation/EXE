using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;

namespace Task.Presentation.Controllers;
[ApiController, Authorize, Route("api/mission-media")]
public class MissionMediaController(TaskDbContext db, Oc3IamAccess access) : ControllerBase
{
    [HttpGet("{kind}/{name}")]
    public async System.Threading.Tasks.Task<IActionResult> Read(string kind, string name)
    {
        await access.Check(HttpContext);
        if (kind is not ("images" or "videos") || name != Path.GetFileName(name) || !Guid.TryParse(Path.GetFileNameWithoutExtension(name), out _)) return NotFound();
        var uid = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (!await db.MissionEvidences.AnyAsync(e => e.MediaUrl.EndsWith("/" + name) && (e.Submission.UserMission.UserId == uid || User.IsInRole("Admin")))) return NotFound();
        var path = Path.GetFullPath(Path.Combine("PrivateUploads", kind == "images" ? "Images" : "Videos", name));
        if (!System.IO.File.Exists(path)) return NotFound();
        Response.Headers.CacheControl = "private, no-store";
        var ext = Path.GetExtension(name).ToLowerInvariant();
        var mime = ext switch { ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", ".mov" => "video/quicktime", ".mp4" => "video/mp4", _ => "application/octet-stream" };
        return PhysicalFile(path, mime, enableRangeProcessing: true);
    }
}
