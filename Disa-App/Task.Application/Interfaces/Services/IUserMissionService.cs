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

    /// <summary>Deletes the user's non-Completed missions whose trip isn't in keepTripIds.</summary>
    System.Threading.Tasks.Task PruneMissionsAsync(Guid userId, IReadOnlyCollection<Guid> keepTripIds);

    /// <summary>Deletes every UserMission for this user, including Completed ones — a full reset.</summary>
    System.Threading.Tasks.Task DeleteAllMissionsForUserAsync(Guid userId);

    /// <summary>Deletes one non-Completed mission; throws InvalidOperationException for a Completed one.</summary>
    System.Threading.Tasks.Task DeleteMissionAsync(Guid id);
}