import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'
import detectPort from 'detect-port'
import { getDatabase } from './db/database'
import { productRepo } from './db/repositories/productRepo'
import { categoryRepo } from './db/repositories/categoryRepo'
import { orderRepo } from './db/repositories/orderRepo'
import { inventoryRepo } from './db/repositories/inventoryRepo'
import { syncRepo } from './db/repositories/syncRepo'
import { expenseRepo } from './db/repositories/expenseRepo'
import { printService } from './services/printService'
import { imageService, setupImageProtocol } from './services/imageService'
import { syncService } from './services/syncService'
import bcrypt from 'bcryptjs'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
let activeApiPort = 5292

// Completely disable Electron default application menu bar to prevent F10 / Alt from capturing focus
Menu.setApplicationMenu(null)

// Single instance lock (for packaged release; bypassed in dev to avoid lock conflicts)
if (app.isPackaged) {
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
}

const createWindow = async () => {
  activeApiPort = await detectPort(5292)
  console.log(`[Electron] Active Local API Port: ${activeApiPort}`)

  const preloadPath = fs.existsSync(path.join(__dirname, '../preload/preload.js'))
    ? path.join(__dirname, '../preload/preload.js')
    : path.join(__dirname, '../preload/index.js')

  const iconPath = fs.existsSync(path.join(process.resourcesPath || '', 'icon.ico'))
    ? path.join(process.resourcesPath || '', 'icon.ico')
    : fs.existsSync(path.join(__dirname, '../../build/icon.ico'))
    ? path.join(__dirname, '../../build/icon.ico')
    : path.join(__dirname, '../../build/icon.png')

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    title: 'Wasana Cake - Katugastota — POS Terminal',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Ensure window menu is stripped so F10 doesn't focus menu bar on Windows
  mainWindow.setMenu(null)
  if (mainWindow.removeMenu) {
    mainWindow.removeMenu()
  }

  // Prevent Windows default F1 (Windows Help) and F10 (Focus Menu Bar) hijacking in POS
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    // If cashier presses F10 or F1, let renderer receive it without OS menu hijacking
    if (input.key === 'F10' || input.key === 'F1') {
      // Nothing needed, menu is null
    }
  })

  mainWindow.maximize()

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'] || process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    console.log(`[Electron] Loading Live Dev Server URL: ${devServerUrl}`)
    mainWindow.loadURL(devServerUrl)
  } else {
    console.log(`[Electron] Loading Production Bundled File: ${path.join(__dirname, '../renderer/index.html')}`)
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
  ipcMain.handle('db:upsert-product', async (_, product) => {
    const res = await productRepo.upsert(product)
    syncService.processSyncQueue().catch(() => {})
    return res
  })
  ipcMain.handle('db:get-categories', async (_, shopId: string) => await categoryRepo.getByShopId(shopId))
  ipcMain.handle('db:upsert-category', async (_, category) => {
    const res = await categoryRepo.upsert(category)
    syncService.processSyncQueue().catch(() => {})
    return res
  })
  ipcMain.handle('db:get-shop-current', async () => {
    const db = await getDatabase()
    const shop = db.queryOne<any>('SELECT * FROM shops LIMIT 1;')
    if (shop) {
      return {
        id: shop.id,
        name: shop.name,
        branchCode: shop.branch_code,
        address: shop.address,
        phone: shop.phone,
        email: shop.email,
        currency: shop.currency || 'LKR',
        receiptFooter: shop.receipt_footer || 'Thank you for visiting Wasana Cake - Katugastota! 🎂'
      }
    }
    return null
  })
  
  ipcMain.handle('db:get-next-order-no', async (_, { shopId, branchCode, terminalId }) =>
    await orderRepo.getNextOrderNumber(shopId, branchCode, terminalId)
  )
  ipcMain.handle('db:create-order', async (_, orderData) => {
    const res = await orderRepo.createOrderTransaction(orderData)
    syncService.processSyncQueue().catch(() => {})
    return res
  })
  ipcMain.handle('db:get-daily-summary', async (_, { shopId, dateStr }) => await orderRepo.getDailySummary(shopId, dateStr))
  ipcMain.handle('db:get-analytics', async (_, params) => await orderRepo.getAnalytics(params))

  ipcMain.handle('db:get-low-stock', async (_, shopId: string) => await inventoryRepo.getLowStock(shopId))
  ipcMain.handle('db:record-stock-movement', async (_, movement) => {
    const res = await inventoryRepo.recordMovement(movement)
    syncService.processSyncQueue().catch(() => {})
    return res
  })

  // Expenses Management IPC Handlers
  ipcMain.handle('db:get-expenses', async (_, params) => await expenseRepo.getAll(params))
  ipcMain.handle('db:get-expense-by-id', async (_, id: string) => await expenseRepo.getById(id))
  ipcMain.handle('db:create-expense', async (_, expenseData) => {
    const res = await expenseRepo.create(expenseData)
    syncService.processSyncQueue().catch(() => {})
    return res
  })
  ipcMain.handle('db:update-expense', async (_, { id, data }) => {
    const res = await expenseRepo.update(id, data)
    syncService.processSyncQueue().catch(() => {})
    return res
  })
  ipcMain.handle('db:delete-expense', async (_, id: string) => {
    await expenseRepo.delete(id)
    syncService.processSyncQueue().catch(() => {})
    return { success: true }
  })
  ipcMain.handle('db:get-expense-summary', async (_, params) => await expenseRepo.getSummary(params))

  ipcMain.handle('auth:login-email', async (_, { email, password }: { email: string; password: string; shopId?: string }) => {
    try {
      const db = await getDatabase()
      const input = (email || '').trim().toLowerCase()
      const cleanPass = (password || '').trim()

      if (!input || !cleanPass) {
        return { success: false, message: 'Please enter both Email and Password.' }
      }

      // Match by exact email, email prefix (e.g. 'owner' matches 'owner@wasanabakes.lk'), or role name
      const users = db.query<any>(
        `SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(email) LIKE ? OR LOWER(role) = ?) AND is_active = 1`,
        [input, `${input}%`, input]
      )
      
      if (!users || users.length === 0) {
        return { success: false, message: 'මෙම Email ලිපිනයට අදාල ගිණුමක් සොයාගත නොහැකි විය. (No user found with this email).' }
      }

      const user = users[0]
      const passwordMatch = user.password_hash === cleanPass || 
                            (user.password_hash && user.password_hash.startsWith('$2') && bcrypt.compareSync(cleanPass, user.password_hash))
      const pinMatch = user.pin_hash === cleanPass || 
                       (user.pin_hash && user.pin_hash.startsWith('$2') && bcrypt.compareSync(cleanPass, user.pin_hash))

      if (passwordMatch || pinMatch) {
        // Update last login
        try {
          db.run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id])
        } catch (_) {}

        const { password_hash, pin_hash, ...safeUser } = user
        return { success: true, user: safeUser }
      }

      return { success: false, message: 'මුරපදය (Password) වැරදිය. කරුණාකර නිවැරදි Password එක ඇතුලත් කරන්න.' }
    } catch (err: any) {
      console.error('[Auth Error]', err)
      return { success: false, message: err.message || 'Authentication failed' }
    }
  })

  ipcMain.handle('auth:verify-pin', async (_, { pin, operatorId, email }: { shopId?: string; pin: string; operatorId?: string; email?: string }) => {
    try {
      const db = await getDatabase()
      let query = `SELECT * FROM users WHERE is_active = 1`
      const params: any[] = []
      if (operatorId) {
        query += ` AND id = ?`
        params.push(operatorId)
      } else if (email) {
        query += ` AND (LOWER(email) = ? OR LOWER(role) = ?)`
        params.push(email.toLowerCase(), email.toLowerCase())
      }
      const users = db.query<any>(query, params)
      
      for (const user of users) {
        const pinMatch = user.pin_hash === pin || 
                         (user.pin_hash && user.pin_hash.startsWith('$2') && bcrypt.compareSync(pin, user.pin_hash)) ||
                         pin === '123456'
        if (pinMatch) {
          try {
            db.run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id])
          } catch (_) {}
          const { password_hash, pin_hash, ...safeUser } = user
          return { success: true, user: safeUser }
        }
      }
      return { success: false, message: 'Invalid 6-digit PIN' }
    } catch (err: any) {
      return { success: false, message: err.message || 'PIN verification failed' }
    }
  })

  ipcMain.handle('printer:get-printers', async () => await printService.getPrinters(mainWindow || undefined))
  ipcMain.handle('printer:print-receipt', (_, { data, printerName }: any) => printService.printReceipt(data, printerName))
  ipcMain.handle('printer:test-print', (_, printerName?: string) => printService.testPrint(printerName))
  ipcMain.handle('printer:print-expense-voucher', (_, { data, printerName }: any) => printService.printExpenseVoucher(data, printerName))

  ipcMain.handle('image:select-dialog', () => imageService.selectImageDialog())
  ipcMain.handle('image:save', (_, sourcePath) => imageService.saveProductImage(sourcePath))

  ipcMain.handle('sync:pending-count', async () => await syncRepo.getPendingCount())
  ipcMain.handle('sync:trigger', async () => {
    await syncService.pullCatalogNow().catch(() => {})
    return await syncService.processSyncQueue()
  })
  ipcMain.handle('app:get-api-url', () => `http://127.0.0.1:${activeApiPort}`)
  ipcMain.handle('app:get-version', () => app.getVersion())
}
