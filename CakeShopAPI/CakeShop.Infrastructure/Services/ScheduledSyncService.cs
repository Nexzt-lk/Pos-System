using CakeShop.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CakeShop.Infrastructure.Services;

public class ScheduledSyncService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ScheduledSyncService> _logger;
    private readonly TimeSpan _syncInterval = TimeSpan.FromSeconds(30);

    public ScheduledSyncService(IServiceProvider serviceProvider, ILogger<ScheduledSyncService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[SyncEngine] Supabase Background Sync Worker started (Interval: {Interval}s)", _syncInterval.TotalSeconds);

        // Initial brief delay before starting first sync
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
                
                var syncedCount = await syncService.SyncPendingLocalQueueAsync();
                if (syncedCount > 0)
                {
                    _logger.LogInformation("[SyncEngine] Auto-synced {Count} records to Supabase Cloud", syncedCount);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[SyncEngine] Background sync cycle deferred: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(_syncInterval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("[SyncEngine] Supabase Background Sync Worker stopped.");
    }
}
