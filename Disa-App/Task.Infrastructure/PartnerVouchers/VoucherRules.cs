using System.Security.Cryptography;
using System.Text;

namespace Task.Infrastructure.PartnerVouchers;

public sealed class VoucherError(string code, string message, int status = 422) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
public static class VoucherRules
{
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
    public static string EffectiveStatus(VoucherInstance v, DateTime now) =>
        v.Status == "ISSUED" && now >= v.ExpiresAt ? "EXPIRED" : v.Status;
    public static decimal Discount(Campaign c, decimal subtotal)
    {
        if (subtotal < 0 || subtotal > 1_000_000_000 || subtotal != decimal.Truncate(subtotal))
            throw new VoucherError("INVALID_SUBTOTAL", "Hóa đơn VND không hợp lệ.");
        if (subtotal < c.MinSpend) throw new VoucherError("MIN_SPEND_NOT_MET", "Hóa đơn chưa đạt giá trị tối thiểu.");
        var amount = c.DiscountType switch { "PERCENT" => subtotal * c.PercentageBps / 10000m, "FIXED" => c.FixedAmount, "GIFT" => 0m, _ => throw new VoucherError("INVALID_DISCOUNT", "Loại ưu đãi không hợp lệ.") };
        return decimal.Floor(Math.Clamp(c.MaxDiscountAmount.HasValue ? Math.Min(amount, c.MaxDiscountAmount.Value) : amount, 0, subtotal));
    }
    public static DateTime RedeemableFrom(Campaign c, DateTime now)
    {
        if (c.UsageMode != "RETURN_VISIT") return now;
        var zone = TimeZoneInfo.FindSystemTimeZoneById(c.Location.TimeZone);
        var local = TimeZoneInfo.ConvertTimeFromUtc(now, zone).Date.AddDays(1);
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), zone);
    }
    public static void CanUse(VoucherInstance v, DateTime now)
    {
        var state = EffectiveStatus(v, now);
        if (state != "ISSUED") throw new VoucherError(state == "REDEEMED" ? "VOUCHER_ALREADY_REDEEMED" : "VOUCHER_" + state, "Voucher không còn sử dụng được.", state == "REDEEMED" ? 409 : 422);
        if (!v.Campaign.Location.Active || v.Campaign.Status == "REDEMPTION_SUSPENDED")
            throw new VoucherError("CAMPAIGN_INACTIVE", "Ưu đãi tạm ngừng sử dụng. Vui lòng liên hệ hỗ trợ.");
        if (now < v.RedeemableFrom) throw new VoucherError("VOUCHER_NOT_YET_VALID", "Voucher chưa đến ngày sử dụng.");
    }
}
