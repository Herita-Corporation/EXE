namespace IAM.Application.DTOs.Requests;

public class UpdateCustomerRequest
{
    public string Username { get; set; } = null!;

    public string Email { get; set; } = null!;
}