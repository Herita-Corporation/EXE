using Task.Domain.Enums;

namespace Task.Application.DTOs.Responses;

public class MissionTemplateResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public MissionType Type { get; set; }

    public int RewardXP { get; set; }

    public int RewardCoins { get; set; }

    public bool IsActive { get; set; }
}