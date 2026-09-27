using Task.Domain.Entities;

namespace Task.Application.Interfaces.Repositories;

public interface IUserMissionRepository
{
    System.Threading.Tasks.Task AddAsync(UserMission mission);

    System.Threading.Tasks.Task<IEnumerable<UserMission>> GetByUserIdAsync(Guid userId);

    System.Threading.Tasks.Task<UserMission?> GetByIdAsync(Guid id);

    System.Threading.Tasks.Task UpdateAsync(UserMission mission);

    /// <summary>
    /// Removes every UserMission assigned under this trip (itinerary), except
    /// ones already Completed — used when the itinerary itself is deleted, so
    /// still-active missions tied to it don't dangle, while completed ones
    /// (and their earned rewards/history) are kept.
    /// </summary>
    System.Threading.Tasks.Task DeleteByTripIdExceptCompletedAsync(Guid tripId);

    /// <summary>
    /// Removes every UserMission belonging to this user, regardless of
    /// status (including Completed ones and their submissions/evidence) —
    /// a full reset, unlike <see cref="DeleteByTripIdExceptCompletedAsync"/>.
    /// </summary>
    System.Threading.Tasks.Task DeleteAllByUserIdAsync(Guid userId);
}