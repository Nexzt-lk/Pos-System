import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export interface UpdaterStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  newVersion?: string
  releaseNotes?: string
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  error?: string
  lastChecked?: string
}

class UpdaterService {
  private mainWindow: BrowserWindow | null = null
  private currentStatus: UpdaterStatus = {
    status: 'idle',
    currentVersion: app.getVersion()
  }
  private checkIntervalTimer: NodeJS.Timeout | null = null

  public init(window: BrowserWindow) {
    this.mainWindow = window
    this.currentStatus.currentVersion = app.getVersion()

    // Configure autoUpdater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.allowDowngrade = false

    this.registerEvents()

    // Automatically check for updates 15 seconds after app startup if running in production
    if (app.isPackaged) {
      setTimeout(() => {
        this.checkForUpdates()
      }, 15000)

      // Periodic check every 2 hours
      this.checkIntervalTimer = setInterval(() => {
        this.checkForUpdates()
      }, 2 * 60 * 60 * 1000)
    }
  }

  private registerEvents() {
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates...')
      this.updateState({
        status: 'checking',
        lastChecked: new Date().toISOString()
      })
    })

    autoUpdater.on('update-available', (info) => {
      console.log(`[AutoUpdater] Update available: v${info.version}`)
      this.updateState({
        status: 'available',
        newVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log(`[AutoUpdater] App is up to date (current: v${info.version})`)
      this.updateState({
        status: 'not-available',
        lastChecked: new Date().toISOString()
      })
    })

    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`[AutoUpdater] Downloading update: ${progressObj.percent.toFixed(1)}%`)
      this.updateState({
        status: 'downloading',
        percent: Math.round(progressObj.percent),
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[AutoUpdater] Update v${info.version} downloaded and ready to install.`)
      this.updateState({
        status: 'downloaded',
        newVersion: info.version,
        percent: 100
      })
    })

    autoUpdater.on('error', (err) => {
      const errMsg = err?.message || 'Unknown update error'
      console.warn('[AutoUpdater] Update error:', errMsg)
      this.updateState({
        status: 'error',
        error: errMsg,
        lastChecked: new Date().toISOString()
      })
    })
  }

  private updateState(partial: Partial<UpdaterStatus>) {
    this.currentStatus = {
      ...this.currentStatus,
      ...partial,
      currentVersion: app.getVersion()
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', this.currentStatus)
    }
  }

  public async checkForUpdates(): Promise<UpdaterStatus> {
    if (!app.isPackaged) {
      console.log('[AutoUpdater] Skipping update check in development mode.')
      this.updateState({
        status: 'not-available',
        error: 'Auto-update check is only active in packaged production builds.'
      })
      return this.currentStatus
    }

    try {
      this.updateState({ status: 'checking' })
      await autoUpdater.checkForUpdates()
    } catch (err: any) {
      console.warn('[AutoUpdater] Failed to check for updates:', err?.message)
      this.updateState({
        status: 'error',
        error: err?.message || 'Failed to check for updates'
      })
    }

    return this.currentStatus
  }

  public quitAndInstall() {
    console.log('[AutoUpdater] Restarting application to apply update...')
    // isSilent = false, isForceRunAfter = true
    autoUpdater.quitAndInstall(false, true)
  }

  public getStatus(): UpdaterStatus {
    return this.currentStatus
  }

  public destroy() {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer)
      this.checkIntervalTimer = null
    }
  }
}

export const updaterService = new UpdaterService()
