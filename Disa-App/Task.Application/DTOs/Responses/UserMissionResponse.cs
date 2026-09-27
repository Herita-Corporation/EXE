using Task.Domain.Enums;

namespace Task.Application.DTOs.Responses;

public class UserMissionResponse
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public MissionStatus Status { get; set; }

    public int RewardXP { get; set; }

    public int RewardCoins { get; set; }

    public DateTime StartAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public MissionType Type { get; set; }

    public bool RequiresPhoto { get; set; }

    public bool RequiresVideo { get; set; }

    public bool RequiresLocation { get; set; }

    public int? MinVideoSeconds { get; set; }

    /// <summary>
    /// URL of the photo/video submitted as evidence — set once the mission is
    /// completed, used by the client as the mission's thumbnail/avatar
    /// instead of a generic placeholder icon. Null until submitted.
    /// </summary>
    public string? EvidenceUrl { get; set; }

    /// <summary>Matches Task.Domain.Enums.EvidenceType (1 = Photo, 2 = Video).</summary>
    public EvidenceType? EvidenceType { get; set; }
}