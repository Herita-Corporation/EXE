using System;
using System.Threading;
using System.Threading.Tasks;
using AITour.Application.Interfaces;
using AITour.Infrastructure.ExternalServices.AIItinerary.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AITour.Presentation.Controllers;

/// <summary>
/// AITour Controller — proxy endpoints that forward requests to the AI-Itinerary Python microservice.
/// 
/// Authentication: JWT Bearer token issued by IAMService.
/// The token is forwarded to AI-Itinerary which extracts user_id from claims.
/// </summary>
[ApiController]
[Route("api/v1/itinerary")]
[Authorize]
public class AITourController : ControllerBase
{
    private readonly IAIItineraryService _aiItineraryService;

    public AITourController(IAIItineraryService aiItineraryService)
    {
        _aiItineraryService = aiItineraryService;
    }

    // ── Helper: extract raw Bearer token ─────────────────────────────────────

    private string GetBearerToken()
    {
        var authHeader = HttpContext.Request.Headers["Authorization"].ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
            throw new UnauthorizedAccessException("Bearer token is required.");
        return authHeader["Bearer ".Length..].Trim();
    }

    // ── POST /api/v1/itinerary/generate ───────────────────────────────────────

    /// <summary>
    /// Generates a personalized travel itinerary via AI-Itinerary service.
    /// user_id is automatically extracted from the JWT Bearer token.
    /// </summary>
    /// <param name="request">Trip parameters: cities, budget, dates, preferences.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ItineraryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GenerateItinerary(
        [FromBody] GenerateItineraryRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = GetBearerToken();
            var result = await _aiItineraryService.GenerateAsync(request, token, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("rate limit"))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { Success = false, Message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { Success = false, Message = "AI-Itinerary service is unavailable.", Detail = ex.Message });
        }
    }

    // ── GET /api/v1/itinerary/{id} ────────────────────────────────────────────

    /// <summary>
    /// Retrieves a previously generated itinerary by its UUID.
    /// </summary>
    [HttpGet("{itineraryId:guid}")]
    [ProducesResponseType(typeof(ItineraryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItinerary(
        Guid itineraryId,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = GetBearerToken();
            var result = await _aiItineraryService.GetByIdAsync(itineraryId, token, cancellationToken);
            if (result is null) return NotFound(new { Success = false, Message = "Itinerary not found." });
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Success = false, Message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { Success = false, Message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { Success = false, Message = "AI-Itinerary service is unavailable.", Detail = ex.Message });
        }
    }

    // ── DELETE /api/v1/itinerary/{id} ─────────────────────────────────────────

    /// <summary>
    /// Deletes a generated itinerary by its UUID.
    /// </summary>
    [HttpDelete("{itineraryId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteItinerary(
        Guid itineraryId,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = GetBearerToken();
            var success = await _aiItineraryService.DeleteAsync(itineraryId, token, cancellationToken);
            if (!success) return NotFound(new { Success = false, Message = "Itinerary not found." });
            return Ok(new { Success = true });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Success = false, Message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { Success = false, Message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { Success = false, Message = "AI-Itinerary service is unavailable.", Detail = ex.Message });
        }
    }

    // ── GET /api/v1/itinerary/{id}/activities/{activityId}/alternatives ──────

    /// <summary>
    /// Suggests AI alternative places for one activity slot, so the user can
    /// swap a GPT-suggested place for one that suits them better.
    /// </summary>
    [HttpGet("{itineraryId:guid}/activities/{activityId}/alternatives")]
    [ProducesResponseType(typeof(ActivityAlternativesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetActivityAlternatives(
        Guid itineraryId,
        string activityId,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = GetBearerToken();
            var result = await _aiItineraryService.GetActivityAlternativesAsync(
                itineraryId, activityId, token, cancellationToken);
            if (result is null) return NotFound(new { Success = false, Message = "Not found." });
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Success = false, Message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { Success = false, Message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { Success = false, Message = "AI-Itinerary service is unavailable.", Detail = ex.Message });
        }
    }

    // ── PATCH /api/v1/itinerary/{id}/activities/{activityId} ─────────────────

    /// <summary>
    /// Replaces one activity's place with a chosen alternative.
    /// </summary>
    [HttpPatch("{itineraryId:guid}/activities/{activityId}")]
    [ProducesResponseType(typeof(ItineraryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReplaceActivity(
        Guid itineraryId,
        string activityId,
        [FromBody] ActivityAlternative request,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = GetBearerToken();
            var result = await _aiItineraryService.ReplaceActivityAsync(
                itineraryId, activityId, request, token, cancellationToken);
            if (result is null) return NotFound(new { Success = false, Message = "Not found." });
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Success = false, Message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { Success = false, Message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { Success = false, Message = "AI-Itinerary service is unavailable.", Detail = ex.Message });
        }
    }
}
