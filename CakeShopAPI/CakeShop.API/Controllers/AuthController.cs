using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;

    public AuthController(AuthService auth)
    {
        _auth = auth;
    }

    /// <summary>
    /// Returns all active cashiers/users for counter selection
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _auth.GetActiveUsersAsync();
        return Ok(users);
    }

    /// <summary>
    /// Verifies 6-digit cashier PIN for fast POS lock/unlock
    /// </summary>
    [HttpPost("verify-pin")]
    public async Task<IActionResult> VerifyPin([FromBody] VerifyPinRequest request)
    {
        var result = await _auth.VerifyPinAsync(request);
        if (!result.Success)
            return Unauthorized(new { message = result.Message ?? "Invalid PIN." });

        return Ok(result);
    }

    /// <summary>
    /// User login with Email/Password or PIN
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _auth.LoginAsync(request);
        if (!result.Success)
            return Unauthorized(new { message = result.Message ?? "Login failed." });

        return Ok(result);
    }

    /// <summary>
    /// Registers a new staff/cashier account
    /// </summary>
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var user = await _auth.CreateUserAsync(request);
        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, user);
    }
}
