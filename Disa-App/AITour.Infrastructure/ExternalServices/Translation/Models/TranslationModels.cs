using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AITour.Infrastructure.ExternalServices.Translation.Models;

// Contract with the Bahnar-Translator Python service (../Bahnar-Translator/src/serve/app.py).
// Field names are snake_case to match the Python/FastAPI JSON — same convention as the
// AI-Itinerary models. The Front-End mirrors these in src/types/translate.ts.

/// <summary>Configuration section "Translator" (appsettings / env Translator__*).</summary>
public class TranslatorOptions
{
    /// <summary>Base URL of the Bahnar-Translator service. Empty = feature disabled (endpoints return 503).</summary>
    public string BaseUrl { get; set; } = "";

    /// <summary>Sent as X-API-Key to the translator. Secret — set via env Translator__ApiKey, never commit.</summary>
    public string ApiKey { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 90;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BaseUrl);
}

/// <summary>POST /api/v1/translate/text request body.</summary>
public class TranslateTextRequest
{
    /// <summary>Bahnar (Ba Na) text to translate into Vietnamese.</summary>
    [JsonPropertyName("text")]
    public string Text { get; set; } = "";

    /// <summary>Also return Vietnamese speech (only when the translator has TTS enabled).</summary>
    [JsonPropertyName("synthesize")]
    public bool Synthesize { get; set; }
}

/// <summary>Result of Bahnar text → Vietnamese text.</summary>
public class TextTranslationResponse
{
    [JsonPropertyName("translation_vi")]
    public string TranslationVi { get; set; } = "";

    [JsonPropertyName("confidence")]
    public Dictionary<string, double> Confidence { get; set; } = new();

    [JsonPropertyName("disclaimer")]
    public string Disclaimer { get; set; } = "";

    [JsonPropertyName("audio_vi_wav_base64")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AudioViWavBase64 { get; set; }

    [JsonPropertyName("sample_rate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? SampleRate { get; set; }

    [JsonPropertyName("latency_ms")]
    public Dictionary<string, double> LatencyMs { get; set; } = new();
}

/// <summary>Result of Bahnar speech → Bahnar transcript + Vietnamese text (+ optional Vietnamese speech).</summary>
public class SpeechTranslationResponse
{
    /// <summary>Recognised Bahnar text.</summary>
    [JsonPropertyName("transcript_bdq")]
    public string TranscriptBdq { get; set; } = "";

    [JsonPropertyName("translation_vi")]
    public string TranslationVi { get; set; } = "";

    [JsonPropertyName("audio_vi_wav_base64")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AudioViWavBase64 { get; set; }

    [JsonPropertyName("sample_rate")]
    public int? SampleRate { get; set; }

    [JsonPropertyName("confidence")]
    public Dictionary<string, double> Confidence { get; set; } = new();

    [JsonPropertyName("latency_ms")]
    public Dictionary<string, double> LatencyMs { get; set; } = new();

    /// <summary>True = low recognition confidence / no speech: show <see cref="Message"/>, ask to speak again.</summary>
    [JsonPropertyName("rejected")]
    public bool Rejected { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = "";

    [JsonPropertyName("disclaimer")]
    public string Disclaimer { get; set; } = "";
}

/// <summary>GET /healthz of the translator.</summary>
public class TranslatorHealthResponse
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("pipeline_loaded")]
    public bool PipelineLoaded { get; set; }
}

/// <summary>GET /api/v1/translate/status — what the app shows before enabling the feature.</summary>
public class TranslationStatusResponse
{
    [JsonPropertyName("available")]
    public bool Available { get; set; }

    /// <summary>False until the first request warms the models up (~15–30 s).</summary>
    [JsonPropertyName("models_loaded")]
    public bool ModelsLoaded { get; set; }

    [JsonPropertyName("source_language")]
    public string SourceLanguage { get; set; } = "bana";

    [JsonPropertyName("target_language")]
    public string TargetLanguage { get; set; } = "vi";

    [JsonPropertyName("message")]
    public string Message { get; set; } = "";
}
