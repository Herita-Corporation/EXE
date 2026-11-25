
using System.Data;
using System.Text.Json;

using IAMService.Premium.Data;
using IAMService.Premium.Models;
using IAMService.Premium.Services;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Premium.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/premium/webhooks/sepay")]
public sealed class SePayWebhookController : ControllerBase
{
    private readonly PremiumDbContext _db;
    private readonly SePayQrService _qr;
    private readonly SePaySignatureVerifier _verifier;
    private readonly PremiumActivationService _activator;
    private readonly IConfiguration _config;
    private readonly ILogger<SePayWebhookController> _logger;

    public SePayWebhookController(
        PremiumDbContext db,
        SePayQrService qr,
        SePaySignatureVerifier verifier,
        PremiumActivationService activator,
        IConfiguration config,
        ILogger<SePayWebhookController> logger)
    {
        _db = db;
        _qr = qr;
        _verifier = verifier;
        _activator = activator;
        _config = config;
        _logger = logger;
    }

    [HttpPost]
    [RequestSizeLimit(16384)]
    public async Task<IActionResult> Receive(
        CancellationToken ct)
    {
        // 1. Đọc body gốc.
        byte[] rawBody;

        using (var stream = new MemoryStream())
        {
            await Request.Body.CopyToAsync(stream, ct);
            rawBody = stream.ToArray();
        }

        // 2. Xác thực HMAC.
        var timestamp = Request.Headers[
            "X-SePay-Timestamp"].ToString();

        var signature = Request.Headers[
            "X-SePay-Signature"].ToString();

        if (!_verifier.Verify(
            rawBody, timestamp, signature))
        {
            _logger.LogWarning(
                "Rejected SePay webhook: invalid HMAC");

            return Unauthorized(new
            {
                success = false
            });
        }

        // 3. Parse JSON sau khi xác thực.
        JsonDocument document;

        try
        {
            document = JsonDocument.Parse(rawBody);
        }
        catch (JsonException)
        {
            return BadRequest(new
            {
                success = false,
                error = "INVALID_JSON"
            });
        }

        using (document)
        {
            var data = document.RootElement;

            if (data.ValueKind != JsonValueKind.Object)
                return BadRequest(new
                {
                    success = false,
                    error = "INVALID_PAYLOAD"
                });

            string? ReadString(string property)
            {
                return data.TryGetProperty(
                    property, out var value)
                    && value.ValueKind == JsonValueKind.String
                    ? value.GetString()
                    : null;
            }

            // 4. Đọc ID SePay.
            if (!data.TryGetProperty("id", out var id)
                || (id.ValueKind != JsonValueKind.Number
                    && id.ValueKind != JsonValueKind.String))
            {
                return BadRequest(new
                {
                    success = false,
                    error = "MISSING_TRANSACTION_ID"
                });
            }

            string sepayId = id.ToString().Trim();

            if (!long.TryParse(
                sepayId, out long numericId)
                || numericId <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    error = "INVALID_TRANSACTION_ID"
                });
            }

            sepayId = numericId.ToString();

            // 5. Đọc số tiền.
            if (!data.TryGetProperty(
                "transferAmount", out var amountElement)
                || !amountElement.TryGetInt32(out int amount)
                || amount <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    error = "INVALID_AMOUNT"
                });
            }

            string bankAccount =
                ReadString("accountNumber") ?? "";

            string content =
                ReadString("content") ?? "";

            string transferType =
                ReadString("transferType") ?? "";

            string environment =
                _config["SePay:Environment"]
                ?? "TEST";

            environment = environment
                .Trim()
                .ToUpperInvariant();

            if (environment != "TEST"
                && environment != "LIVE")
            {
                return StatusCode(503, new
                {
                    success = false,
                    error = "INVALID_ENVIRONMENT"
                });
            }

            // 6. Transaction bao gồm:
            // lưu webhook + cập nhật Premium.
            await using var tx =
                await _db.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable, ct);

            // 7. Kiểm tra giao dịch đã lưu chưa.
            var existing =
                await _db.SePayIncomingTransactions
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        x => x.Environment == environment
                          && x.SePayTransactionId == sepayId,
                        ct);

            if (existing != null)
            {
                return Ok(new
                {
                    success = true,
                    duplicate = true
                });
            }

            var now = DateTime.UtcNow;

            // 8. Tạo bản ghi đối soát.
            var receipt = new SePayIncomingTransaction
            {
                Environment = environment,
                SePayTransactionId = sepayId,
                BankAccount = bankAccount,
                TransferContent = content,
                AmountVnd = amount,
                PayloadJson =
                    System.Text.Encoding.UTF8.GetString(rawBody),
                Status = "NEEDS_REVIEW",
                ReceivedAtUtc = now
            };

            _db.SePayIncomingTransactions.Add(receipt);

            // Lưu bản ghi và kết thúc transaction
            // cho các trường hợp không hợp lệ.
            async Task<IActionResult> FinishReview(
                string reason,
                long? paymentId = null)
            {
                receipt.Reason = reason;
                receipt.PaymentId = paymentId;

                await _db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);

                _logger.LogWarning(
                    "SePay review required. " +
                    "Transaction={Transaction}, Reason={Reason}",
                    sepayId, reason);

                return Ok(new
                {
                    success = true,
                    needsReconciliation = true
                });
            }

            // 9. Chỉ xử lý tiền vào.
            if (!string.Equals(
                transferType, "in",
                StringComparison.OrdinalIgnoreCase))
            {
                return await FinishReview("NOT_INCOMING");
            }

            // 10. Kiểm tra tài khoản ngân hàng nhận.
            if (!string.Equals(
                bankAccount.Trim(),
                _qr.BankAccount.Trim(),
                StringComparison.Ordinal))
            {
                return await FinishReview("WRONG_ACCOUNT");
            }

            // 11. Nhận diện mã đơn DISA.
            if (!_qr.MatchIncoming(
                data,
                out string orderCode,
                out string transactionId))
            {
                return await FinishReview("UNKNOWN_ORDER_CODE");
            }

            if (transactionId != sepayId)
                return await FinishReview("INVALID_TRANSACTION_ID");

            receipt.OrderCode = orderCode;

            // 12. Tìm đơn Premium.
            var payment =
                await _db.PremiumPayments
                    .Include(p => p.Plan)
                    .SingleOrDefaultAsync(
                        p => p.OrderCode == orderCode
                          && p.Provider == "SEPAY",
                        ct);

            if (payment == null)
                return await FinishReview("UNKNOWN_ORDER");

            receipt.PaymentId = payment.Id;

            // 13. Ngăn dùng giao dịch cho nhiều đơn.
            var used = await _db.PremiumPayments
                .AnyAsync(
                    p => p.Provider == "SEPAY"
                      && p.ProviderTransactionId == sepayId
                      && p.Id != payment.Id,
                    ct);

            if (used)
                return await FinishReview(
                    "TRANSACTION_ALREADY_USED",
                    payment.Id);

            // 14. Đơn đã thanh toán trước đó.
            if (payment.Status == "PAID")
            {
                // Không cộng Premium lần thứ hai.
                if (payment.ProviderTransactionId == sepayId)
                {
                    receipt.Status = "PROCESSED";
                    receipt.Reason = null;
                    receipt.ProcessedAtUtc = now;

                    await _db.SaveChangesAsync(ct);
                    await tx.CommitAsync(ct);

                    return Ok(new { success = true });
                }

                return await FinishReview(
                    "ORDER_ALREADY_PAID",
                    payment.Id);
            }

            // 15. Đơn không còn PENDING.
            if (payment.Status != "PENDING")
                return await FinishReview(
                    "INVALID_PAYMENT_STATUS",
                    payment.Id);

            // 16. Kiểm tra đúng số tiền.
            if (payment.AmountVnd != amount)
                return await FinishReview(
                    "AMOUNT_MISMATCH",
                    payment.Id);

            // 17. Kiểm tra thời hạn đơn.
            if (payment.ExpiresAtUtc < now)
                return await FinishReview(
                    "EXPIRED_ORDER",
                    payment.Id);

            // 18. Đánh dấu giao dịch hợp lệ.
            payment.ProviderTransactionId = sepayId;

            receipt.Status = "PROCESSED";
            receipt.Reason = null;
            receipt.ProcessedAtUtc = now;

            // 19. Kích hoạt Premium.
            // ActivateAsync() gọi SaveChangesAsync()
            // nên lưu cả receipt + payment + subscription.
            await _activator.ActivateAsync(
                payment, now, ct);

            // 20. Commit.
            await tx.CommitAsync(ct);

            _logger.LogInformation(
                "Premium payment processed. " +
                "PaymentId={PaymentId}, SePayId={SePayId}",
                payment.Id, sepayId);

            return Ok(new
            {
                success = true,
                paymentId = payment.Id
            });
        }
    }
}
