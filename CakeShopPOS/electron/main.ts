import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import detectPort from 'detect-port'
import { getDatabase } from './db/database'
import { productRepo } from './db/repositories/productRepo'
import { categoryRepo } from './db/repositories/categoryRepo'
import { orderRepo } from './db/repositories/orderRepo'
import { inventoryRepo } from './db/repositories/inventoryRepo'
import { syncRepo } from './db/repositories/syncRepo'
import { printService } from './services/printService'
import { imageService, setupImageProtocol } from './services/imageService'
import { syncService } from './services/syncService'
import bcrypt from 'bcryptjs'

let mainWindow: BrowserWindow | null = null
let activeApiPort = 5000

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

const createWindow = async () => {
  // Find available port for local API supervisor
  activeApiPort = await detectPort(5000)
  console.log(`[Electron] Active Local API Port: ${activeApiPort}`)

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#020617', // Slate 950
    autoHideMenuBar: true,
    title: '🎂 Rasa Cake House — POS Terminal',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.maximize()

  // Load URL
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Start background sync
  syncService.startBackgroundSync(() => `http://127.0.0.1:${activeApiPort}`, 30000)
}

// App lifecycle
app.whenReady().then(() => {
  // Setup custom protocol for local product images
  setupImageProtocol()

  // Initialize SQLite database
  getDatabase()

  // Register IPC Handlers
  setupIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  syncService.stopBackgroundSync()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Setup IPC Handlers
function setupIpcHandlers() {
  // Database & Repositories
  ipcMain.handle('db:get-products', (_, shopId: string) => productRepo.getByShopId(shopId))
  ipcMain.handle('db:get-product-by-barcode', (_, { shopId, barcode }) => productRepo.getByBarcode(shopId, barcode))
  ipcMain.handle('db:upsert-product', (_, product) => productRepo.upsert(product))
  ipcMain.handle('db:get-categories', (_, shopId: string) => categoryRepo.getByShopId(shopId))
  ipcMain.handle('db:upsert-category', (_, category) => categoryRepo.upsert(category))
  
  // Orders & Billing
  ipcMain.handle('db:get-next-order-no', (_, { shopId, branchCode, terminalId }) =>
    orderRepo.getNextOrderNumber(shopId, branchCode, terminalId)
  )
  ipcMain.handle('db:create-order', (_, orderData) => orderRepo.createOrderTransaction(orderData))
  ipcMain.handle('db:get-daily-summary', (_, { shopId, dateStr }) => orderRepo.getDailySummary(shopId, dateStr))

  // Inventory
  ipcMain.handle('db:get-low-stock', (_, shopId: string) => inventoryRepo.getLowStock(shopId))
  ipcMain.handle('db:record-stock-movement', (_, movement) => inventoryRepo.recordMovement(movement))

  // Auth & PIN Verification (BCrypt Hash compare)
  ipcMain.handle('auth:verify-pin', (_, { shopId, pin }: { shopId: string; pin: string }) => {
    const db = getDatabase()
    const users = db.prepare(`SELECT * FROM users WHERE shop_id = ? AND is_active = 1`).all(shopId) as any[]
    
    for (const user of users) {
      if (user.pin_hash && bcrypt.compareSync(pin, user.pin_hash)) {
        const { pin_hash, ...safeUser } = user
        return { success: true, user: safeUser }
      }
    }
    return { success: false, message: 'Invalid 6-digit PIN' }
  })

  // Hardware & Printing
  ipcMain.handle('printer:print-receipt', (_, data) => printService.printReceipt(data))
  ipcMain.handle('printer:test-print', () => printService.testPrint())

  // Image Storage
  ipcMain.handle('image:select-dialog', () => imageService.selectImageDialog())
  ipcMain.handle('image:save', (_, sourcePath) => imageService.saveProductImage(sourcePath))

  // Sync & Info
  ipcMain.handle('sync:pending-count', () => syncRepo.getPendingCount())
  ipcMain.handle('sync:trigger', () => syncService.processSyncQueue(`http://127.0.0.1:${activeApiPort}`))
  ipcMain.handle('app:get-api-url', () => `http://127.0.0.1:${activeApiPort}`)
  ipcMain.handle('app:get-version', () => app.getVersion())
}
