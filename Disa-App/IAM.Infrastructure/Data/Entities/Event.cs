using System;

namespace IAM.Infrastructure.Data.Entities;

/// <summary>
/// Admin-authored content shown on the app's "Exclusive Events" screen —
/// notable happenings in provinces across Vietnam. Manually entered by an
/// Admin, not sourced from any external feed.
/// </summary>
public partial class Event
{
    public Guid Id { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Tag { get; set; } = null!;

    public string City { get; set; } = null!;

    public string? CoverImageUrl { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}
