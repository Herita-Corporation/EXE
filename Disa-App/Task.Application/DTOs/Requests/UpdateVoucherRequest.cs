namespace Task.Application.DTOs.Requests;

public class UpdateVoucherRequest
{
    public string Category { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string ImageUrl { get; set; } = string.Empty;

    public int PointsCost { get; set; }

    public string DiscountLabel { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public string Code { get; set; } = string.Empty;

    public List<string> Terms { get; set; } = new();

    public bool IsActive { get; set; }
}
