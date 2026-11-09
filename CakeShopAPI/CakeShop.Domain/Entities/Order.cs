
namespace CakeShop.Domain.Entities;

public class Order
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ShopId { get; set; } = "b0000000-0000-0000-0000-000000000001";
    public string OrderNo { get; set; } = string.Empty;    // TERMINAL-YYYYMMDD-0001
    public string? CashierId { get; set; }
    public decimal Subtotal { get; set; }
    public string? DiscountType { get; set; }               // "percent" | "fixed"
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = "completed";
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string LocalId { get; set; } = Guid.NewGuid().ToString();
    public string SyncStatus { get; set; } = "pending";
    public DateTime? SyncedAt { get; set; }

    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
}