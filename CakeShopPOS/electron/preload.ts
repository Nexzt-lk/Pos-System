import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
export interface ElectronAPI {
  // Database Operations
  dbQuery: (channel: string, data?: any) => Promise<any>
  
  // Hardware & Printing
  printReceipt: (receiptData: any) => Promise<{ success: boolean; message?: string }>
  testPrint: () => Promise<{ success: boolean; message?: string }>
  
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
  printReceipt: (receiptData) => ipcRenderer.invoke('printer:print-receipt', receiptData),
  testPrint: () => ipcRenderer.invoke('printer:test-print'),
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
