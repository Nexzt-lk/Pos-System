
using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly OrderService _service;
    public OrdersController(OrderService service) => _service = service;

    // Records a sale: builds order + line items, deducts stock, saves payment
    // (cash or card). Supports Idempotency-Key header / body key to prevent double-charging.
    [HttpPost("sale")]
    public async Task<ActionResult<OrderDto>> CreateSale(
        [FromBody] CreateSaleRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
    {
        try
        {
            var order = await _service.CreateSaleAsync(request, idempotencyKey);
            return Ok(order);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<List<OrderDto>>> GetAll([FromQuery] int limit = 100)
    {
        return Ok(await _service.GetAllAsync(limit));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OrderDto>> GetById(string id)
    {
        var order = await _service.GetByIdAsync(id);
        return order == null ? NotFound() : Ok(order);
    }
}