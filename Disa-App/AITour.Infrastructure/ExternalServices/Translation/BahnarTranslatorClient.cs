using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AITour.Infrastructure.ExternalServices.Translation.Models;
using Microsoft.Extensions.Logging;

namespace AITour.Infrastructure.ExternalServices.Translation;

/// <summary>
/// Thrown when the translator rejects or cannot serve a request. <see cref="StatusCode"/> is the
/// status AITour should return to the app; <see cref="Exception.Message"/> is safe to show users
/// (never contains the API key or internal URLs).
/// </summary>
public class TranslatorException : Exception
{
    public int StatusCode { get; }

    public TranslatorException(int statusCode, string message, Exception? inner = null)
        : base(message, inner) => StatusCode = statusCode;
}

/// <summary>
/// HTTP client for the Bahnar-Translator Python microservice (Bahnar → Vietnamese).
///
/// Authentication strategy (different from AIItineraryClient on purpose):
/// - The app's user JWT is validated HERE, by AITour ([Authorize] on TranslationController).
/// - AITour → translator uses a shared service key (header X-API-Key), because the translator
///   has no notion of users. The key lives only in server config (Translator__ApiKey).
/// Headers are set per request (not on DefaultRequestHeaders) so concurrent calls never race.
/// </summary>
public class BahnarTranslatorClient
{
    private readonly HttpClient _httpClient;
    private readonly TranslatorOptions _options;
    private readonly ILogger<BahnarTranslatorClient> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public BahnarTranslatorClient(HttpClient httpClient, TranslatorOptions options, ILogger<BahnarTranslatorClient> logger)
    {
        _httpClient = httpClient;
        _options = options;
        _logger = logger;
    }

    public bool IsConfigured => _options.IsConfigured;

    // ── Text: Bahnar → Vietnamese ─────────────────────────────────────────────

    public async Task<TextTranslationResponse> TranslateTextAsync(
        string text, bool synthesize, CancellationToken cancellationToken = default)
    {
        using var request = NewRequest(HttpMethod.Post, "/v1/translate/bahnar-text");
        request.Content = JsonContent.Create(new TranslateTextRequest { Text = text, Synthesize = synthesize });

        // Log sizes only — user text may be personal.
        _logger.LogInformation("Translator text: chars={Chars}, synthesize={Synth}", text.Length, synthesize);
        return await SendAsync<TextTranslationResponse>(request, "TranslateText", cancellationToken);
    }

    // ── Speech: Bahnar audio → transcript + Vietnamese ────────────────────────

    public async Task<SpeechTranslationResponse> TranslateSpeechAsync(
        Stream audio, string fileName, string contentType, bool synthesize,
        CancellationToken cancellationToken = default)
    {
        using var request = NewRequest(HttpMethod.Post, "/v1/translate/bahnar-speech");
        var form = new MultipartFormDataContent();
        var file = new StreamContent(audio);
        file.Headers.ContentType = MediaTypeHeaderValue.TryParse(contentType, out var ct)
            ? ct
            : new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "audio", string.IsNullOrWhiteSpace(fileName) ? "audio.m4a" : Path.GetFileName(fileName));
        form.Add(new StringContent(synthesize ? "true" : "false"), "synthesize");
        request.Content = form;

        _logger.LogInformation("Translator speech: file={File}, type={Type}, synthesize={Synth}",
            Path.GetExtension(fileName), contentType, synthesize);
        return await SendAsync<SpeechTranslationResponse>(request, "TranslateSpeech", cancellationToken);
    }

    // ── Health ────────────────────────────────────────────────────────────────

    public async Task<TranslatorHealthResponse?> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        using var request = NewRequest(HttpMethod.Get, "/healthz");
        return await SendAsync<TranslatorHealthResponse>(request, "Health", cancellationToken);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private HttpRequestMessage NewRequest(HttpMethod method, string path)
    {
        if (!IsConfigured)
            throw new TranslatorException(503, "Tính năng dịch chưa được bật trên máy chủ.");

        var request = new HttpRequestMessage(method, path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrEmpty(_options.ApiKey))
            request.Headers.Add("X-API-Key", _options.ApiKey);
        return request;
    }

    private async Task<T> SendAsync<T>(HttpRequestMessage request, string operation, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Translator {Operation} timed out after {Timeout}s", operation, _options.TimeoutSeconds);
            throw new TranslatorException(504, "Dịch vụ dịch phản hồi quá lâu, vui lòng thử lại.", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Translator {Operation}: cannot reach translator service", operation);
            throw new TranslatorException(503, "Dịch vụ dịch đang không khả dụng, vui lòng thử lại sau.", ex);
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return JsonSerializer.Deserialize<T>(body, _jsonOptions)
                       ?? throw new TranslatorException(502, "Phản hồi từ dịch vụ dịch không hợp lệ.");
            }

            var detail = ExtractDetail(body);
            _logger.LogError("Translator {Operation} failed: status={Status}, detail={Detail}",
                operation, (int)response.StatusCode, detail);

            throw response.StatusCode switch
            {
                // Validation problems the user can fix (empty text, audio too long/large, unreadable file).
                HttpStatusCode.BadRequest or HttpStatusCode.UnprocessableEntity =>
                    new TranslatorException(400, detail ?? "Dữ liệu gửi lên không hợp lệ."),
                HttpStatusCode.RequestEntityTooLarge =>
                    new TranslatorException(413, "File âm thanh quá lớn (tối đa 10 MB)."),
                // Wrong/missing service key = server misconfiguration: don't leak details to the app.
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                    new TranslatorException(503, "Dịch vụ dịch đang không khả dụng, vui lòng thử lại sau."),
                _ => new TranslatorException(502, "Dịch vụ dịch gặp lỗi, vui lòng thử lại."),
            };
        }
    }

    /// <summary>FastAPI errors: {"detail": "text"} or {"detail": [{"msg": ...}, ...]} (422).</summary>
    private static string? ExtractDetail(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("detail", out var detail)) return null;
            return detail.ValueKind switch
            {
                JsonValueKind.String => detail.GetString(),
                JsonValueKind.Array => string.Join("; ", detail.EnumerateArray()
                    .Select(e => e.TryGetProperty("msg", out var m) ? m.GetString() : null)
                    .Where(m => !string.IsNullOrEmpty(m))),
                _ => null,
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
