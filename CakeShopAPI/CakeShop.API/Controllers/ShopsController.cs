using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ShopsController : ControllerBase
{
    private readonly ShopService _shops;

    public ShopsController(ShopService shops)
    {
        _shops = shops;
    }

    /// <summary>
    /// Gets current branch details, name, address, currency, and receipt footer
    /// </summary>
    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent()
    {
        var shop = await _shops.GetCurrentShopAsync();
        return Ok(shop);
    }

    /// <summary>
    /// Updates current branch details or receipt footer
    /// </summary>
    [HttpPut("current")]
    public async Task<IActionResult> UpdateCurrent([FromBody] UpdateShopRequest request)
    {
        var updated = await _shops.UpdateCurrentShopAsync(request);
        return Ok(updated);
    }
}
