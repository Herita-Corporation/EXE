
using IAM.Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace IAM.Infrastructure.Security;

public class JwtTokenGenerator
{
    private readonly IConfiguration _config;

    public JwtTokenGenerator(IConfiguration config)
    {
        _config = config;
    }

    public string Generate(User user)
    {
        var roles = user.Roles?.Select(x => x.Name) ?? new List<string>();

        var permissions = user.Roles?
            .Where(r => r.Permissions != null)
            .SelectMany(x => x.Permissions)
            .Select(x => x.Code)
            .Distinct()
            ?? Enumerable.Empty<string>();

        var claims = new List<Claim>
        {
            // 'sub' — standard JWT subject claim; used by AI-Itinerary to extract user_id
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            // 'nameid' — used by .NET services (ASP.NET Core Identity pipeline)
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim("permission", p)));

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"]));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}