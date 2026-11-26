using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;
using Task.Domain.Enums;

namespace Task.Presentation.Controllers;
public record MissionReviewInput(bool Approved);
[ApiController, Authorize(Roles = "Admin"), Route("api/mission-reviews")]
public class MissionReviewController(TaskDbContext db) : ControllerBase
{
    [HttpGet] public async System.Threading.Tasks.Task<IActionResult> Pending() => Ok(await db.MissionSubmissions.AsNoTracking().Where(s => s.VerificationStatus == VerificationStatus.Pending).OrderBy(s => s.SubmittedAt).Take(50)
        .Select(s => new { s.Id, s.UserMissionId, s.UserMission.Title, s.SubmittedAt, evidence = s.Evidences.Select(e => new { e.Type, e.MediaUrl }) }).ToListAsync());
    [HttpPost("{id:guid}")]
    public async System.Threading.Tasks.Task<IActionResult> Review(Guid id, MissionReviewInput input)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var s = await db.MissionSubmissions.Include(s => s.UserMission).SingleOrDefaultAsync(s => s.Id == id);
        if (s == null) return NotFound();
        if (s.VerificationStatus != VerificationStatus.Pending || s.UserMission.Status != MissionStatus.PendingReview) return Conflict();
        s.VerificationStatus = input.Approved ? VerificationStatus.Approved : VerificationStatus.Rejected;
        s.UserMission.Status = input.Approved ? MissionStatus.Completed : MissionStatus.Assigned;
        s.UserMission.CompletedAt = input.Approved ? DateTime.UtcNow : null;
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Ok(new { s.UserMission.Status });
    }
}
