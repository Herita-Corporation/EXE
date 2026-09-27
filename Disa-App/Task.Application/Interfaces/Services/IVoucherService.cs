using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;

namespace Task.Application.Interfaces.Services;

public interface IVoucherService
{
    Task<IEnumerable<VoucherResponse>> GetAllAsync(bool includeInactive);

    Task<VoucherResponse?> GetByIdAsync(Guid id);

    Task<Guid> CreateAsync(CreateVoucherRequest request);

    System.Threading.Tasks.Task UpdateAsync(Guid id, UpdateVoucherRequest request);

    System.Threading.Tasks.Task DeleteAsync(Guid id);

    Task<IEnumerable<OwnedVoucherResponse>> GetOwnedAsync(Guid userId);

    Task<RedeemVoucherResponse> RedeemAsync(Guid voucherId, Guid userId);

    Task<PointsBalanceResponse> GetBalanceAsync(Guid userId);
}
