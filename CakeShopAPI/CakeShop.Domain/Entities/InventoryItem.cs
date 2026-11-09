
namespace CakeShop.Domain.Entities;

public class InventoryItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ProductId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal MinQuantity { get; set; } = 5;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public bool IsLowStock => Quantity <= MinQuantity;
}