using System.IO;
using System.Threading;
using System.Threading.Tasks;
using AITour.Application.Interfaces;
using AITour.Infrastructure.ExternalServices.Translation;
using AITour.Infrastructure.ExternalServices.Translation.Models;

namespace AITour.Application.Services;

/// <summary>
/// Application service for Bahnar → Vietnamese translation.
/// Delegates to <see cref="BahnarTranslatorClient"/>; input limits live in the controller.
/// </summary>
public class TranslationService : ITranslationService
{
    private readonly BahnarTranslatorClient _client;

    public TranslationService(BahnarTranslatorClient client)
    {
        _client = client;
    }

    public Task<TextTranslationResponse> TranslateTextAsync(
        string text, bool synthesize, CancellationToken cancellationToken = default)
        => _client.TranslateTextAsync(text, synthesize, cancellationToken);

    public Task<SpeechTranslationResponse> TranslateSpeechAsync(
        Stream audio, string fileName, string contentType, bool synthesize,
        CancellationToken cancellationToken = default)
        => _client.TranslateSpeechAsync(audio, fileName, contentType, synthesize, cancellationToken);

    public async Task<TranslationStatusResponse> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        if (!_client.IsConfigured)
            return new TranslationStatusResponse { Available = false, Message = "Tính năng dịch chưa được bật trên máy chủ." };
        try
        {
            var health = await _client.GetHealthAsync(cancellationToken);
            return new TranslationStatusResponse
            {
                Available = health?.Status == "ok",
                ModelsLoaded = health?.PipelineLoaded ?? false,
                Message = health?.PipelineLoaded == true ? "" : "Lần dịch đầu tiên có thể mất 15–30 giây để nạp mô hình.",
            };
        }
        catch (TranslatorException ex)
        {
            return new TranslationStatusResponse { Available = false, Message = ex.Message };
        }
    }
}
