using Microsoft.EntityFrameworkCore;
using Task.Application.Interfaces.Repositories;
using Task.Domain.Entities;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Repositories;

public class VoucherRepository : IVoucherRepository
{
    private readonly TaskDbContext _context;

    public VoucherRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task<IEnumerable<Voucher>> GetAllAsync(bool includeInactive)
    {
        var query = _context.Vouchers.AsQueryable();
        if (!includeInactive) query = query.Where(x => x.IsActive);
        return await query.OrderByDescending(x => x.CreatedAt).ToListAsync();
    }

    public async System.Threading.Tasks.Task<Voucher?> GetByIdAsync(Guid id)
    {
        return await _context.Vouchers.FirstOrDefaultAsync(x => x.Id == id);
    }

    public async System.Threading.Tasks.Task AddAsync(Voucher voucher)
    {
        await _context.Vouchers.AddAsync(voucher);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task UpdateAsync(Voucher voucher)
    {
        _context.Vouchers.Update(voucher);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task DeleteAsync(Voucher voucher)
    {
        _context.Vouchers.Remove(voucher);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<bool> HasRedemptionsAsync(Guid voucherId)
    {
        return await _context.VoucherRedemptions.AnyAsync(x => x.VoucherId == voucherId);
    }

    public async System.Threading.Tasks.Task<IEnumerable<VoucherRedemption>> GetOwnedByUserIdAsync(Guid userId)
    {
        return await _context.VoucherRedemptions
            .Include(x => x.Voucher)
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.RedeemedAt)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task AddRedemptionAsync(VoucherRedemption redemption)
    {
        await _context.VoucherRedemptions.AddAsync(redemption);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task AddPointSpendAsync(PointSpend spend)
    {
        await _context.PointSpends.AddAsync(spend);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<int> GetTotalSpentPointsAsync(Guid userId)
    {
        return await _context.PointSpends
            .Where(x => x.UserId == userId)
            .SumAsync(x => (int?)x.Points) ?? 0;
    }
}
