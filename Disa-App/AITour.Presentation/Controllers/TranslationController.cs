using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AITour.Application.Interfaces;
using AITour.Infrastructure.ExternalServices.Translation;
using AITour.Infrastructure.ExternalServices.Translation.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AITour.Presentation.Controllers;

/// <summary>
/// Bahnar (Ba Na) → Vietnamese translation — proxy to the Bahnar-Translator Python service.
///
/// Flow: App (user JWT) → AITourService (this controller, validates JWT + input)
///       → Bahnar-Translator (service key X-API-Key, internal network) → JSON.
/// The app never sees the translator URL or its key.
/// </summary>
[ApiController]
[Route("api/v1/translate")]
[Authorize]
public class TranslationController : ControllerBase
{
    private const int MaxTextLength = 1000;
    private const long MaxAudioBytes = 10 * 1024 * 1024;   // same limit as the translator

    // Formats the translator can decode (wav/flac/ogg natively; the rest via ffmpeg in its Docker image).
    private static readonly string[] AllowedAudioExtensions =
        { ".wav", ".m4a", ".mp4", ".aac", ".mp3", ".ogg", ".oga", ".opus", ".webm", ".flac", ".3gp", ".caf" };

    private readonly ITranslationService _translationService;

    public TranslationController(ITranslationService translationService)
    {
        _translationService = translationService;
    }

    // ── GET /api/v1/translate/status ──────────────────────────────────────────

    /// <summary>Whether translation is available (lets the app hide/disable the feature gracefully).</summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(TranslationStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
        => Ok(await _translationService.GetStatusAsync(cancellationToken));

    // ── POST /api/v1/translate/text ───────────────────────────────────────────

    /// <summary>Translates Bahnar text into Vietnamese.</summary>
    [HttpPost("text")]
    [ProducesResponseType(typeof(TextTranslationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> TranslateText(
        [FromBody] TranslateTextRequest request,
        CancellationToken cancellationToken)
    {
        var text = request.Text?.Trim() ?? "";
        if (text.Length == 0)
            return BadRequest(new { Success = false, Message = "Vui lòng nhập văn bản tiếng Ba Na." });
        if (text.Length > MaxTextLength)
            return BadRequest(new { Success = false, Message = $"Văn bản quá dài (tối đa {MaxTextLength} ký tự)." });

        try
        {
            return Ok(await _translationService.TranslateTextAsync(text, request.Synthesize, cancellationToken));
        }
        catch (TranslatorException ex)
        {
            return StatusCode(ex.StatusCode, new { Success = false, Message = ex.Message });
        }
    }

    // ── POST /api/v1/translate/speech ─────────────────────────────────────────

    /// <summary>
    /// Bahnar speech (multipart field "audio", ≤ 10 MB, ≤ 30 s) → Bahnar transcript + Vietnamese translation.
    /// When the response has rejected = true, show its message and ask the user to speak again.
    /// </summary>
    [HttpPost("speech")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxAudioBytes + 1024 * 1024)]   // + room for multipart headers
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes + 1024 * 1024)]
    [ProducesResponseType(typeof(SpeechTranslationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> TranslateSpeech(
        [FromForm] SpeechTranslationForm form,
        CancellationToken cancellationToken)
    {
        var audio = form.Audio;
        if (audio is null || audio.Length == 0)
            return BadRequest(new { Success = false, Message = "Thiếu file âm thanh." });
        if (audio.Length > MaxAudioBytes)
            return StatusCode(StatusCodes.Status413PayloadTooLarge,
                new { Success = false, Message = "File âm thanh quá lớn (tối đa 10 MB)." });

        var extension = Path.GetExtension(audio.FileName ?? "").ToLowerInvariant();
        var isAudioType = audio.ContentType?.StartsWith("audio/", StringComparison.OrdinalIgnoreCase) == true;
        if (!AllowedAudioExtensions.Contains(extension) && !isAudioType)
            return BadRequest(new { Success = false, Message = "Định dạng âm thanh không được hỗ trợ." });

        try
        {
            await using var stream = audio.OpenReadStream();
            var result = await _translationService.TranslateSpeechAsync(
                stream, audio.FileName ?? "audio" + extension, audio.ContentType ?? "application/octet-stream",
                form.Synthesize, cancellationToken);
            return Ok(result);
        }
        catch (TranslatorException ex)
        {
            return StatusCode(ex.StatusCode, new { Success = false, Message = ex.Message });
        }
    }
}

/// <summary>Multipart form for /api/v1/translate/speech (a class, so Swagger can describe the file upload).</summary>
public class SpeechTranslationForm
{
    /// <summary>Recorded Bahnar speech: m4a/wav/mp3/ogg/webm/flac…</summary>
    public IFormFile? Audio { get; set; }

    /// <summary>Also return Vietnamese speech (only if the translator has TTS enabled).</summary>
    public bool Synthesize { get; set; }
}
