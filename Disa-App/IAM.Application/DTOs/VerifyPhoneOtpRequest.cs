namespace IAM.Application.DTOs.Requests;

public class VerifyPhoneOtpRequest
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}
