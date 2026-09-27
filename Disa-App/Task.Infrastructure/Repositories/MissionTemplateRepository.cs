using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Repositories;
using Task.Domain.Entities;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Repositories;

public class MissionTemplateRepository : IMissionTemplateRepository
{
    private readonly TaskDbContext _context;

    public MissionTemplateRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task<IEnumerable<MissionTemplate>> GetAllAsync()
    {
        return await _context.MissionTemplates.ToListAsync();
    }

    public async System.Threading.Tasks.Task<MissionTemplate?> GetByIdAsync(Guid id)
    {
        return await _context.MissionTemplates
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async System.Threading.Tasks.Task AddAsync(MissionTemplate mission)
    {
        await _context.MissionTemplates.AddAsync(mission);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task UpdateAsync(MissionTemplate mission)
    {
        _context.MissionTemplates.Update(mission);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task DeleteAsync(Guid id)
    {
        var mission = await _context.MissionTemplates.FindAsync(id);

        if (mission == null)
            return;

        _context.MissionTemplates.Remove(mission);

        await _context.SaveChangesAsync();
    }
}