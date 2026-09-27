using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;
using Task.Application.Interfaces.Repositories;
using Task.Application.Interfaces.Services;
using Task.Domain.Entities;

namespace Task.Application.Services;

public class MissionTemplateService : IMissionTemplateService
{
    private readonly IMissionTemplateRepository _repository;

    public MissionTemplateService(IMissionTemplateRepository repository)
    {
        _repository = repository;
    }

    public async System.Threading.Tasks.Task<IEnumerable<MissionTemplateResponse>> GetAllAsync()
    {
        var missions = await _repository.GetAllAsync();

        return missions.Select(x => new MissionTemplateResponse
        {
            Id = x.Id,
            Name = x.Name,
            Description = x.Description,
            Type = x.Type,
            RewardXP = x.RewardXP,
            RewardCoins = x.RewardCoins,
            IsActive = x.IsActive
        });
    }

    public async System.Threading.Tasks.Task<MissionTemplateResponse?> GetByIdAsync(Guid id)
    {
        var mission = await _repository.GetByIdAsync(id);

        if (mission == null)
            return null;

        return new MissionTemplateResponse
        {
            Id = mission.Id,
            Name = mission.Name,
            Description = mission.Description,
            Type = mission.Type,
            RewardXP = mission.RewardXP,
            RewardCoins = mission.RewardCoins,
            IsActive = mission.IsActive
        };
    }

    public async System.Threading.Tasks.Task CreateAsync(CreateMissionTemplateRequest request)
    {
        var mission = new MissionTemplate
        {
            Name = request.Name,
            Description = request.Description,
            Type = request.Type,
            RewardXP = request.RewardXP,
            RewardCoins = request.RewardCoins,
            RequiresPhoto = request.RequiresPhoto,
            RequiresVideo = request.RequiresVideo,
            RequiresLocation = request.RequiresLocation,
            MinVideoSeconds = request.MinVideoSeconds,
            IsActive = true
        };

        await _repository.AddAsync(mission);
    }

    public async System.Threading.Tasks.Task UpdateAsync(Guid id, CreateMissionTemplateRequest request)
    {
        var mission = await _repository.GetByIdAsync(id);

        if (mission == null)
            throw new Exception("Mission template not found.");

        mission.Name = request.Name;
        mission.Description = request.Description;
        mission.Type = request.Type;
        mission.RewardXP = request.RewardXP;
        mission.RewardCoins = request.RewardCoins;
        mission.RequiresPhoto = request.RequiresPhoto;
        mission.RequiresVideo = request.RequiresVideo;
        mission.RequiresLocation = request.RequiresLocation;
        mission.MinVideoSeconds = request.MinVideoSeconds;

        await _repository.UpdateAsync(mission);
    }

    public async System.Threading.Tasks.Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id);
    }
}