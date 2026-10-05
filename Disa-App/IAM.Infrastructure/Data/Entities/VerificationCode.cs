using System;

namespace IAM.Infrastructure.Data.Entities;

/// <summary>
/// One row per 6-digit code sent for email verification ("EmailToken" — the
/// only type in use; phone/SMS OTP was dropped, email is the sole identity
/// verification channel). Target records what value the code was sent to at
/// the time (email may change later without invalidating history).
/// </summary>
public partial class VerificationCode
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Type { get; set; } = null!; // "EmailToken"

    public string Code { get; set; } = null!;

    public string Target { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
