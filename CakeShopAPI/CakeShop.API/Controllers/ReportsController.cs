
using CakeShop.Application.DTOs;
using CakeShop.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly ReportService _service;
    public ReportsController(ReportService service) => _service = service;

    // GET /api/reports/sales?period=daily|weekly|monthly&date=2026-08-18
    [HttpGet("sales")]
    public async Task<ActionResult<SalesReportDto>> GetSalesReport(
        [FromQuery] string period = "daily",
        [FromQuery] DateTime? date = null)
    {
        if (!Enum.TryParse<ReportPeriod>(period, true, out var parsedPeriod))
            return BadRequest(new { error = "period must be one of: daily, weekly, monthly" });

        var report = await _service.GetSalesReportAsync(parsedPeriod, date);
        return Ok(report);
    }
}