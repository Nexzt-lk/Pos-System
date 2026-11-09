using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly InventoryService _service;
    public InventoryController(InventoryService service) => _service = service;

    [HttpPost("movement")]
    public async Task<ActionResult<StockMovementDto>> RecordMovement([FromBody] RecordStockMovementRequest request)
    {
        try
        {
            var result = await _service.RecordMovementAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("movements/{productId}")]
    public async Task<ActionResult<List<StockMovementDto>>> GetByProduct(string productId)
    {
        return Ok(await _service.GetMovementsByProductAsync(productId));
    }
}
