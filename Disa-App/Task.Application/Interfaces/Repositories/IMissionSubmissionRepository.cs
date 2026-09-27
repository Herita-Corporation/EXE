using Task.Domain.Entities;

namespace Task.Application.Interfaces.Repositories;

public interface IMissionSubmissionRepository
{
    System.Threading.Tasks.Task AddAsync(MissionSubmission submission);

    System.Threading.Tasks.Task<MissionSubmission?> GetByIdAsync(Guid id);

    System.Threading.Tasks.Task UpdateAsync(MissionSubmission submission);
}