
using IAMService.Premium.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Premium.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/premium")]
public sealed class AdminPremiumController : ControllerBase
{
    private readonly PremiumDbContext _db;

    public AdminPremiumController(PremiumDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // GET ALL RECONCILIATION TRANSACTIONS
    // ==========================================
    [HttpGet("reconciliations")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.SePayIncomingTransactions
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(
                x => x.Status == status);
        }

        int total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(x => x.ReceivedAtUtc)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Environment,
                x.SePayTransactionId,
                x.BankAccount,
                x.AmountVnd,
                x.OrderCode,
                x.PaymentId,
                x.Status,
                x.Reason,
                x.ReceivedAtUtc,
                x.ProcessedAtUtc
            })
            .ToListAsync(ct);

        return Ok(new
        {
            total,
            page,
            pageSize,
            items
        });
    }

    // ==========================================
    // GET ONLY TRANSACTIONS REQUIRING REVIEW
    // ==========================================
    [HttpGet("reconciliations/pending")]
    public async Task<IActionResult> Pending(
        CancellationToken ct)
    {
        var items = await _db.SePayIncomingTransactions
            .AsNoTracking()
            .Where(x => x.Status == "NEEDS_REVIEW")
            .OrderByDescending(x => x.ReceivedAtUtc)
            .Take(100)
            .Select(x => new
            {
                x.Id,
                x.SePayTransactionId,
                x.AmountVnd,
                x.OrderCode,
                x.PaymentId,
                x.Reason,
                x.ReceivedAtUtc
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // ==========================================
    // GET TRANSACTION DETAILS
    // ==========================================
    [HttpGet("reconciliations/{id:long}")]
    public async Task<IActionResult> Detail(
        long id,
        CancellationToken ct)
    {
        var transaction =
            await _db.SePayIncomingTransactions
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    x => x.Id == id, ct);

        if (transaction == null)
            return NotFound(new
            {
                error = "Transaction not found"
            });

        // Không trả raw payload mặc định
        // để hạn chế lộ dữ liệu ngân hàng.
        return Ok(new
        {
            transaction.Id,
            transaction.Environment,
            transaction.SePayTransactionId,
            transaction.BankAccount,
            transaction.TransferContent,
            transaction.AmountVnd,
            transaction.OrderCode,
            transaction.PaymentId,
            transaction.Status,
            transaction.Reason,
            transaction.ReceivedAtUtc,
            transaction.ProcessedAtUtc
        });
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(
        CancellationToken ct)
    {
        var query = _db.SePayIncomingTransactions
            .AsNoTracking();

        int processed = await query.CountAsync(
            x => x.Status == "PROCESSED", ct);

        int needsReview = await query.CountAsync(
            x => x.Status == "NEEDS_REVIEW", ct);

        return Ok(new
        {
            total = processed + needsReview,
            processed,
            needsReview
        });
    }
}
