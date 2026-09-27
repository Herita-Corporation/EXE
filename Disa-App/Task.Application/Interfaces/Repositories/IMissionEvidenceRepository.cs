using Task.Domain.Entities;

namespace Task.Application.Interfaces.Repositories;

public interface IMissionEvidenceRepository
{
    System.Threading.Tasks.Task AddAsync(MissionEvidence evidence);

    System.Threading.Tasks.Task<List<MissionEvidence>> GetBySubmissionIdAsync(Guid submissionId);
}