
namespace CakeShop.Application.DTOs;

public class SaleItemRequest
{
    public string ProductId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal Discount { get; set; } = 0;
}

public class CreateSaleRequest
{
    public string TerminalId { get; set; } = "T1";
    public List<SaleItemRequest> Items { get; set; } = new();
    public string? DiscountType { get; set; }          // "percent" | "fixed", order-level
    public decimal DiscountAmount { get; set; } = 0;
    public decimal TaxAmount { get; set; } = 0;
    public string? Note { get; set; }

    // Payment — basic v1 supports one method per sale (cash or card)
    public string PaymentMethod { get; set; } = "CASH"; // "CASH" | "CARD"
    public decimal? CashGiven { get; set; }              // required if PaymentMethod = CASH
    public string? CardReferenceNo { get; set; }         // optional, if PaymentMethod = CARD
}

public class OrderDto
{
    public string Id { get; set; } = string.Empty;
    public string OrderNo { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<OrderItemDto> Items { get; set; } = new();
    public List<PaymentDto> Payments { get; set; } = new();
}

public class OrderItemDto
{
    public string ProductName { get; set; } = string.Empty;
    public string? ItemCode { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Discount { get; set; }
    public decimal Subtotal { get; set; }
}

public class PaymentDto
{
    public string Method { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal? CashGiven { get; set; }
    public decimal? ChangeGiven { get; set; }
}