using Microsoft.AspNetCore.Http;

namespace IAM.Application.DTOs.Requests;

public class UpdateEventRequest
{
    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Tag { get; set; } = null!;

    public string City { get; set; } = null!;

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public bool IsActive { get; set; }

    /// <summary>Only replaces the stored cover image when a new file is sent.</summary>
    public IFormFile? CoverImage { get; set; }
}
