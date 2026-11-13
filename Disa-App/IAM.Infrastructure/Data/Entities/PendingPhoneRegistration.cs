
namespace IAM.Infrastructure.Data.Entities;

public class PendingPhoneRegistration
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Username { get; set; } = "";
    public string Email { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public string PasswordHash { get; set; } = "";

    public string OtpHash { get; set; } = "";
    public int OtpAttempts { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } =
        DateTime.UtcNow.AddMinutes(5);
}
