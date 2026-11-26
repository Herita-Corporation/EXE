
using IAMService.Premium.Data;
using IAMService.Premium.Models;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Premium.Services;

public sealed class PremiumActivationService
{
    private readonly PremiumDbContext _db;

    public PremiumActivationService(
        PremiumDbContext db)
    {
        _db = db;
    }

    public async Task<DateTime?> ActivateAsync(
        PremiumPayment payment,
        DateTime now,
        CancellationToken ct)
    {
        // Caller must have an active SQL transaction
        // using Serializable isolation.
        if (_db.Database.CurrentTransaction == null)
        {
            throw new InvalidOperationException(
                "Premium activation requires a transaction");
        }

        // Prevent duplicate activation.
        if (payment.Status == "PAID")
            return payment.AccessUntilUtc;

        if (payment.Status != "PENDING")
        {
            throw new InvalidOperationException(
                "Payment is not pending");
        }

        // Ensure plan is available.
        if (payment.Plan == null)
        {
            payment.Plan = await _db.PremiumPlans
                .SingleAsync(
                    p => p.Id == payment.PlanId,
                    ct);
        }

        var subscription =
            await _db.UserPremiumSubscriptions
                .SingleOrDefaultAsync(
                    s => s.UserId == payment.UserId,
                    ct);

        // If the user has remaining Premium time,
        // extend from the existing expiration.
        DateTime start = subscription != null
            && (subscription.Status == "ACTIVE" || subscription.Status == "TRIAL")
            && subscription.EndAtUtc > now
                ? subscription.EndAtUtc
                : now;

        DateTime end = start.AddMonths(
            payment.Plan.DurationMonths);

        if (subscription == null)
        {
            subscription = new UserPremiumSubscription
            {
                UserId = payment.UserId,
                StartAtUtc = now
            };

            _db.UserPremiumSubscriptions.Add(
                subscription);
        }
        else if (subscription.EndAtUtc <= now
            || subscription.Status != "ACTIVE")
        {
            subscription.StartAtUtc = now;
        }

        subscription.PlanId = payment.PlanId;
        subscription.Status = "ACTIVE";
        subscription.EndAtUtc = end;
        subscription.LastPaymentId = payment.Id;

        payment.Status = "PAID";
        payment.PaidAtUtc = now;
        payment.AccessUntilUtc = end;

        await _db.SaveChangesAsync(ct);

        return end;
    }

    /// <summary>Grants the one-month welcome entitlement once per UserId.</summary>
    public async Task<DateTime> GrantWelcomeTrialAsync(Guid userId, CancellationToken ct = default)
    {
        var existing = await _db.UserPremiumSubscriptions.SingleOrDefaultAsync(x => x.UserId == userId, ct);
        if (existing is not null) return existing.EndAtUtc;

        var monthlyPlan = await _db.PremiumPlans.SingleAsync(x => x.Code == "MONTHLY" && x.IsActive, ct);
        var now = DateTime.UtcNow;
        var end = now.AddMonths(1);
        _db.UserPremiumSubscriptions.Add(new UserPremiumSubscription
        {
            UserId = userId,
            PlanId = monthlyPlan.Id,
            Status = "TRIAL",
            StartAtUtc = now,
            EndAtUtc = end
        });
        await _db.SaveChangesAsync(ct);
        return end;
    }
}
