using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Task.Application.DTOs.Requests;

public class AssignMissionRequest
{
    public Guid UserId { get; set; }

    public Guid TripId { get; set; }

    public Guid PlaceId { get; set; }

    public Guid TemplateId { get; set; }

    /// <summary>Optional override for the mission's title — e.g. "Chụp ảnh tại Cầu Rồng"
    /// when assigning a generic capture template to a specific place. Falls back to
    /// the template's own name when not provided.</summary>
    public string? Title { get; set; }

    /// <summary>GPS of the mission's place — submissions taken too far from it are rejected.</summary>
    public double? TargetLatitude { get; set; }

    public double? TargetLongitude { get; set; }
}
