
namespace CakeShop.Domain.Entities;

public class Product
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ShopId { get; set; } = "b0000000-0000-0000-0000-000000000001";
    public string? CategoryId { get; set; }
    public string ItemCode { get; set; } = string.Empty;   // Auto-generated: "BDY-001"
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public string? Barcode { get; set; }                   // null if manually-entered, no barcode
    public string? ImagePath { get; set; }
    public string Unit { get; set; } = "pcs";
    public bool TrackInventory { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string SyncStatus { get; set; } = "pending";

    public bool HasBarcode => !string.IsNullOrWhiteSpace(Barcode);
}