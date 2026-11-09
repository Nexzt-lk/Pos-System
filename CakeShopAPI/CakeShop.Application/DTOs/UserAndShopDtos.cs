using System.Text.Json.Serialization;

namespace CakeShop.Application.DTOs;

public class UserDto
{
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("shopId")]
    public string? ShopId { get; set; }

    [JsonPropertyName("shop_id")]
    public string? ShopIdSnake { get => ShopId; set => ShopId = value; }

    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Role { get; set; } = "cashier";
    public bool IsActive { get; set; }
    public DateTime? LastLogin { get; set; }
}

public class VerifyPinRequest
{
    public string Pin { get; set; } = string.Empty;
    public string? UserId { get; set; }
}

public class LoginRequest
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Pin { get; set; }
}

public class AuthResponseDto
{
    public bool Success { get; set; }
    public UserDto? User { get; set; }
    public string? Message { get; set; }
    public string? Token { get; set; }
}

public class CreateUserRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Pin { get; set; } = string.Empty;
    public string? Password { get; set; }
    public string Role { get; set; } = "cashier";
    public string? ShopId { get; set; }
}

public class ShopDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BranchCode { get; set; } = "B1";
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Currency { get; set; } = "LKR";
    public string ReceiptFooter { get; set; } = "Thank you for visiting! 🎂";
}

public class UpdateShopRequest
{
    public string Name { get; set; } = string.Empty;
    public string BranchCode { get; set; } = "B1";
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Currency { get; set; } = "LKR";
    public string ReceiptFooter { get; set; } = "Thank you for visiting! 🎂";
}
