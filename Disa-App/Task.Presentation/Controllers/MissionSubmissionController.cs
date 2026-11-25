using Microsoft.AspNetCore.Mvc;
using Task.Application.DTOs.Requests;
using Task.Application.Interfaces.Services;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;

namespace Task.Presentation.Controllers;

[ApiController]
[Authorize]
[Route("api/mission-submissions")]
public class MissionSubmissionController : ControllerBase
{
    private readonly IMissionSubmissionService _service;
    private readonly TaskDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly global::Task.Presentation.MissionTripGuard _guard;

    public MissionSubmissionController(IMissionSubmissionService service, TaskDbContext db, IConfiguration configuration, global::Task.Presentation.MissionTripGuard guard)
    {
        _service = service;
        _db = db;
        _configuration = configuration;
        _guard = guard;
    }

    [HttpPost("{userMissionId}")]
    public async System.Threading.Tasks.Task<IActionResult> SubmitMission(
        Guid userMissionId,
        [FromForm] SubmitMissionRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var current = await _db.UserMissions.AsNoTracking().SingleOrDefaultAsync(m => m.Id == userMissionId && m.UserId == userId);
        if (current == null) return NotFound();
        Guid submissionId;
        try
        {
            var validated = new AssignMissionRequest();
            await _guard.Validate(HttpContext, current.TripId, current.PlaceId, validated, submitting: true);
            if (request.Photo != null) await global::Task.Presentation.MissionMediaValidator.Photo(request.Photo);
            if (request.Video != null)
            {
                var duration = await global::Task.Presentation.MissionMediaValidator.Duration(request.Video, _configuration["MissionValidation:FfprobePath"] ?? "ffprobe", HttpContext.RequestAborted);
                request.VideoDurationSeconds = (int)Math.Floor(duration);
            }
            await using var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            await _db.Database.ExecuteSqlInterpolatedAsync($@"DECLARE @r int; EXEC @r=sp_getapplock @Resource={"disa:mission-submit:" + userMissionId}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000,'Mission lock unavailable',1;");
            var authoritativeMission = await _db.UserMissions.FindAsync(userMissionId);
            authoritativeMission!.TargetLatitude = validated.TargetLatitude;
            authoritativeMission.TargetLongitude = validated.TargetLongitude;
            submissionId = await _service.SubmitMissionAsync(userMissionId, request);
            // Media presence/GPS are not proof of photo content. No reward is
            // awarded until an administrator reviews the submission.
            var mission = await _db.UserMissions.FindAsync(userMissionId);
            var submission = await _db.MissionSubmissions.FindAsync(submissionId);
            mission!.Status = global::Task.Domain.Enums.MissionStatus.PendingReview;
            mission.CompletedAt = null;
            submission!.VerificationStatus = global::Task.Domain.Enums.VerificationStatus.Pending;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (InvalidOperationException ex)
        {
            // Location check failed — mission stays Assigned, no reward.
            return BadRequest(new { Message = ex.Message });
        }
        catch (global::Task.Infrastructure.PartnerVouchers.VoucherError ex)
        { return StatusCode(ex.Status, new { code = ex.Code, message = ex.Message }); }
        catch (System.ComponentModel.Win32Exception)
        { return StatusCode(503, new { code = "MEDIA_VALIDATOR_UNAVAILABLE", message = "Máy chủ chưa có công cụ xác minh video. Không cộng điểm khi chưa xác minh." }); }

        return Ok(new
        {
            SubmissionId = submissionId,
            Message = "Mission submitted successfully."
        });
    }
}
