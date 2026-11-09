
using CakeShop.Domain.Enums;

namespace CakeShop.Domain.Entities;

public class StockMovement
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ProductId { get; set; } = string.Empty;
    public StockMovementType Type { get; set; }
    public decimal Quantity { get; set; }          // always positive; Type conveys direction
    public decimal QuantityBefore { get; set; }
    public decimal QuantityAfter { get; set; }
    public string? ReferenceId { get; set; }       // order id, when Type = Sale
    public string? Note { get; set; }
    public decimal? CostPerUnit { get; set; }       // for 'In' / restock entries
    public string? DoneBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string LocalId { get; set; } = Guid.NewGuid().ToString();
    public string SyncStatus { get; set; } = "pending";
}