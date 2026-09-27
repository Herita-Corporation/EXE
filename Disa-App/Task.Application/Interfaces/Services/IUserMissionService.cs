using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;

namespace Task.Application.Interfaces.Services;

public interface IUserMissionService
{
    Task<Guid> AssignMissionAsync(AssignMissionRequest request);

    Task<IEnumerable<UserMissionResponse>> GetUserMissionsAsync(Guid userId);

    Task<UserMissionResponse?> GetMissionByIdAsync(Guid id);

    Task<UserMissionSummaryResponse> GetSummaryAsync(Guid userId);

    /// <summary>Deletes every non-Completed UserMission assigned under this trip (itinerary).</summary>
    System.Threading.Tasks.Task DeleteMissionsForTripAsync(Guid tripId);

    /// <summary>Deletes every UserMission for this user, including Completed ones — a full reset.</summary>
    System.Threading.Tasks.Task DeleteAllMissionsForUserAsync(Guid userId);
}