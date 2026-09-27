using Microsoft.AspNetCore.Http;

namespace Task.Application.DTOs.Requests;

public class SubmitMissionRequest
{
    public IFormFile? Photo { get; set; }

    public IFormFile? Video { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public DateTime TakenAt { get; set; } = DateTime.UtcNow;
}