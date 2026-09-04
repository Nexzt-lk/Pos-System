using CakeShop.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CakeShop.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BackupController : ControllerBase
{
    private readonly IBackupService _backupService;
    public BackupController(IBackupService backupService) => _backupService = backupService;

    // Triggers a backup immediately — useful for "back up before I close up
    // shop tonight" instead of waiting for the scheduled job.
    [HttpPost("run")]
    public async Task<IActionResult> RunBackup()
    {
        var result = await _backupService.RunBackupAsync();
        return Ok(result);
    }

    [HttpGet("list")]
    public async Task<IActionResult> ListBackups()
    {
        var backups = await _backupService.ListBackupsAsync();
        return Ok(backups);
    }
}