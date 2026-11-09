
namespace CakeShop.Domain.Entities;

public class Payment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderId { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;       // "CASH" | "CARD"
    public decimal Amount { get; set; }
    public decimal? CashGiven { get; set; }
    public decimal? ChangeGiven { get; set; }
    public string? ReferenceNo { get; set; }                  // card auth code
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}