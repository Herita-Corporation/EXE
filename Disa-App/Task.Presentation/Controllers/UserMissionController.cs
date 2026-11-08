using Microsoft.AspNetCore.Mvc;
using Task.Application.DTOs.Requests;
using Task.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;

namespace Task.Presentation.Controllers;

[ApiController]
[Authorize]
[Route("api/user-missions")]
public class UserMissionController : ControllerBase
{
    private readonly IUserMissionService _service;
    private readonly TaskDbContext _db;
    private readonly global::Task.Presentation.MissionTripGuard _guard;
    Guid CurrentUser => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public UserMissionController(IUserMissionService service, TaskDbContext db, global::Task.Presentation.MissionTripGuard guard)
    {
        _service = service;
        _db = db;
        _guard = guard;
    }

    [HttpPost("assign")]
    public async System.Threading.Tasks.Task<IActionResult> AssignMission(AssignMissionRequest request)
    {
        if (request.UserId != CurrentUser) return Forbid();
        try { await _guard.Validate(HttpContext, request.TripId, request.PlaceId, request); }
        catch (Task.Infrastructure.PartnerVouchers.VoucherError e) { return StatusCode(e.Status, new { code = e.Code, message = e.Message }); }
        var missionId = await _service.AssignMissionAsync(request);

        return Ok(new
        {
            MissionId = missionId,
            Message = "Mission assigned successfully."
        });
    }

    [HttpGet("user/{userId}")]
    public async System.Threading.Tasks.Task<IActionResult> GetByUser(Guid userId)
    {
        if (userId != CurrentUser) return Forbid();
        var result = await _service.GetUserMissionsAsync(userId);

        return Ok(result);
    }

    [HttpGet("user/{userId}/summary")]
    public async System.Threading.Tasks.Task<IActionResult> GetSummary(Guid userId)
    {
        if (userId != CurrentUser) return Forbid();
        var result = await _service.GetSummaryAsync(userId);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> GetById(Guid id)
    {
        if (!await _db.UserMissions.AnyAsync(m => m.Id == id && m.UserId == CurrentUser)) return NotFound();
        var result = await _service.GetMissionByIdAsync(id);

        if (result == null)
            return NotFound();

        return Ok(result);
    }

    // User deletes one mission from the Missions screen.
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> Delete(Guid id)
    {
        if (!await _db.UserMissions.AnyAsync(m => m.Id == id && m.UserId == CurrentUser)) return NotFound();
        try
        {
            await _service.DeleteMissionAsync(id);
        }
        catch (InvalidOperationException ex)
        {
            // Completed missions are kept.
            return BadRequest(new { Message = ex.Message });
        }

        return Ok(new { Success = true });
    }

    // Called when an itinerary is deleted — removes the still-active
    // missions assigned under it (completed ones are kept).
    [HttpDelete("trip/{tripId}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteForTrip(Guid tripId)
    {
        if (await _db.UserMissions.AnyAsync(m => m.TripId == tripId && m.UserId != CurrentUser)) return Forbid();
        await _service.DeleteMissionsForTripAsync(tripId);

        return Ok(new { Success = true });
    }

    // Called after a new itinerary is created — removes the still-active
    // missions of itineraries that no longer exist (trip not in KeepTripIds).
    // Completed ones are kept, like DeleteForTrip.
    [HttpPost("user/{userId}/prune")]
    public async System.Threading.Tasks.Task<IActionResult> Prune(Guid userId, PruneMissionsRequest request)
    {
        if (userId != CurrentUser) return Forbid();
        await _service.PruneMissionsAsync(userId, request.KeepTripIds);

        return Ok(new { Success = true });
    }

    // Full reset for one user — deletes every mission, including completed
    // ones. Restricted to the same authenticated user for account cleanup.
    [Authorize]
    [HttpDelete("user/{userId}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteAllForUser(Guid userId)
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var authenticatedUserId) || authenticatedUserId != userId)
            return Forbid();

        await _service.DeleteAllMissionsForUserAsync(userId);

        return Ok(new { Success = true });
    }
}
