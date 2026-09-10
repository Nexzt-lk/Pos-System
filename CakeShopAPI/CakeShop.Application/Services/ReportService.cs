using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;

namespace CakeShop.Application.Services;

// Powers the daily / weekly / monthly sales + expenses reports.
public class ReportService
{
    private readonly IOrderRepository _orders;
    private readonly IExpenseRepository _expenses;
    private readonly IProductRepository _products;
    private readonly ICategoryRepository _categories;

    public ReportService(
        IOrderRepository orders,
        IExpenseRepository expenses,
        IProductRepository products,
        ICategoryRepository categories)
    {
        _orders = orders;
        _expenses = expenses;
        _products = products;
        _categories = categories;
    }

    public async Task<SalesReportDto> GetSalesReportAsync(ReportPeriod period, DateTime? referenceDate = null)
    {
        var reference = (referenceDate ?? DateTime.UtcNow).Date;
        var (from, to) = GetDateRange(period, reference);

        var orders = await _orders.GetByDateRangeAsync(from, to);
        var completedOrders = orders.Where(o => o.Status == "completed").ToList();

        var expenses = await _expenses.GetByDateRangeAsync(
            DateOnly.FromDateTime(from), DateOnly.FromDateTime(to));

        var totalSales = completedOrders.Sum(o => o.TotalAmount);
        var totalDiscount = completedOrders.Sum(o => o.DiscountAmount);
        var totalTax = completedOrders.Sum(o => o.TaxAmount);
        var totalExpenses = expenses.Sum(e => e.Amount);

        var costOfGoodsSold = completedOrders
            .SelectMany(o => o.Items)
            .Sum(i => (i.CostPrice ?? 0) * i.Quantity);

        var topProducts = completedOrders
            .SelectMany(o => o.Items)
            .GroupBy(i => i.ProductName)
            .Select(g => new TopProductDto
            {
                ProductName = g.Key,
                QuantitySold = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.Subtotal)
            })
            .OrderByDescending(p => p.Revenue)
            .Take(10)
            .ToList();

        var dailyBreakdown = completedOrders
            .GroupBy(o => DateOnly.FromDateTime(o.CreatedAt))
            .Select(g => new DailyBreakdownDto
            {
                Date = g.Key,
                Sales = g.Sum(o => o.TotalAmount),
                OrderCount = g.Count(),
                Expenses = expenses.Where(e => e.ExpenseDate == g.Key).Sum(e => e.Amount)
            })
            .OrderBy(d => d.Date)
            .ToList();

        // Payment breakdown
        var allPayments = completedOrders.SelectMany(o => o.Payments).ToList();
        var cashPayments = allPayments.Where(p => p.Method.Equals("CASH", StringComparison.OrdinalIgnoreCase)).ToList();
        var cardPayments = allPayments.Where(p => p.Method.Equals("CARD", StringComparison.OrdinalIgnoreCase)).ToList();
        var totalPaymentsAmt = allPayments.Sum(p => p.Amount);

        var paymentBreakdown = new PaymentBreakdownDto
        {
            CashAmount = cashPayments.Sum(p => p.Amount),
            CashCount = cashPayments.Count,
            CashPercentage = totalPaymentsAmt > 0 ? Math.Round((cashPayments.Sum(p => p.Amount) / totalPaymentsAmt) * 100, 1) : 0,
            CardAmount = cardPayments.Sum(p => p.Amount),
            CardCount = cardPayments.Count,
            CardPercentage = totalPaymentsAmt > 0 ? Math.Round((cardPayments.Sum(p => p.Amount) / totalPaymentsAmt) * 100, 1) : 0
        };

        // Category breakdown
        var categoriesList = await _categories.GetAllAsync();
        var categoryMap = categoriesList.ToDictionary(c => c.Id, c => c.Name);
        var productsList = await _products.GetAllAsync(true);
        var prodCategoryMap = productsList.ToDictionary(p => p.Id, p => p.CategoryId ?? string.Empty);

        var categorySales = new Dictionary<string, (decimal revenue, decimal qty)>();
        foreach (var order in completedOrders)
        {
            foreach (var item in order.Items)
            {
                var catId = prodCategoryMap.TryGetValue(item.ProductId, out var cid) ? cid : string.Empty;
                var catName = !string.IsNullOrEmpty(catId) && categoryMap.TryGetValue(catId, out var cname) ? cname : "Uncategorized";
                if (!categorySales.ContainsKey(catName)) categorySales[catName] = (0, 0);
                var cur = categorySales[catName];
                categorySales[catName] = (cur.revenue + item.Subtotal, cur.qty + item.Quantity);
            }
        }

        var totalCatRevenue = categorySales.Values.Sum(v => v.revenue);
        var categoryBreakdown = categorySales.Select(kvp => new CategorySalesDto
        {
            CategoryName = kvp.Key,
            Revenue = kvp.Value.revenue,
            QuantitySold = kvp.Value.qty,
            Percentage = totalCatRevenue > 0 ? Math.Round((kvp.Value.revenue / totalCatRevenue) * 100, 1) : 0
        }).OrderByDescending(c => c.Revenue).ToList();

        // Peak hour slot
        var hourlyGroup = completedOrders
            .GroupBy(o => o.CreatedAt.Hour)
            .Select(g => new
            {
                Hour = g.Key,
                Count = g.Count(),
                Revenue = g.Sum(o => o.TotalAmount)
            })
            .OrderByDescending(g => g.Revenue)
            .FirstOrDefault();

        PeakHourDto? peakSlot = null;
        if (hourlyGroup != null)
        {
            var h = hourlyGroup.Hour;
            var ampm1 = h >= 12 ? "PM" : "AM";
            var h12 = h % 12 == 0 ? 12 : h % 12;
            var nextH = (h + 1) % 24;
            var ampm2 = nextH >= 12 ? "PM" : "AM";
            var nextH12 = nextH % 12 == 0 ? 12 : nextH % 12;

            peakSlot = new PeakHourDto
            {
                TimeSlot = $"{h12:D2}:00 {ampm1} - {nextH12:D2}:00 {ampm2}",
                OrderCount = hourlyGroup.Count,
                Revenue = hourlyGroup.Revenue
            };
        }

        // Recent orders
        var recentOrders = completedOrders
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .Select(o => new OrderDto
            {
                Id = o.Id,
                LocalId = o.LocalId,
                OrderNo = o.OrderNo,
                CashierId = o.CashierId,
                Subtotal = o.Subtotal,
                DiscountAmount = o.DiscountAmount,
                TaxAmount = o.TaxAmount,
                TotalAmount = o.TotalAmount,
                Status = o.Status,
                CreatedAt = o.CreatedAt,
                Items = o.Items.Select(i => new OrderItemDto
                {
                    ProductName = i.ProductName,
                    ItemCode = i.ItemCode,
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    Discount = i.Discount,
                    Subtotal = i.Subtotal
                }).ToList(),
                Payments = o.Payments.Select(p => new PaymentDto
                {
                    Method = p.Method,
                    Amount = p.Amount,
                    CashGiven = p.CashGiven,
                    ChangeGiven = p.ChangeGiven
                }).ToList()
            })
            .ToList();

        var netIncome = totalSales - totalDiscount;

        return new SalesReportDto
        {
            Period = period,
            FromDate = from,
            ToDate = to,
            OrderCount = completedOrders.Count,
            TotalSales = totalSales,
            TotalDiscount = totalDiscount,
            TotalTax = totalTax,
            NetIncome = netIncome,
            TotalExpenses = totalExpenses,
            CostOfGoodsSold = costOfGoodsSold,
            ProfitEstimate = netIncome - costOfGoodsSold - totalExpenses,
            PaymentBreakdown = paymentBreakdown,
            CategoryBreakdown = categoryBreakdown,
            PeakSlot = peakSlot,
            TopProducts = topProducts,
            DailyBreakdown = dailyBreakdown,
            RecentOrders = recentOrders
        };
    }

    private static (DateTime from, DateTime to) GetDateRange(ReportPeriod period, DateTime reference)
    {
        return period switch
        {
            ReportPeriod.Daily => (reference, reference.AddDays(1).AddTicks(-1)),
            ReportPeriod.Weekly => GetWeekRange(reference),
            ReportPeriod.Monthly => (
                new DateTime(reference.Year, reference.Month, 1),
                new DateTime(reference.Year, reference.Month, 1).AddMonths(1).AddTicks(-1)),
            _ => (reference, reference)
        };
    }

    private static (DateTime from, DateTime to) GetWeekRange(DateTime reference)
    {
        // Week starts Monday
        int diff = (7 + (reference.DayOfWeek - DayOfWeek.Monday)) % 7;
        var monday = reference.AddDays(-diff);
        return (monday, monday.AddDays(7).AddTicks(-1));
    }
}
