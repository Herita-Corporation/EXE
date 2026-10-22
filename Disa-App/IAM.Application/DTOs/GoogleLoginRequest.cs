using System.ComponentModel.DataAnnotations;

namespace IAM.Application.DTOs.Requests;

public class GoogleLoginRequest
{
    [Required]
    public string IdToken { get; set; } = string.Empty;
}