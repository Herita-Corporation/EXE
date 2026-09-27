using Task.Application.DTOs.Requests;

namespace Task.Application.Interfaces.Services;

public interface IMissionSubmissionService
{
    System.Threading.Tasks.Task<Guid> SubmitMissionAsync(
        Guid userMissionId,
        SubmitMissionRequest request);
}