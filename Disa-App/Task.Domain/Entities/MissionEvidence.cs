using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Task.Domain.Enums;

namespace Task.Domain.Entities
{
    public class MissionEvidence
    {
        public Guid Id { get; set; }

        public Guid SubmissionId { get; set; }

        public EvidenceType Type { get; set; }

        public string MediaUrl { get; set; } = string.Empty;

        public double? Latitude { get; set; }

        public double? Longitude { get; set; }

        public DateTime? TakenAt { get; set; }

        // Navigation
        public MissionSubmission Submission { get; set; } = null!;
    }
}
