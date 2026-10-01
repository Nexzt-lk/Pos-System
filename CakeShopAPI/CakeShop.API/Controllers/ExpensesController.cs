
using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly ExpenseService _service;
    public ExpensesController(ExpenseService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        if (!string.IsNullOrEmpty(from) && !string.IsNullOrEmpty(to)
            && DateOnly.TryParse(from, out var fromDate)
            && DateOnly.TryParse(to, out var toDate))
        {
            return Ok(await _service.GetByDateRangeAsync(fromDate, toDate));
        }
        return Ok(await _service.GetAllAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest request)
        => Ok(await _service.CreateAsync(request));

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateExpenseRequest request)
        => Ok(await _service.UpdateAsync(id, request));

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await _service.DeleteAsync(id);
        return NoContent();
    }
}