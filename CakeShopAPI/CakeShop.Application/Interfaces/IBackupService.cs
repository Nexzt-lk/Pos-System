namespace CakeShop.Application.Interfaces;

public interface IBackupService
{
    // Creates one consistent backup snapshot and copies it to every
    // configured destination (local folder, Google Drive sync folder,
    // external HDD). Returns info about what was created.
    Task<BackupResult> RunBackupAsync();

    // Lists backups found in the primary local backup folder, newest first.
    Task<List<BackupFileInfo>> ListBackupsAsync();
}

public class BackupResult
{
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> CopiedTo { get; set; } = new();      // destinations that succeeded
    public List<string> FailedDestinations { get; set; } = new(); // destinations that failed, with reason
}

public class BackupFileInfo
{
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}