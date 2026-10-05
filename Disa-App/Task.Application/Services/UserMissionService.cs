using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;
using Task.Application.Interfaces.Repositories;
using Task.Application.Interfaces.Services;
using Task.Domain.Entities;

namespace Task.Application.Services;

public class UserMissionService : IUserMissionService
{
    private readonly IUserMissionRepository _userMissionRepository;
    private readonly IMissionTemplateRepository _missionTemplateRepository;

    public UserMissionService(
        IUserMissionRepository userMissionRepository,
        IMissionTemplateRepository missionTemplateRepository)
    {
        _userMissionRepository = userMissionRepository;
        _missionTemplateRepository = missionTemplateRepository;
    }

    public async System.Threading.Tasks.Task<Guid> AssignMissionAsync(AssignMissionRequest request)
    {
        var template = await _missionTemplateRepository.GetByIdAsync(request.TemplateId);

        if (template == null)
            throw new Exception("Mission template not found.");

        var mission = new UserMission
        {
            UserId = request.UserId,
            TripId = request.TripId,
            PlaceId = request.PlaceId,
            TemplateId = template.Id,

            Title = !string.IsNullOrWhiteSpace(request.Title) ? request.Title! : template.Name,

            RewardXP = template.RewardXP,
            RewardCoins = template.RewardCoins,

            TargetLatitude = request.TargetLatitude,
            TargetLongitude = request.TargetLongitude,

            Status = Domain.Enums.MissionStatus.Assigned,

            StartAt = DateTime.UtcNow
        };

        await _userMissionRepository.AddAsync(mission);

        return mission.Id;
    }

    public async System.Threading.Tasks.Task<IEnumerable<UserMissionResponse>> GetUserMissionsAsync(Guid userId)
    {
        var missions = await _userMissionRepository.GetByUserIdAsync(userId);

        return missions.Select(x =>
        {
            var evidence = x.Submissions.SelectMany(s => s.Evidences).FirstOrDefault();
            return new UserMissionResponse
            {
                Id = x.Id,
                Title = x.Title,
                Status = x.Status,
                RewardXP = x.RewardXP,
                RewardCoins = x.RewardCoins,
                StartAt = x.StartAt,
                CompletedAt = x.CompletedAt,
                Type = x.Template.Type,
                RequiresPhoto = x.Template.RequiresPhoto,
                RequiresVideo = x.Template.RequiresVideo,
                RequiresLocation = x.Template.RequiresLocation,
                MinVideoSeconds = x.Template.MinVideoSeconds,
                EvidenceUrl = evidence?.MediaUrl,
                EvidenceType = evidence?.Type,
                TargetLatitude = x.TargetLatitude,
                TargetLongitude = x.TargetLongitude
            };
        });
    }

    public async System.Threading.Tasks.Task<UserMissionResponse?> GetMissionByIdAsync(Guid id)
    {
        var mission = await _userMissionRepository.GetByIdAsync(id);

        if (mission == null)
            return null;

        var evidence = mission.Submissions.SelectMany(s => s.Evidences).FirstOrDefault();

        return new UserMissionResponse
        {
            Id = mission.Id,
            Title = mission.Title,
            Status = mission.Status,
            RewardXP = mission.RewardXP,
            RewardCoins = mission.RewardCoins,
            StartAt = mission.StartAt,
            CompletedAt = mission.CompletedAt,
            Type = mission.Template.Type,
            RequiresPhoto = mission.Template.RequiresPhoto,
            RequiresVideo = mission.Template.RequiresVideo,
            RequiresLocation = mission.Template.RequiresLocation,
            MinVideoSeconds = mission.Template.MinVideoSeconds,
            EvidenceUrl = evidence?.MediaUrl,
            EvidenceType = evidence?.Type,
            TargetLatitude = mission.TargetLatitude,
            TargetLongitude = mission.TargetLongitude
        };
    }

    public async System.Threading.Tasks.Task<UserMissionSummaryResponse> GetSummaryAsync(Guid userId)
    {
        var missions = await _userMissionRepository.GetByUserIdAsync(userId);

        var completed = missions
            .Where(x => x.Status == Domain.Enums.MissionStatus.Completed)
            .ToList();

        return new UserMissionSummaryResponse
        {
            TotalXP = completed.Sum(x => x.RewardXP),
            TotalCoins = completed.Sum(x => x.RewardCoins),
            CompletedCount = completed.Count
        };
    }

    public async System.Threading.Tasks.Task DeleteMissionsForTripAsync(Guid tripId)
    {
        await _userMissionRepository.DeleteByTripIdExceptCompletedAsync(tripId);
    }

    public async System.Threading.Tasks.Task PruneMissionsAsync(Guid userId, IReadOnlyCollection<Guid> keepTripIds)
    {
        await _userMissionRepository.DeleteForUserExceptTripsAsync(userId, keepTripIds);
    }

    public async System.Threading.Tasks.Task DeleteMissionAsync(Guid id)
    {
        var mission = await _userMissionRepository.GetByIdAsync(id);
        if (mission == null)
            return;

        // Completed missions are permanent — they carry earned XP/Coins.
        if (mission.Status == Domain.Enums.MissionStatus.Completed)
            throw new InvalidOperationException("Không thể xóa nhiệm vụ đã hoàn thành.");

        await _userMissionRepository.DeleteByIdAsync(id);
    }

    public async System.Threading.Tasks.Task DeleteAllMissionsForUserAsync(Guid userId)
    {
        await _userMissionRepository.DeleteAllByUserIdAsync(userId);
    }
}