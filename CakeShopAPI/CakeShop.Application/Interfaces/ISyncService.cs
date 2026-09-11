using CakeShop.Domain.Entities;

namespace CakeShop.Application.Interfaces;

public class SyncBatchItemDto
{
    public long Id { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public object? Data { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SyncBatchRequest
{
    public List<SyncBatchItemDto> Batch { get; set; } = new();
}

public class SyncBatchResult
{
    public bool Success { get; set; }
    public int ProcessedCount { get; set; }
    public List<long> SyncedIds { get; set; } = new();
    public string? ErrorMessage { get; set; }
}

public class SyncStatusDto
{
    public bool IsCloudConnected { get; set; }
    public int PendingQueueCount { get; set; }
    public DateTime? LastSyncTime { get; set; }
    public string? CloudUrl { get; set; }
}

public interface ISyncService
{
    Task<SyncBatchResult> PushBatchAsync(SyncBatchRequest request);
    Task<SyncStatusDto> GetSyncStatusAsync();
    Task<int> SyncPendingLocalQueueAsync();
}
