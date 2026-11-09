namespace CakeShop.Application.DTOs;

public class RecordStockMovementRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string Type { get; set; } = "IN"; // IN, OUT, SALE, ADJUST, RETURN, DAMAGE
    public decimal Quantity { get; set; }
    public string? Note { get; set; }
    public decimal? CostPerUnit { get; set; }
    public string? DoneBy { get; set; }
}

public class StockMovementDto
{
    public string Id { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal QuantityBefore { get; set; }
    public decimal QuantityAfter { get; set; }
    public string? ReferenceId { get; set; }
    public string? Note { get; set; }
    public decimal? CostPerUnit { get; set; }
    public string? DoneBy { get; set; }
    public DateTime CreatedAt { get; set; }
}
