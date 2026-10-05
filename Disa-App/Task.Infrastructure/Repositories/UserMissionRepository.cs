using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Repositories;
using Task.Domain.Entities;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Repositories;

public class UserMissionRepository : IUserMissionRepository
{
    private readonly TaskDbContext _context;

    public UserMissionRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AddAsync(UserMission mission)
    {
        await _context.UserMissions.AddAsync(mission);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<UserMission>> GetByUserIdAsync(Guid userId)
    {
        return await _context.UserMissions
            .Include(x => x.Template)
            .Include(x => x.Submissions)
                .ThenInclude(s => s.Evidences)
            .Where(x => x.UserId == userId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<UserMission?> GetByIdAsync(Guid id)
    {
        return await _context.UserMissions
            .Include(x => x.Template)
            .Include(x => x.Submissions)
                .ThenInclude(s => s.Evidences)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async System.Threading.Tasks.Task UpdateAsync(UserMission mission)
    {
        _context.UserMissions.Update(mission);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task DeleteByTripIdExceptCompletedAsync(Guid tripId)
    {
        var missions = await _context.UserMissions
            .Where(x => x.TripId == tripId && x.Status != Domain.Enums.MissionStatus.Completed)
            .ToListAsync();

        _context.UserMissions.RemoveRange(missions);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task DeleteForUserExceptTripsAsync(Guid userId, IReadOnlyCollection<Guid> keepTripIds)
    {
        // Non-Completed missions never have submissions (submitting completes
        // the mission; a rejected location saves nothing), so a plain
        // RemoveRange is safe here — same as DeleteByTripIdExceptCompletedAsync.
        var missions = await _context.UserMissions
            .Where(x => x.UserId == userId
                && x.Status != Domain.Enums.MissionStatus.Completed
                && !keepTripIds.Contains(x.TripId))
            .ToListAsync();

        _context.UserMissions.RemoveRange(missions);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task DeleteAllByUserIdAsync(Guid userId)
    {
        // Raw SQL, not EF navigation + RemoveRange: MissionSubmissions/
        // MissionEvidences/UserRewards all reference UserMissions with
        // NO_ACTION delete rules at the actual DB level (the GamificatonDBb.sql
        // seed script's schema doesn't match the Fluent API's Cascade config),
        // so children must be deleted before parents or SQL Server rejects
        // the delete with a FK violation. UserRewards isn't an EF-mapped
        // entity in this DbContext at all, hence going through raw SQL for
        // all four tables uniformly rather than mixing in EF RemoveRange.
        using var transaction = await _context.Database.BeginTransactionAsync();

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE e FROM MissionEvidences e
            JOIN MissionSubmissions s ON e.SubmissionId = s.Id
            JOIN UserMissions m ON s.UserMissionId = m.Id
            WHERE m.UserId = {userId}");

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE s FROM MissionSubmissions s
            JOIN UserMissions m ON s.UserMissionId = m.Id
            WHERE m.UserId = {userId}");

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE r FROM UserRewards r
            JOIN UserMissions m ON r.UserMissionId = m.Id
            WHERE m.UserId = {userId}");

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE FROM UserMissions WHERE UserId = {userId}");

        await transaction.CommitAsync();
    }

    public async System.Threading.Tasks.Task DeleteByIdAsync(Guid id)
    {
        // Same child-first raw SQL as DeleteAllByUserIdAsync (NO_ACTION FKs).
        using var transaction = await _context.Database.BeginTransactionAsync();

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE e FROM MissionEvidences e
            JOIN MissionSubmissions s ON e.SubmissionId = s.Id
            WHERE s.UserMissionId = {id}");

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE FROM MissionSubmissions WHERE UserMissionId = {id}");

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE FROM UserRewards WHERE UserMissionId = {id}");

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE FROM UserMissions WHERE Id = {id}");

        await transaction.CommitAsync();
    }
}