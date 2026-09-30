using System.IO;
using System.Threading;
using System.Threading.Tasks;
using AITour.Infrastructure.ExternalServices.Translation.Models;

namespace AITour.Application.Interfaces;

/// <summary>
/// Abstraction for the Bahnar-Translator external service (Bahnar → Vietnamese).
/// Errors surface as <see cref="AITour.Infrastructure.ExternalServices.Translation.TranslatorException"/>
/// carrying the HTTP status to return and a user-safe message.
/// </summary>
public interface ITranslationService
{
    /// <summary>Translates Bahnar text into Vietnamese.</summary>
    Task<TextTranslationResponse> TranslateTextAsync(
        string text, bool synthesize, CancellationToken cancellationToken = default);

    /// <summary>Recognises Bahnar speech, then translates it into Vietnamese.</summary>
    Task<SpeechTranslationResponse> TranslateSpeechAsync(
        Stream audio, string fileName, string contentType, bool synthesize,
        CancellationToken cancellationToken = default);

    /// <summary>Whether the translator is configured and reachable (never throws).</summary>
    Task<TranslationStatusResponse> GetStatusAsync(CancellationToken cancellationToken = default);
}
