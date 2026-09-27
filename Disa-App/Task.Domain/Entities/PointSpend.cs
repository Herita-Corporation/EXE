namespace Task.Domain.Entities
{
    // A negative-side ledger entry against a user's earned XP (from completed
    // UserMissions, see UserMissionService.GetSummaryAsync) — kept separate so
    // redeeming never mutates already-completed missions' reward fields.
    public class PointSpend
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }

        public int Points { get; set; }

        public string Reason { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
