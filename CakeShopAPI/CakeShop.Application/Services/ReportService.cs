using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;

namespace CakeShop.Application.Services;

// Powers the daily / weekly / monthly sales + expenses reports.
public class ReportService
{
    private readonly IOrderRepository _orders;
    private readonly IExpenseRepository _expenses;

    public ReportService(IOrderRepository orders, IExpenseRepository expenses)
    {
        _orders = orders;
        _expenses = expenses;
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
            TopProducts = topProducts,
            DailyBreakdown = dailyBreakdown
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
