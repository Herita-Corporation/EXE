
using System.Threading.Tasks;
using Task.Domain.Enums;

namespace Task.Domain.Entities
{
    public class UserMission
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }

        public Guid TripId { get; set; }

        public Guid PlaceId { get; set; }

        public Guid TemplateId { get; set; }

        public string Title { get; set; } = string.Empty;

        public MissionStatus Status { get; set; } = MissionStatus.Assigned;

        public DateTime StartAt { get; set; } = DateTime.UtcNow;

        public DateTime? ExpiredAt { get; set; }

        public DateTime? CompletedAt { get; set; }
        public int RewardXP { get; set; }

        public int RewardCoins { get; set; }

        // Navigation
        public MissionTemplate Template { get; set; } = null!;

        public ICollection<MissionSubmission> Submissions { get; set; }
            = new List<MissionSubmission>();
    }

}
