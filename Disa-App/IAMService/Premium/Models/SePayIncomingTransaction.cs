
namespace IAMService.Premium.Models;

public sealed class SePayIncomingTransaction
{
    public long Id { get; set; }

    // TEST hoặc LIVE.
    public string Environment { get; set; } = "TEST";

    // ID giao dịch do SePay cung cấp.
    public string SePayTransactionId { get; set; } = "";

    // Số tài khoản ngân hàng nhận tiền.
    public string BankAccount { get; set; } = "";

    // Nội dung chuyển khoản.
    public string TransferContent { get; set; } = "";

    // Mã đơn DISA nếu tìm được.
    public string? OrderCode { get; set; }

    // Số tiền thực nhận.
    public int AmountVnd { get; set; }

    // ID đơn thanh toán DISA nếu khớp.
    public long? PaymentId { get; set; }

    // PROCESSED hoặc NEEDS_REVIEW.
    public string Status { get; set; } = "NEEDS_REVIEW";

    // Lý do cần đối soát.
    public string? Reason { get; set; }

    // JSON webhook gốc để kiểm tra lại.
    public string PayloadJson { get; set; } = "";

    public DateTime ReceivedAtUtc { get; set; }
        = DateTime.UtcNow;

    public DateTime? ProcessedAtUtc { get; set; }
}
