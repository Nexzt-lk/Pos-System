using CakeShop.Application.Interfaces;
using CakeShop.Infrastructure.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CakeShop.Infrastructure.Services;

public class BackupService : IBackupService
{
    private readonly SqliteConnectionFactory _factory;
    private readonly ILogger<BackupService> _logger;
    private readonly string _localBackupFolder;
    private readonly string? _googleDriveFolder;
    private readonly string? _externalDriveFolder;
    private readonly int _retentionDays;

    public BackupService(SqliteConnectionFactory factory, IConfiguration config, ILogger<BackupService> logger)
    {
        _factory = factory;
        _logger = logger;

        var appDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CakeShopAPI");

        var configuredLocalFolder = config["Backup:LocalBackupFolder"];
        _localBackupFolder = string.IsNullOrWhiteSpace(configuredLocalFolder)
            ? Path.Combine(appDataFolder, "Backups")
            : configuredLocalFolder;

        // Empty/missing in config = that destination is simply skipped, not an error.
        _googleDriveFolder = string.IsNullOrWhiteSpace(config["Backup:GoogleDriveFolder"])
            ? null : config["Backup:GoogleDriveFolder"];
        _externalDriveFolder = string.IsNullOrWhiteSpace(config["Backup:ExternalDriveFolder"])
            ? null : config["Backup:ExternalDriveFolder"];

        _retentionDays = int.TryParse(config["Backup:RetentionDays"], out var days) ? days : 30;

        Directory.CreateDirectory(_localBackupFolder);
    }

    public async Task<BackupResult> RunBackupAsync()
    {
        var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd_HHmmss");
        var fileName = $"cakeshop_backup_{timestamp}.db";
        var primaryBackupPath = Path.Combine(_localBackupFolder, fileName);

        // VACUUM INTO creates a fully consistent, compacted snapshot of the
        // live database in one atomic step — safe to run even while the API
        // is actively taking sales, unlike copying the .db file directly
        // (which risks capturing a half-written page while WAL is active).
        using (var connection = _factory.CreateConnection())
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "VACUUM INTO $path;";
            cmd.Parameters.AddWithValue("$path", primaryBackupPath);
            await cmd.ExecuteNonQueryAsync();
        }

        var fileInfo = new FileInfo(primaryBackupPath);
        var result = new BackupResult
        {
            FileName = fileName,
            SizeBytes = fileInfo.Length,
            CreatedAt = DateTime.UtcNow
        };
        result.CopiedTo.Add($"Local ({_localBackupFolder})");

        // Copy the already-created snapshot to each additional destination.
        // A failure copying to one destination doesn't stop the others —
        // the local copy above already succeeded, so the backup isn't lost
        // even if, say, the external HDD isn't plugged in today.
        TryCopyTo(primaryBackupPath, fileName, _googleDriveFolder, "Google Drive", result);
        TryCopyTo(primaryBackupPath, fileName, _externalDriveFolder, "External HDD", result);

        CleanUpOldBackups();

        _logger.LogInformation(
            "Backup created: {FileName} ({Size} bytes). Copied to: {Destinations}",
            fileName, fileInfo.Length, string.Join(", ", result.CopiedTo));

        return result;
    }

    private void TryCopyTo(string sourcePath, string fileName, string? destinationFolder, string label, BackupResult result)
    {
        if (destinationFolder is null) return; // not configured — silently skip, not an error

        try
        {
            if (!Directory.Exists(destinationFolder))
            {
                Directory.CreateDirectory(destinationFolder);
            }

            var destPath = Path.Combine(destinationFolder, fileName);
            File.Copy(sourcePath, destPath, overwrite: true);
            result.CopiedTo.Add($"{label} ({destinationFolder})");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Backup copy to {Label} failed", label);
            result.FailedDestinations.Add($"{label}: {ex.Message}");
        }
    }

    // Keeps the local backup folder from growing forever. Only cleans the
    // LOCAL folder — Google Drive / external HDD retention is left to the
    // person (Drive has its own version history; external HDD is manual).
    private void CleanUpOldBackups()
    {
        var cutoff = DateTime.UtcNow.AddDays(-_retentionDays);

        foreach (var file in Directory.GetFiles(_localBackupFolder, "cakeshop_backup_*.db"))
        {
            if (File.GetCreationTimeUtc(file) < cutoff)
            {
                try { File.Delete(file); }
                catch (Exception ex) { _logger.LogWarning(ex, "Could not delete old backup {File}", file); }
            }
        }
    }

    public Task<List<BackupFileInfo>> ListBackupsAsync()
    {
        var files = Directory.Exists(_localBackupFolder)
            ? Directory.GetFiles(_localBackupFolder, "cakeshop_backup_*.db")
            : Array.Empty<string>();

        var result = files
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTimeUtc)
            .Select(f => new BackupFileInfo
            {
                FileName = f.Name,
                SizeBytes = f.Length,
                CreatedAt = f.CreationTimeUtc
            })
            .ToList();

        return Task.FromResult(result);
    }
}