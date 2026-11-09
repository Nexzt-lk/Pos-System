using CakeShop.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CakeShop.Infrastructure.Services;

// Handles automated backups across the POS lifecycle:
// 1. Startup Backup: Takes a snapshot shortly after launch.
// 2. Periodic Backup: Runs periodically every N hours (default 6h).
// 3. Shutdown Backup: Captures a clean final state when the application closes.
public class ScheduledBackupService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<ScheduledBackupService> _logger;
    private readonly TimeSpan _interval;

    public ScheduledBackupService(IServiceProvider services, IConfiguration config, ILogger<ScheduledBackupService> logger)
    {
        _services = services;
        _logger = logger;

        var hours = int.TryParse(config["Backup:IntervalHours"], out var h) ? h : 6;
        _interval = TimeSpan.FromHours(hours);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // 1. Startup Backup: Brief 5s delay so initial DB schema and services finish warming up
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            if (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Triggering automated Startup backup...");
                await TriggerBackupAsync("Startup");
            }
        }
        catch (OperationCanceledException)
        {
            return;
        }

        // 2. Periodic Backup: Repeats every interval (e.g. 6 hours)
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_interval, stoppingToken);
                _logger.LogInformation("Triggering automated Periodic backup...");
                await TriggerBackupAsync("Periodic");
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during periodic backup cycle");
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        // 3. Shutdown Backup: Guaranteed snapshot before closing POS
        _logger.LogInformation("Application shutting down: triggering Shutdown backup...");
        await TriggerBackupAsync("Shutdown");

        await base.StopAsync(cancellationToken);
    }

    private async Task TriggerBackupAsync(string triggerType)
    {
        try
        {
            using var scope = _services.CreateScope();
            var backupService = scope.ServiceProvider.GetRequiredService<IBackupService>();
            var result = await backupService.RunBackupAsync();

            _logger.LogInformation(
                "{TriggerType} backup completed successfully: {FileName} ({SizeBytes} bytes). Saved to: {Destinations}",
                triggerType, result.FileName, result.SizeBytes, string.Join(", ", result.CopiedTo));

            if (result.FailedDestinations.Count > 0)
            {
                _logger.LogWarning(
                    "{TriggerType} backup had failed destinations: {Failures}",
                    triggerType, string.Join("; ", result.FailedDestinations));
            }
        }
        catch (Exception ex)
        {
            // Never crash the application if a backup fails
            _logger.LogError(ex, "{TriggerType} backup failed", triggerType);
        }
    }
}