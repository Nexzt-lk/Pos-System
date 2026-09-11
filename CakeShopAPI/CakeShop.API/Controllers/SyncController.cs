using CakeShop.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly ISyncService _syncService;

    public SyncController(ISyncService syncService)
    {
        _syncService = syncService;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _syncService.GetSyncStatusAsync();
        return Ok(status);
    }

    [HttpPost]
    public async Task<IActionResult> PushBatch([FromBody] SyncBatchRequest request)
    {
        if (request == null || request.Batch == null || request.Batch.Count == 0)
        {
            return Ok(new SyncBatchResult { Success = true, ProcessedCount = 0 });
        }

        var result = await _syncService.PushBatchAsync(request);
        return Ok(result);
    }

    [HttpPost("trigger")]
    public async Task<IActionResult> TriggerManualSync()
    {
        var count = await _syncService.SyncPendingLocalQueueAsync();
        return Ok(new { success = true, count });
    }
}
