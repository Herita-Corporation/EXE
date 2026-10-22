using Microsoft.AspNetCore.Mvc;
using Task.Application.DTOs.Requests;
using Task.Application.Interfaces.Services;

namespace Task.Presentation.Controllers;

[ApiController]
[Route("api/mission-submissions")]
public class MissionSubmissionController : ControllerBase
{
    private readonly IMissionSubmissionService _service;

    public MissionSubmissionController(IMissionSubmissionService service)
    {
        _service = service;
    }

    [HttpPost("{userMissionId}")]
    public async System.Threading.Tasks.Task<IActionResult> SubmitMission(
        Guid userMissionId,
        [FromForm] SubmitMissionRequest request)
    {
        Guid submissionId;
        try
        {
            submissionId = await _service.SubmitMissionAsync(userMissionId, request);
        }
        catch (InvalidOperationException ex)
        {
            // Location check failed — mission stays Assigned, no reward.
            return BadRequest(new { Message = ex.Message });
        }

        return Ok(new
        {
            SubmissionId = submissionId,
            Message = "Mission submitted successfully."
        });
    }
}