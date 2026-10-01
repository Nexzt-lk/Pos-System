namespace CakeShop.Application.DTOs;

public class CreateExpenseRequest
{
    public string? Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateOnly ExpenseDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string? LinkedProductId { get; set; }  // set when this expense is a restock cost
}

public class UpdateExpenseRequest
{
    public string? Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateOnly ExpenseDate { get; set; }
}

public class ExpenseDto
{
    public string Id { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateOnly ExpenseDate { get; set; }
    public string? LinkedProductId { get; set; }
}

// Report period selector used by the reports endpoints
public enum ReportPeriod { Daily, Weekly, Monthly }

public class PaymentBreakdownDto
{
    public decimal CashAmount { get; set; }
    public int CashCount { get; set; }
    public decimal CashPercentage { get; set; }
    public decimal CardAmount { get; set; }
    public int CardCount { get; set; }
    public decimal CardPercentage { get; set; }
}

public class CategorySalesDto
{
    public string CategoryId { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal QuantitySold { get; set; }
    public decimal Revenue { get; set; }
    public decimal Percentage { get; set; }
}

public class PeakHourDto
{
    public string TimeSlot { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal Revenue { get; set; }
}

public class SalesReportDto
{
    public ReportPeriod Period { get; set; }
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int OrderCount { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal NetIncome { get; set; }          // TotalSales - TotalDiscount
    public decimal TotalExpenses { get; set; }
    public decimal ProfitEstimate { get; set; }      // NetIncome - CostOfGoodsSold - TotalExpenses
    public decimal CostOfGoodsSold { get; set; }
    public PaymentBreakdownDto? PaymentBreakdown { get; set; }
    public List<CategorySalesDto> CategoryBreakdown { get; set; } = new();
    public PeakHourDto? PeakSlot { get; set; }
    public List<TopProductDto> TopProducts { get; set; } = new();
    public List<DailyBreakdownDto> DailyBreakdown { get; set; } = new();
    public List<OrderDto> RecentOrders { get; set; } = new();
}

public class TopProductDto
{
    public string ProductName { get; set; } = string.Empty;
    public decimal QuantitySold { get; set; }
    public decimal Revenue { get; set; }
}

public class DailyBreakdownDto
{
    public DateOnly Date { get; set; }
    public decimal Sales { get; set; }
    public decimal Expenses { get; set; }
    public int OrderCount { get; set; }
}
