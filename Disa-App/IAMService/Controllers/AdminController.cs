using IAM.Application.DTOs.Requests;
using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAMDbContext _context;
    private readonly BCryptPassworkHasher _hasher;

    public AdminController(
        IAMDbContext context,
        BCryptPassworkHasher hasher)
    {
        _context = context;
        _hasher = hasher;
    }

    //QUYỀN ADMIN
   
    [HttpGet]
    public IActionResult AdminOnly()
    {
        return Ok("Xin chào Admin");
    }

    // TẠO MANAGER
    
    [HttpPost("create-manager")]
    public async Task<IActionResult> CreateManager(CreateManagerRequest request)
    {
        var emailExists = await _context.Users
            .AnyAsync(x => x.Email == request.Email);

        if (emailExists)
            return BadRequest("Email đã tồn tại");

        var usernameExists = await _context.Users
            .AnyAsync(x => x.Username == request.Username);

        if (usernameExists)
            return BadRequest("Tên đăng nhập đã tồn tại");

        var managerRole = await _context.Roles
            .FirstOrDefaultAsync(x => x.Name == "Manager");

        if (managerRole == null)
            return BadRequest("Không tìm thấy vai trò Manager");

        var manager = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = _hasher.Hash(request.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        manager.Roles.Add(managerRole);

        _context.Users.Add(manager);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Tạo tài khoản Manager thành công",
            Username = manager.Username,
            Email = manager.Email
        });
    }
}