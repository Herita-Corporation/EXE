using Microsoft.AspNetCore.Http;

namespace IAM.Application.DTOs.Requests;

public class CreateEventRequest
{
    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Tag { get; set; } = null!;

    public string City { get; set; } = null!;

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public IFormFile? CoverImage { get; set; }
}
