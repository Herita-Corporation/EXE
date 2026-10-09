using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Task.Application.DTOs.Requests;
using Task.Application.DTOs.Responses;
using Task.Application.Interfaces.Services;

namespace Task.Presentation.Controllers;

[ApiController]
[Route("api/vouchers")]
public class VoucherController : ControllerBase
{
    private readonly IVoucherService _service;

    public VoucherController(IVoucherService service)
    {
        _service = service;
    }

    [HttpGet]
    public async System.Threading.Tasks.Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync(includeInactive: false);
        return Ok(result.Select(HideCodeUnlessAdmin));
    }

    // The redeemable code is the voucher's value — the public catalog must not
    // hand it out. Users get it from /owned/{userId} after redeeming; admins
    // still see it so they can edit it.
    private VoucherResponse HideCodeUnlessAdmin(
        VoucherResponse voucher)
    {
        if (!User.IsInRole("Admin")) voucher.Code = string.Empty;
        return voucher;
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin/all")]
    public async System.Threading.Tasks.Task<IActionResult> GetAllForAdmin()
    {
        var result = await _service.GetAllAsync(includeInactive: true);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result == null) return NotFound("Voucher not found.");
        return Ok(HideCodeUnlessAdmin(result));
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async System.Threading.Tasks.Task<IActionResult> Create(CreateVoucherRequest request)
    {
        var id = await _service.CreateAsync(request);
        return Ok(new { VoucherId = id, Message = "Voucher created successfully." });
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> Update(Guid id, UpdateVoucherRequest request)
    {
        try
        {
            await _service.UpdateAsync(id, request);
            return Ok("Voucher updated successfully.");
        }
        catch (Exception ex)
        {
            return NotFound(ex.Message);
        }
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _service.DeleteAsync(id);
            return Ok("Voucher deleted successfully.");
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
        catch (Exception ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpGet("balance/{userId}")]
    public async System.Threading.Tasks.Task<IActionResult> GetBalance(Guid userId)
    {
        var result = await _service.GetBalanceAsync(userId);
        return Ok(result);
    }

    [HttpGet("owned/{userId}")]
    public async System.Threading.Tasks.Task<IActionResult> GetOwned(Guid userId)
    {
        var result = await _service.GetOwnedAsync(userId);
        return Ok(result);
    }

    [HttpPost("{id}/redeem")]
    public async System.Threading.Tasks.Task<IActionResult> Redeem(Guid id, RedeemVoucherRequest request)
    {
        try
        {
            var result = await _service.RedeemAsync(id, request.UserId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
