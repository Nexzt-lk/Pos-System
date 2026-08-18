using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

public record CreateCategoryRequest(string Name, string CodePrefix, string Color = "#6366f1", string Icon = "cake");

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly CategoryService _service;
    public CategoriesController(CategoryService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
    {
        try
        {
            var created = await _service.CreateAsync(request.Name, request.CodePrefix, request.Color, request.Icon);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await _service.DeleteAsync(id);
        return NoContent();
    }
}