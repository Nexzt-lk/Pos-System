
using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly ProductService _service;
    public ProductsController(ProductService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<List<ProductDto>>> GetAll([FromQuery] bool includeInactive = false, [FromQuery] string? shopId = null)
        => Ok(await _service.GetAllAsync(includeInactive, shopId));

    // Used by the barcode scanner flow at checkout / product lookup.
    [HttpGet("by-barcode/{barcode}")]
    public async Task<ActionResult<ProductDto>> GetByBarcode(string barcode, [FromQuery] string? shopId = null)
    {
        var product = await _service.GetByBarcodeAsync(barcode, shopId);
        return product == null ? NotFound() : Ok(product);
    }

    // Handles both barcode-scanned and manually-entered products.
    // Leave "barcode" empty/null in the request body for manual-entry items.
    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create([FromBody] CreateProductRequest request)
    {
        try
        {
            var created = await _service.CreateAsync(request);
            return CreatedAtAction(nameof(GetAll), new { }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateProductRequest request)
    {
        try
        {
            await _service.UpdateAsync(id, request);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await _service.DeleteAsync(id);
        return NoContent();
    }
}