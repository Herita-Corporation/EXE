using IAM.Application.DTOs.Requests;
using IAM.Application.DTOs.Response;
using IAM.Application.Interfaces;
using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Repositories;
using IAM.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace IAM.Application.Services;

public class AuthService : IAuthService
{
    private readonly IAMDbContext _context;
    private readonly JwtTokenGenerator _jwt;
    private readonly BCryptPassworkHasher _hasher;

    public AuthService(IAMDbContext context,
        JwtTokenGenerator jwt,
        BCryptPassworkHasher hasher)
    {
        _context = context;
        _jwt = jwt;
        _hasher = hasher;
    }

    public async Task RegisterAsync(RegisterRequest request)
    {
        var exists = await _context.Users
            .AnyAsync(x => x.Email == request.Email);

        if (exists) throw new Exception("Email exists");

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = _hasher.Hash(request.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var customerRole = await _context.Roles
            .FirstOrDefaultAsync(x => x.Name == "Customer");

        if (customerRole != null)
        {
            user.Roles.Add(customerRole);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users
            .Include(x => x.Roles)
                .ThenInclude(r => r.Permissions)
            .FirstOrDefaultAsync(x => x.Username == request.Username);

        if (user == null)
            throw new Exception("Invalid login");

        if (!_hasher.Verify(request.Password, user.PasswordHash))
            throw new Exception("Invalid login");

        var token = _jwt.Generate(user);

        return new LoginResponse
        {
            AccessToken = token
        };
    }
}