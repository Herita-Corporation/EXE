using Task.Domain.Enums;

namespace Task.Application.DTOs.Requests;

public class CreateMissionTemplateRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public MissionType Type { get; set; }

    public int RewardXP { get; set; }

    public int RewardCoins { get; set; }

    public bool RequiresPhoto { get; set; }

    public bool RequiresVideo { get; set; }

    public bool RequiresLocation { get; set; }

    public int? MinVideoSeconds { get; set; }
}