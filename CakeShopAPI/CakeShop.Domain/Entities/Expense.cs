
namespace CakeShop.Domain.Entities;

public class Expense
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? Category { get; set; }                     // "Ingredients","Utilities","Restock"...
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateOnly ExpenseDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string? LinkedProductId { get; set; }               // set when this IS a restock cost
    public string? LinkedStockMovementId { get; set; }
    public string? AddedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string LocalId { get; set; } = Guid.NewGuid().ToString();
    public string SyncStatus { get; set; } = "pending";
}