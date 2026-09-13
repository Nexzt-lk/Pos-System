import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
export interface ElectronAPI {
  // Database Operations
  dbQuery: (channel: string, data?: any) => Promise<any>
  getProducts: (shopId?: string) => Promise<any[]>
  getProductByBarcode: (params: { shopId?: string; barcode: string }) => Promise<any>
  upsertProduct: (product: any) => Promise<void>
  getCategories: (shopId?: string) => Promise<any[]>
  upsertCategory: (category: any) => Promise<void>
  
  // Hardware & Printing
  getPrinters: () => Promise<any[]>
  printReceipt: (receiptData: any, printerName?: string) => Promise<{ success: boolean; message?: string; printerUsed?: string }>
  testPrint: (printerName?: string) => Promise<{ success: boolean; message?: string; printerUsed?: string }>
  
  // Image Storage (AppData)
  saveProductImage: (sourceFilePath: string) => Promise<{ success: boolean; relativePath?: string; error?: string }>
  selectImageDialog: () => Promise<string | null>
  
  // Sync & Cloud
  getPendingSyncCount: () => Promise<number>
  triggerSync: () => Promise<{ success: boolean; count?: number; error?: string }>
  
  // Local .NET API Info
  getApiUrl: () => Promise<string>
  getAppVersion: () => Promise<string>
}

const electronAPI: ElectronAPI = {
  dbQuery: (channel, data) => ipcRenderer.invoke(channel, data),
  getProducts: (shopId) => ipcRenderer.invoke('db:get-products', shopId),
  getProductByBarcode: (params) => ipcRenderer.invoke('db:get-product-by-barcode', params),
  upsertProduct: (product) => ipcRenderer.invoke('db:upsert-product', product),
  getCategories: (shopId) => ipcRenderer.invoke('db:get-categories', shopId),
  upsertCategory: (category) => ipcRenderer.invoke('db:upsert-category', category),
  getPrinters: () => ipcRenderer.invoke('printer:get-printers'),
  printReceipt: (receiptData, printerName) => ipcRenderer.invoke('printer:print-receipt', { data: receiptData, printerName }),
  testPrint: (printerName) => ipcRenderer.invoke('printer:test-print', printerName),
  saveProductImage: (sourceFilePath) => ipcRenderer.invoke('image:save', sourceFilePath),
  selectImageDialog: () => ipcRenderer.invoke('image:select-dialog'),
  getPendingSyncCount: () => ipcRenderer.invoke('sync:pending-count'),
  triggerSync: () => ipcRenderer.invoke('sync:trigger'),
  getApiUrl: () => ipcRenderer.invoke('app:get-api-url'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version')
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
