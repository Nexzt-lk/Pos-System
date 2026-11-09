
namespace CakeShop.Domain.Entities;

public class OrderItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderId { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty; // snapshot
    public string? ItemCode { get; set; }                    // snapshot
    public decimal UnitPrice { get; set; }                   // snapshot
    public decimal? CostPrice { get; set; }                  // snapshot, for margin reports
    public decimal Quantity { get; set; }
    public decimal Discount { get; set; }
    public decimal Subtotal { get; set; }
}