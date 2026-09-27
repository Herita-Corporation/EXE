
using Task.Domain.Enums;

namespace Task.Domain.Entities
{
    public class MissionTemplate
    {
        public Guid Id { get; set; }

        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public MissionType Type { get; set; }

        public int RewardXP { get; set; }

        public int RewardCoins { get; set; }

        public bool RequiresPhoto { get; set; }

        public bool RequiresVideo { get; set; }

        public bool RequiresLocation { get; set; }

        public int? MinVideoSeconds { get; set; }

        public bool IsActive { get; set; } = true;

        // Navigation Property
        public ICollection<UserMission> UserMissions { get; set; }
            = new List<UserMission>();
    }
}
