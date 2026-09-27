using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Task.Domain.Enums
{
    public enum MissionStatus
    {
        Assigned = 0,        // Đã giao nhiệm vụ

        PendingReview = 1,   // Người dùng đã nộp, chờ AI/Admin xác minh

        Completed = 2,       // Đã hoàn thành

        Rejected = 3,        // Không đạt

        Expired = 4          // Hết hạn
    }
}
