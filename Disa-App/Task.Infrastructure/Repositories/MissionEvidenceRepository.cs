using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Repositories;
using Task.Domain.Entities;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Repositories;

public class MissionEvidenceRepository : IMissionEvidenceRepository
{
    private readonly TaskDbContext _context;

    public MissionEvidenceRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AddAsync(MissionEvidence evidence)
    {
        await _context.MissionEvidences.AddAsync(evidence);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<List<MissionEvidence>> GetBySubmissionIdAsync(Guid submissionId)
    {
        return await _context.MissionEvidences
            .Where(x => x.SubmissionId == submissionId)
            .ToListAsync();
    }
}