using System.Text.Json;
using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;
using Task.Application.Interfaces.Repositories;
using Task.Application.Interfaces.Services;
using Task.Domain.Entities;
using Task.Domain.Enums;

namespace Task.Application.Services;

public class VoucherService : IVoucherService
{
    private readonly IVoucherRepository _voucherRepository;
    private readonly IUserMissionRepository _userMissionRepository;

    public VoucherService(
        IVoucherRepository voucherRepository,
        IUserMissionRepository userMissionRepository)
    {
        _voucherRepository = voucherRepository;
        _userMissionRepository = userMissionRepository;
    }

    public async System.Threading.Tasks.Task<IEnumerable<VoucherResponse>> GetAllAsync(bool includeInactive)
    {
        var vouchers = await _voucherRepository.GetAllAsync(includeInactive);
        return vouchers.Select(ToResponse);
    }

    public async System.Threading.Tasks.Task<VoucherResponse?> GetByIdAsync(Guid id)
    {
        var voucher = await _voucherRepository.GetByIdAsync(id);
        return voucher == null ? null : ToResponse(voucher);
    }

    public async System.Threading.Tasks.Task<Guid> CreateAsync(CreateVoucherRequest request)
    {
        var voucher = new Voucher
        {
            Category = request.Category,
            Title = request.Title,
            Description = request.Description,
            ImageUrl = request.ImageUrl,
            PointsCost = request.PointsCost,
            DiscountLabel = request.DiscountLabel,
            Location = request.Location,
            ExpiresAt = request.ExpiresAt,
            Code = request.Code,
            TermsJson = JsonSerializer.Serialize(request.Terms),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _voucherRepository.AddAsync(voucher);
        return voucher.Id;
    }

    public async System.Threading.Tasks.Task UpdateAsync(Guid id, UpdateVoucherRequest request)
    {
        var voucher = await _voucherRepository.GetByIdAsync(id);
        if (voucher == null) throw new Exception("Voucher not found.");

        voucher.Category = request.Category;
        voucher.Title = request.Title;
        voucher.Description = request.Description;
        voucher.ImageUrl = request.ImageUrl;
        voucher.PointsCost = request.PointsCost;
        voucher.DiscountLabel = request.DiscountLabel;
        voucher.Location = request.Location;
        voucher.ExpiresAt = request.ExpiresAt;
        voucher.Code = request.Code;
        voucher.TermsJson = JsonSerializer.Serialize(request.Terms);
        voucher.IsActive = request.IsActive;

        await _voucherRepository.UpdateAsync(voucher);
    }

    public async System.Threading.Tasks.Task DeleteAsync(Guid id)
    {
        var voucher = await _voucherRepository.GetByIdAsync(id);
        if (voucher == null) throw new Exception("Voucher not found.");

        if (await _voucherRepository.HasRedemptionsAsync(id))
            throw new InvalidOperationException(
                "Cannot delete a voucher that users have already redeemed. Deactivate it instead.");

        await _voucherRepository.DeleteAsync(voucher);
    }

    public async System.Threading.Tasks.Task<IEnumerable<OwnedVoucherResponse>> GetOwnedAsync(Guid userId)
    {
        var owned = await _voucherRepository.GetOwnedByUserIdAsync(userId);

        return owned.Select(x => new OwnedVoucherResponse
        {
            RedemptionId = x.Id,
            VoucherId = x.VoucherId,
            Category = x.Voucher.Category,
            Title = x.Voucher.Title,
            ImageUrl = x.Voucher.ImageUrl,
            Code = x.Voucher.Code,
            ExpiresAt = x.Voucher.ExpiresAt,
            RedeemedAt = x.RedeemedAt
        });
    }

    public async System.Threading.Tasks.Task<PointsBalanceResponse> GetBalanceAsync(Guid userId)
    {
        var (earned, spent, available) = await ComputeBalanceAsync(userId);
        return new PointsBalanceResponse
        {
            EarnedPoints = earned,
            SpentPoints = spent,
            AvailablePoints = available
        };
    }

    private async System.Threading.Tasks.Task<(int Earned, int Spent, int Available)> ComputeBalanceAsync(Guid userId)
    {
        var missions = await _userMissionRepository.GetByUserIdAsync(userId);
        var earnedPoints = missions
            .Where(x => x.Status == MissionStatus.Completed)
            .Sum(x => x.RewardXP);

        var spentPoints = await _voucherRepository.GetTotalSpentPointsAsync(userId);
        return (earnedPoints, spentPoints, earnedPoints - spentPoints);
    }

    public async System.Threading.Tasks.Task<RedeemVoucherResponse> RedeemAsync(Guid voucherId, Guid userId)
    {
        var voucher = await _voucherRepository.GetByIdAsync(voucherId);
        if (voucher == null || !voucher.IsActive)
            throw new Exception("Voucher not found.");

        var (_, _, availablePoints) = await ComputeBalanceAsync(userId);

        if (availablePoints < voucher.PointsCost)
            throw new Exception("Not enough points to redeem this voucher.");

        var redemption = new VoucherRedemption
        {
            UserId = userId,
            VoucherId = voucherId,
            RedeemedAt = DateTime.UtcNow
        };
        await _voucherRepository.AddRedemptionAsync(redemption);

        await _voucherRepository.AddPointSpendAsync(new PointSpend
        {
            UserId = userId,
            Points = voucher.PointsCost,
            Reason = $"Voucher: {voucher.Title}",
            CreatedAt = DateTime.UtcNow
        });

        return new RedeemVoucherResponse
        {
            RedemptionId = redemption.Id,
            RemainingPoints = availablePoints - voucher.PointsCost
        };
    }

    private static VoucherResponse ToResponse(Voucher voucher) => new()
    {
        Id = voucher.Id,
        Category = voucher.Category,
        Title = voucher.Title,
        Description = voucher.Description,
        ImageUrl = voucher.ImageUrl,
        PointsCost = voucher.PointsCost,
        DiscountLabel = voucher.DiscountLabel,
        Location = voucher.Location,
        ExpiresAt = voucher.ExpiresAt,
        Code = voucher.Code,
        Terms = JsonSerializer.Deserialize<List<string>>(voucher.TermsJson) ?? new List<string>(),
        IsActive = voucher.IsActive
    };
}
