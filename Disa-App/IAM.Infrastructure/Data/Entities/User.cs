using System;
using System.Collections.Generic;

namespace IAM.Infrastructure.Data.Entities;

public partial class User
{
    public Guid Id { get; set; }

    public string Username { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string? PhoneNumber { get; set; }

    public string? AvatarUrl { get; set; }

    public string? PushToken { get; set; }

    public bool IsPhoneVerified { get; set; }

    public bool IsEmailVerified { get; set; }

    public bool IsActive { get; set; }

    public bool IsPremium { get; set; }

    public string? PremiumProductId { get; set; }

    public DateTime? PremiumExpiresAt { get; set; }

    // Tracks which Google Play subscription purchase currently grants this
    // user Premium — the RTDN webhook only gives us a purchaseToken, so we
    // need this to look up which user it belongs to.
    public string? PremiumPurchaseToken { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();
}
