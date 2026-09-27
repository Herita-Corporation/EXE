using IAM.Application.DTOs.Requests;
using IAM.Application.DTOs.Response;


namespace IAM.Application.Interfaces;

public interface IAuthService
{
    Task RegisterAsync(RegisterRequest request);
    Task<LoginResponse> LoginAsync(LoginRequest request);
}