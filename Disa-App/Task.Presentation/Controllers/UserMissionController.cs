using Microsoft.AspNetCore.Mvc;
using Task.Application.DTOs.Requests;
using Task.Application.Interfaces.Services;

namespace Task.Presentation.Controllers;

[ApiController]
[Route("api/user-missions")]
public class UserMissionController : ControllerBase
{
    private readonly IUserMissionService _service;

    public UserMissionController(IUserMissionService service)
    {
        _service = service;
    }

    [HttpPost("assign")]
    public async System.Threading.Tasks.Task<IActionResult> AssignMission(AssignMissionRequest request)
    {
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
        var result = await _service.GetUserMissionsAsync(userId);

        return Ok(result);
    }

    [HttpGet("user/{userId}/summary")]
    public async System.Threading.Tasks.Task<IActionResult> GetSummary(Guid userId)
    {
        var result = await _service.GetSummaryAsync(userId);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetMissionByIdAsync(id);

        if (result == null)
            return NotFound();

        return Ok(result);
    }

    // User deletes one mission from the Missions screen.
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> Delete(Guid id)
    {
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
        await _service.DeleteMissionsForTripAsync(tripId);

        return Ok(new { Success = true });
    }

    // Called after a new itinerary is created — removes the still-active
    // missions of itineraries that no longer exist (trip not in KeepTripIds).
    // Completed ones are kept, like DeleteForTrip.
    [HttpPost("user/{userId}/prune")]
    public async System.Threading.Tasks.Task<IActionResult> Prune(Guid userId, PruneMissionsRequest request)
    {
        await _service.PruneMissionsAsync(userId, request.KeepTripIds);

        return Ok(new { Success = true });
    }

    // Full reset for one user — deletes every mission, including completed
    // ones. Not exposed in the app's UI today; used for account cleanup.
    [HttpDelete("user/{userId}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteAllForUser(Guid userId)
    {
        await _service.DeleteAllMissionsForUserAsync(userId);

        return Ok(new { Success = true });
    }
}