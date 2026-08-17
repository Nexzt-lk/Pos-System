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
import fs from 'fs'

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
  activeApiPort = await detectPort(5000)
  console.log(`[Electron] Active Local API Port: ${activeApiPort}`)

  const preloadPath = fs.existsSync(path.join(__dirname, '../preload/preload.js'))
    ? path.join(__dirname, '../preload/preload.js')
    : path.join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    title: '🎂 Rasa Cake House — POS Terminal',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.maximize()

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  syncService.startBackgroundSync(() => `http://127.0.0.1:${activeApiPort}`, 30000)
}

app.whenReady().then(async () => {
  setupImageProtocol()

  // Initialize SQLite database
  await getDatabase()

  // Register IPC Handlers
  setupIpcHandlers()

  await createWindow()

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

function setupIpcHandlers() {
  ipcMain.handle('db:get-products', async (_, shopId: string) => await productRepo.getByShopId(shopId))
  ipcMain.handle('db:get-product-by-barcode', async (_, { shopId, barcode }) => await productRepo.getByBarcode(shopId, barcode))
  ipcMain.handle('db:upsert-product', async (_, product) => await productRepo.upsert(product))
  ipcMain.handle('db:get-categories', async (_, shopId: string) => await categoryRepo.getByShopId(shopId))
  ipcMain.handle('db:upsert-category', async (_, category) => await categoryRepo.upsert(category))
  
  ipcMain.handle('db:get-next-order-no', async (_, { shopId, branchCode, terminalId }) =>
    await orderRepo.getNextOrderNumber(shopId, branchCode, terminalId)
  )
  ipcMain.handle('db:create-order', async (_, orderData) => await orderRepo.createOrderTransaction(orderData))
  ipcMain.handle('db:get-daily-summary', async (_, { shopId, dateStr }) => await orderRepo.getDailySummary(shopId, dateStr))

  ipcMain.handle('db:get-low-stock', async (_, shopId: string) => await inventoryRepo.getLowStock(shopId))
  ipcMain.handle('db:record-stock-movement', async (_, movement) => await inventoryRepo.recordMovement(movement))

  ipcMain.handle('auth:verify-pin', async (_, { shopId, pin }: { shopId: string; pin: string }) => {
    const db = await getDatabase()
    const users = db.query<any>(`SELECT * FROM users WHERE shop_id = ? AND is_active = 1`, [shopId])
    
    for (const user of users) {
      if (user.pin_hash && bcrypt.compareSync(pin, user.pin_hash)) {
        const { pin_hash, ...safeUser } = user
        return { success: true, user: safeUser }
      }
    }
    return { success: false, message: 'Invalid 6-digit PIN' }
  })

  ipcMain.handle('printer:print-receipt', (_, data) => printService.printReceipt(data))
  ipcMain.handle('printer:test-print', () => printService.testPrint())

  ipcMain.handle('image:select-dialog', () => imageService.selectImageDialog())
  ipcMain.handle('image:save', (_, sourcePath) => imageService.saveProductImage(sourcePath))

  ipcMain.handle('sync:pending-count', async () => await syncRepo.getPendingCount())
  ipcMain.handle('sync:trigger', () => syncService.processSyncQueue(`http://127.0.0.1:${activeApiPort}`))
  ipcMain.handle('app:get-api-url', () => `http://127.0.0.1:${activeApiPort}`)
  ipcMain.handle('app:get-version', () => app.getVersion())
}
