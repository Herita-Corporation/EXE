using Task.Domain.Entities;

namespace Task.Application.Interfaces.Repositories;

public interface IMissionTemplateRepository
{
    System.Threading.Tasks.Task<IEnumerable<MissionTemplate>> GetAllAsync();

    System.Threading.Tasks.Task<MissionTemplate?> GetByIdAsync(Guid id);

    System.Threading.Tasks.Task AddAsync(MissionTemplate mission);

    System.Threading.Tasks.Task UpdateAsync(MissionTemplate mission);

    System.Threading.Tasks.Task DeleteAsync(Guid id);
}