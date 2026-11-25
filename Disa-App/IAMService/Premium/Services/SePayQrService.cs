
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace IAMService.Premium.Services;

public sealed class SePayQrService
{
    private readonly IConfiguration _config;

    public SePayQrService(IConfiguration config)
    {
        _config = config;
    }

    public string BankAccount =>
        _config["SePay:BankAccount"]?.Trim()
        ?? throw new InvalidOperationException(
            "SePay:BankAccount missing");

    public string BankCode =>
        _config["SePay:BankCode"]?.Trim()
        ?? throw new InvalidOperationException(
            "SePay:BankCode missing");

    // ==========================================
    // 1. CREATE PAYMENT QR URL
    // ==========================================
    public string QrUrl(string orderCode, int amount)
    {
        if (string.IsNullOrWhiteSpace(BankAccount)
            || string.IsNullOrWhiteSpace(BankCode)
            || BankAccount.Contains("SO_TAI_KHOAN")
            || amount <= 0)
        {
            throw new InvalidOperationException(
                "Invalid SePay bank configuration");
        }

        return "https://qr.sepay.vn/img" +
            $"?acc={Uri.EscapeDataString(BankAccount)}" +
            $"&bank={Uri.EscapeDataString(BankCode)}" +
            $"&amount={amount}" +
            $"&des={Uri.EscapeDataString(orderCode)}";
    }

    // ==========================================
    // 2. CHECK INCOMING TRANSACTION
    // ==========================================
    public bool MatchIncoming(
        JsonElement data,
        out string orderCode,
        out string transactionId)
    {
        orderCode = "";
        transactionId = "";

        // Check incoming transfer.
        if (!data.TryGetProperty(
                "transferType", out var type)
            || type.ValueKind != JsonValueKind.String
            || !string.Equals(
                type.GetString(), "in",
                StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        // Verify beneficiary bank account.
        if (!data.TryGetProperty(
                "accountNumber", out var account)
            || account.ValueKind != JsonValueKind.String
            || account.GetString()?.Trim()
                != BankAccount)
        {
            return false;
        }

        // SePay transaction ID.
        if (!data.TryGetProperty("id", out var id))
            return false;

        if (id.ValueKind == JsonValueKind.Number
            && id.TryGetInt64(out long numericId)
            && numericId > 0)
        {
            transactionId = numericId.ToString(
                CultureInfo.InvariantCulture);
        }
        else if (id.ValueKind == JsonValueKind.String
            && long.TryParse(
                id.GetString(),
                out numericId)
            && numericId > 0)
        {
            transactionId = numericId.ToString(
                CultureInfo.InvariantCulture);
        }
        else
        {
            return false;
        }

        // Original transfer content.
        if (!data.TryGetProperty(
                "content", out var contentElement)
            || contentElement.ValueKind
                != JsonValueKind.String)
        {
            return false;
        }

        var content = contentElement
            .GetString()!
            .ToUpperInvariant();

        // DISA + 24 hexadecimal characters.
        var matches = Regex.Matches(
            content,
            @"(?<![A-Z0-9])DISA[A-F0-9]{24}(?![A-Z0-9])",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(200));

        if (matches.Count != 1)
            return false;

        orderCode = matches[0].Value;

        return true;
    }
}
