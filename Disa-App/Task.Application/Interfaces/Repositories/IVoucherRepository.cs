using Task.Domain.Entities;

namespace Task.Application.Interfaces.Repositories;

public interface IVoucherRepository
{
    System.Threading.Tasks.Task<IEnumerable<Voucher>> GetAllAsync(bool includeInactive);

    System.Threading.Tasks.Task<Voucher?> GetByIdAsync(Guid id);

    System.Threading.Tasks.Task AddAsync(Voucher voucher);

    System.Threading.Tasks.Task UpdateAsync(Voucher voucher);

    System.Threading.Tasks.Task DeleteAsync(Voucher voucher);

    System.Threading.Tasks.Task<bool> HasRedemptionsAsync(Guid voucherId);

    System.Threading.Tasks.Task<IEnumerable<VoucherRedemption>> GetOwnedByUserIdAsync(Guid userId);

    System.Threading.Tasks.Task AddRedemptionAsync(VoucherRedemption redemption);

    System.Threading.Tasks.Task AddPointSpendAsync(PointSpend spend);

    System.Threading.Tasks.Task<int> GetTotalSpentPointsAsync(Guid userId);
}
