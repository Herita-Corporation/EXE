using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Repositories;
using Task.Domain.Entities;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Repositories;

public class MissionSubmissionRepository : IMissionSubmissionRepository
{
    private readonly TaskDbContext _context;

    public MissionSubmissionRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AddAsync(MissionSubmission submission)
    {
        await _context.MissionSubmissions.AddAsync(submission);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<MissionSubmission?> GetByIdAsync(Guid id)
    {
        return await _context.MissionSubmissions
            .Include(x => x.Evidences)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async System.Threading.Tasks.Task UpdateAsync(MissionSubmission submission)
    {
        _context.MissionSubmissions.Update(submission);
        await _context.SaveChangesAsync();
    }
}