using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;

namespace Task.Application.Interfaces.Services;

public interface IMissionTemplateService
{
    Task<IEnumerable<MissionTemplateResponse>> GetAllAsync();

    Task<MissionTemplateResponse?> GetByIdAsync(Guid id);

    System.Threading.Tasks.Task CreateAsync(CreateMissionTemplateRequest request);

    System.Threading.Tasks.Task UpdateAsync(Guid id, CreateMissionTemplateRequest request);

    System.Threading.Tasks.Task DeleteAsync(Guid id);
}