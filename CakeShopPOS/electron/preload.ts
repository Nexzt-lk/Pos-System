import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
export interface ElectronAPI {
  // Database Operations
  dbQuery: (channel: string, data?: any) => Promise<any>
  getProducts: (shopId?: string) => Promise<any[]>
  getProductByBarcode: (params: { shopId?: string; barcode: string }) => Promise<any>
  upsertProduct: (product: any) => Promise<void>
  deleteProduct: (id: string) => Promise<{ success: boolean; softDeleted: boolean }>
  getCategories: (shopId?: string) => Promise<any[]>
  upsertCategory: (category: any) => Promise<void>
  
  // Suppliers Management
  getSuppliers: () => Promise<any[]>
  createSupplier: (data: any) => Promise<any>
  updateSupplier: (id: string, data: any) => Promise<any>
  deleteSupplier: (id: string) => Promise<boolean>

  // Stock Movement & Purchases
  getStockPurchases: (params?: any) => Promise<any[]>
  recordStockMovement: (movement: any) => Promise<any>

  // Expenses Management
  getExpenses: (params?: any) => Promise<any[]>
  getExpenseById: (id: string) => Promise<any>
  createExpense: (expense: any) => Promise<any>
  updateExpense: (id: string, expense: any) => Promise<any>
  deleteExpense: (id: string) => Promise<{ success: boolean }>
  getExpenseSummary: (params?: any) => Promise<any>
  printExpenseVoucher: (data: any, printerName?: string) => Promise<{ success: boolean; message?: string; printerUsed?: string }>

  // Cash Session (Opening Float)
  getTodayCashSession: (terminalId?: string) => Promise<any | null>
  getCashSessionByDate: (date: string, terminalId?: string) => Promise<any | null>
  createCashSession: (data: { openingFloat: number; shopId?: string; cashierId?: string; cashierName?: string; terminalId?: string; notes?: string }) => Promise<any>
  getRecentCashSessions: (limit?: number) => Promise<any[]>

  // Hardware & Printing
  getPrinters: () => Promise<any[]>
  printReceipt: (receiptData: any, printerName?: string) => Promise<{ success: boolean; message?: string; printerUsed?: string }>
  testPrint: (printerName?: string) => Promise<{ success: boolean; message?: string; printerUsed?: string }>
  
  // Image Storage (AppData)
  saveProductImage: (sourceFilePath: string) => Promise<{ success: boolean; relativePath?: string; error?: string }>
  saveBase64Image: (base64Data: string, prefix?: string) => Promise<{ success: boolean; relativePath?: string; error?: string }>
  selectImageDialog: () => Promise<string | null>
  
  // Sync & Cloud
  getPendingSyncCount: () => Promise<number>
  triggerSync: () => Promise<{ success: boolean; count?: number; error?: string }>
  
  // Local .NET API Info
  getApiUrl: () => Promise<string>
  getAppVersion: () => Promise<string>

  // Auto-Updater
  checkForUpdates: () => Promise<any>
  installUpdate: () => Promise<void>
  getUpdaterStatus: () => Promise<any>
  onUpdaterStatus: (callback: (status: any) => void) => () => void
}

const electronAPI: ElectronAPI = {
  dbQuery: (channel, data) => ipcRenderer.invoke(channel, data),
  getProducts: (shopId) => ipcRenderer.invoke('db:get-products', shopId),
  getProductByBarcode: (params) => ipcRenderer.invoke('db:get-product-by-barcode', params),
  upsertProduct: (product) => ipcRenderer.invoke('db:upsert-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('db:delete-product', id),
  getCategories: (shopId) => ipcRenderer.invoke('db:get-categories', shopId),
  upsertCategory: (category) => ipcRenderer.invoke('db:upsert-category', category),

  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('db:get-suppliers'),
  createSupplier: (data) => ipcRenderer.invoke('db:create-supplier', data),
  updateSupplier: (id, data) => ipcRenderer.invoke('db:update-supplier', { id, data }),
  deleteSupplier: (id) => ipcRenderer.invoke('db:delete-supplier', id),

  // Stock Movements & Purchases
  getStockPurchases: (params) => ipcRenderer.invoke('db:get-stock-purchases', params),
  recordStockMovement: (movement) => ipcRenderer.invoke('db:record-stock-movement', movement),

  // Expenses
  getExpenses: (params) => ipcRenderer.invoke('db:get-expenses', params),
  getExpenseById: (id) => ipcRenderer.invoke('db:get-expense-by-id', id),
  createExpense: (expense) => ipcRenderer.invoke('db:create-expense', expense),
  updateExpense: (id, expense) => ipcRenderer.invoke('db:update-expense', { id, data: expense }),
  deleteExpense: (id) => ipcRenderer.invoke('db:delete-expense', id),
  getExpenseSummary: (params) => ipcRenderer.invoke('db:get-expense-summary', params),
  printExpenseVoucher: (data, printerName) => ipcRenderer.invoke('printer:print-expense-voucher', { data, printerName }),

  // Cash Sessions
  getTodayCashSession: (terminalId) => ipcRenderer.invoke('db:get-today-cash-session', terminalId),
  getCashSessionByDate: (date, terminalId) => ipcRenderer.invoke('db:get-cash-session-by-date', { date, terminalId }),
  createCashSession: (data) => ipcRenderer.invoke('db:create-cash-session', data),
  getRecentCashSessions: (limit) => ipcRenderer.invoke('db:get-recent-cash-sessions', limit),

  getPrinters: () => ipcRenderer.invoke('printer:get-printers'),
  printReceipt: (receiptData, printerName) => ipcRenderer.invoke('printer:print-receipt', { data: receiptData, printerName }),
  testPrint: (printerName) => ipcRenderer.invoke('printer:test-print', printerName),
  saveProductImage: (sourceFilePath) => ipcRenderer.invoke('image:save', sourceFilePath),
  saveBase64Image: (base64Data, prefix) => ipcRenderer.invoke('image:save-base64', { base64Data, prefix }),
  selectImageDialog: () => ipcRenderer.invoke('image:select-dialog'),
  getPendingSyncCount: () => ipcRenderer.invoke('sync:pending-count'),
  triggerSync: () => ipcRenderer.invoke('sync:trigger'),
  getApiUrl: () => ipcRenderer.invoke('app:get-api-url'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('updater:quit-and-install'),
  getUpdaterStatus: () => ipcRenderer.invoke('updater:get-status'),
  onUpdaterStatus: (callback: (status: any) => void) => {
    const handler = (_: any, status: any) => callback(status)
    ipcRenderer.on('updater:status', handler)
    return () => {
      ipcRenderer.removeListener('updater:status', handler)
    }
  }
}

// Use `contextBridge` to expose Electron APIs safely
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error('Failed to expose electronAPI:', error)
  }
} else {
  // @ts-ignore (fallback)
  window.electronAPI = electronAPI
}
