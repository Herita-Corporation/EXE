using System;

namespace IAM.Infrastructure.Data.Entities;

/// <summary>
/// One row per OTP/token sent for phone or email verification. "PhoneOtp" is a
/// 6-digit numeric code; "EmailToken" is a GUID string standing in for a
/// confirmation-link token. Target records what value the code was sent to at
/// the time (phone/email may change later without invalidating history).
/// </summary>
public partial class VerificationCode
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Type { get; set; } = null!; // "PhoneOtp" | "EmailToken"

    public string Code { get; set; } = null!;

    public string Target { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
