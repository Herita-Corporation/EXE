using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Task.Application.DTOs.Requests;
using Task.Application.Interfaces.Services;

namespace Task.Presentation.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MissionTemplateController : ControllerBase
{
    private readonly IMissionTemplateService _service;

    public MissionTemplateController(IMissionTemplateService service)
    {
        _service = service;
    }

    [HttpGet]
    public async System.Threading.Tasks.Task<IActionResult> GetAll()
    {
        return Ok(await _service.GetAllAsync());
    }

    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);

        if (result == null)
            return NotFound();

        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async System.Threading.Tasks.Task<IActionResult> Create(CreateMissionTemplateRequest request)
    {
        await _service.CreateAsync(request);
        return Ok("Mission template created successfully.");
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> Update(Guid id, CreateMissionTemplateRequest request)
    {
        await _service.UpdateAsync(id, request);
        return Ok("Mission template updated successfully.");
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> Delete(Guid id)
    {
        await _service.DeleteAsync(id);
        return Ok("Mission template deleted successfully.");
    }
}
