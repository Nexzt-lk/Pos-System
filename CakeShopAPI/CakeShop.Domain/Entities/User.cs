namespace CakeShop.Domain.Entities;

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? ShopId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string PinHash { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = "cashier"; // "owner", "admin", "manager", "cashier"
    public bool IsActive { get; set; } = true;
    public DateTime? LastLogin { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
