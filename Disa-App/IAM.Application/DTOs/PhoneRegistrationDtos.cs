
using System.ComponentModel.DataAnnotations;

namespace IAMService.DTOs;

public class RegisterPhoneRequest
{
    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string Username { get; set; } = "";

    [Required]
    [EmailAddress]
    public string Email { get; set; } = "";

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = "";

    [Required]
    public string PhoneNumber { get; set; } = "";
}

public class VerifyPhoneRequest
{
    [Required]
    public string PhoneNumber { get; set; } = "";

    [Required]
    [RegularExpression(@"^\d{6}$")]
    public string Otp { get; set; } = "";
}
