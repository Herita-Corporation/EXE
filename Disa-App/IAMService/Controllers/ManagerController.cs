using IAM.Application.DTOs.Requests;
using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IAMService.Controllers;

[ApiController]
[Route("api/manager")]
[Authorize(Roles = "Manager")]
public class ManagerController : ControllerBase
{
    private readonly IAMDbContext _context;

    public ManagerController(IAMDbContext context)
    {
        _context = context;
    }

    //QUYỀN MANAGER
    
    [HttpGet]
    public IActionResult ManagerOnly()
    {
        return Ok(new
        {
            Message = "Xác thực Manager thành công",
            Email = User.FindFirst(ClaimTypes.Email)?.Value,
            Roles = User.Claims
                .Where(x => x.Type == ClaimTypes.Role)
                .Select(x => x.Value)
        });
    }

    // DANH SÁCH CUSTOMER
    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers()
    {
        var customers = await _context.Users
            .Include(x => x.Roles)
            .Where(x => x.Roles.Any(r => r.Name == "Customer"))
            .Select(x => new
            {
                x.Id,
                x.Username,
                x.Email,
                x.IsActive,
                x.CreatedAt
            })
            .ToListAsync();

        return Ok(customers);
    }

    // CHI TIẾT CUSTOMER
    [HttpGet("customers/{id}")]
    public async Task<IActionResult> GetCustomer(Guid id)
    {
        var customer = await _context.Users
            .Include(x => x.Roles)
            .Where(x => x.Roles.Any(r => r.Name == "Customer"))
            .Select(x => new
            {
                x.Id,
                x.Username,
                x.Email,
                x.IsActive,
                x.CreatedAt
            })
            .FirstOrDefaultAsync(x => x.Id == id);

        if (customer == null)
            return NotFound("Không tìm thấy khách hàng");

        return Ok(customer);
    }

    // CẬP NHẬT CUSTOMER
    [HttpPut("customers/{id}")]
    public async Task<IActionResult> UpdateCustomer(
        Guid id,
        UpdateCustomerRequest request)
    {
        var customer = await _context.Users
            .Include(x => x.Roles)
            .Where(x => x.Roles.Any(r => r.Name == "Customer"))
            .FirstOrDefaultAsync(x => x.Id == id);

        if (customer == null)
            return NotFound("Không tìm thấy khách hàng");

        customer.Username = request.Username;
        customer.Email = request.Email;

        await _context.SaveChangesAsync();

        return Ok("Cập nhật thông tin khách hàng thành công");
    }

    // KHÓA TÀI KHOẢN CUSTOMER
    [HttpPatch("customers/{id}/disable")]
    public async Task<IActionResult> DisableCustomer(Guid id)
    {
        var customer = await _context.Users
            .Include(x => x.Roles)
            .Where(x => x.Roles.Any(r => r.Name == "Customer"))
            .FirstOrDefaultAsync(x => x.Id == id);

        if (customer == null)
            return NotFound("Không tìm thấy khách hàng");

        customer.IsActive = false;

        await _context.SaveChangesAsync();

        return Ok("Khóa tài khoản khách hàng thành công");
    }

    // MỞ KHÓA TÀI KHOẢN CUSTOMER
    [HttpPatch("customers/{id}/enable")]
    public async Task<IActionResult> EnableCustomer(Guid id)
    {
        var customer = await _context.Users
            .Include(x => x.Roles)
            .Where(x => x.Roles.Any(r => r.Name == "Customer"))
            .FirstOrDefaultAsync(x => x.Id == id);

        if (customer == null)
            return NotFound("Không tìm thấy khách hàng");

        customer.IsActive = true;

        await _context.SaveChangesAsync();

        return Ok("Mở khóa tài khoản khách hàng thành công");
    }

    // XÓA CUSTOMER
    [HttpDelete("customers/{id}")]
    public async Task<IActionResult> DeleteCustomer(Guid id)
    {
        var customer = await _context.Users
            .Include(x => x.Roles)
            .Where(x => x.Roles.Any(r => r.Name == "Customer"))
            .FirstOrDefaultAsync(x => x.Id == id);

        if (customer == null)
            return NotFound("Không tìm thấy khách hàng");

        _context.Users.Remove(customer);

        await _context.SaveChangesAsync();

        return Ok("Xóa khách hàng thành công");
    }
}