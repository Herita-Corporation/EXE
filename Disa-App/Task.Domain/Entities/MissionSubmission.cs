using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Task.Domain.Enums;

namespace Task.Domain.Entities
{
    public  class MissionSubmission
    {
        public Guid Id { get; set; }

        public Guid UserMissionId { get; set; }

        public VerificationStatus VerificationStatus { get; set; }
            = VerificationStatus.Pending;

        public DateTime SubmittedAt { get; set; }
            = DateTime.UtcNow;

        // Navigation
        public UserMission UserMission { get; set; } = null!;

        public ICollection<MissionEvidence> Evidences { get; set; }
            = new List<MissionEvidence>();
    }
}
