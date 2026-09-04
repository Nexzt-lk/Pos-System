using CakeShop.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CakeShop.Infrastructure.Services;

// Runs automatically for the lifetime of the API, taking a backup every
// N hours without anyone needing to remember to trigger it manually.
// This is the safety net for a shop where nobody thinks about backups
// until the day they desperately need one.
public class ScheduledBackupService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<ScheduledBackupService> _logger;
    private readonly TimeSpan _interval;

    public ScheduledBackupService(IServiceProvider services, IConfiguration config, ILogger<ScheduledBackupService> logger)
    {
        _services = services;
        _logger = logger;

        var hours = int.TryParse(config["Backup:IntervalHours"], out var h) ? h : 24;
        _interval = TimeSpan.FromHours(hours);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Small initial delay so this doesn't compete with the API's own
        // startup work (schema init, etc.) in the first few seconds.
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _services.CreateScope();
                var backupService = scope.ServiceProvider.GetRequiredService<IBackupService>();
                var result = await backupService.RunBackupAsync();

                _logger.LogInformation("Scheduled backup completed: {FileName}", result.FileName);

                if (result.FailedDestinations.Count > 0)
                {
                    _logger.LogWarning(
                        "Some backup destinations failed: {Failures}",
                        string.Join("; ", result.FailedDestinations));
                }
            }
            catch (Exception ex)
            {
                // Never let a backup failure crash the API — the shop still
                // needs to keep selling even if today's backup didn't work.
                _logger.LogError(ex, "Scheduled backup failed");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}