using IAM.Application.DTOs.Requests;
using IAM.Application.Interfaces;
using IAM.Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Controllers;

[ApiController]
[Route("api/events")]
public class EventController : ControllerBase
{
    private readonly IAMDbContext _context;
    private readonly IFileStorageService _fileStorageService;
    private readonly IPushNotificationService _pushNotificationService;

    public EventController(
        IAMDbContext context,
        IFileStorageService fileStorageService,
        IPushNotificationService pushNotificationService)
    {
        _context = context;
        _fileStorageService = fileStorageService;
        _pushNotificationService = pushNotificationService;
    }

    // DANH SÁCH SỰ KIỆN — công khai, chỉ hiện sự kiện đang bật
    [HttpGet]
    public async Task<IActionResult> GetEvents()
    {
        var events = await _context.Events
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.StartDate)
            .ToListAsync();

        return Ok(events);
    }

    // DANH SÁCH TẤT CẢ SỰ KIỆN (kể cả đã tắt) — dùng cho màn Admin CRUD
    [Authorize(Roles = "Admin")]
    [HttpGet("admin/all")]
    public async Task<IActionResult> GetAllEventsForAdmin()
    {
        var events = await _context.Events
            .OrderByDescending(x => x.StartDate)
            .ToListAsync();

        return Ok(events);
    }

    // CHI TIẾT SỰ KIỆN — công khai
    [HttpGet("{id}")]
    public async Task<IActionResult> GetEvent(Guid id)
    {
        var ev = await _context.Events.FirstOrDefaultAsync(x => x.Id == id);

        if (ev == null)
            return NotFound("Không tìm thấy sự kiện");

        return Ok(ev);
    }

    // TẠO SỰ KIỆN — chỉ Admin
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> CreateEvent([FromForm] CreateEventRequest request)
    {
        var ev = new Event
        {
            Title = request.Title,
            Description = request.Description,
            Tag = request.Tag,
            City = request.City,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        if (request.CoverImage != null)
            ev.CoverImageUrl = await _fileStorageService.UploadImageAsync(request.CoverImage);

        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        await _pushNotificationService.SendToAllUsersAsync(
            "Sự kiện mới: " + ev.Title,
            ev.City + " · " + ev.StartDate.ToString("dd/MM/yyyy"));

        return Ok(ev);
    }

    // CẬP NHẬT SỰ KIỆN — chỉ Admin
    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromForm] UpdateEventRequest request)
    {
        var ev = await _context.Events.FirstOrDefaultAsync(x => x.Id == id);

        if (ev == null)
            return NotFound("Không tìm thấy sự kiện");

        ev.Title = request.Title;
        ev.Description = request.Description;
        ev.Tag = request.Tag;
        ev.City = request.City;
        ev.StartDate = request.StartDate;
        ev.EndDate = request.EndDate;
        ev.IsActive = request.IsActive;

        if (request.CoverImage != null)
            ev.CoverImageUrl = await _fileStorageService.UploadImageAsync(request.CoverImage);

        await _context.SaveChangesAsync();

        return Ok(ev);
    }

    // XÓA SỰ KIỆN — chỉ Admin
    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEvent(Guid id)
    {
        var ev = await _context.Events.FirstOrDefaultAsync(x => x.Id == id);

        if (ev == null)
            return NotFound("Không tìm thấy sự kiện");

        _context.Events.Remove(ev);
        await _context.SaveChangesAsync();

        return Ok("Xóa sự kiện thành công");
    }
}
