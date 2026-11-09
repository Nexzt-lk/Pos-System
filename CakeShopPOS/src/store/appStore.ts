import { create } from 'zustand'
import { User, Shop } from '../types/shop'
import { useStockAlertStore } from './stockAlertStore'

interface AppState {
  currentTenantId: string
  currentShop: Shop | null
  currentTerminalId: string
  currentUser: User | null
  apiUrl: string
  isOnline: boolean
  isApiHealthy: boolean
  
  // Actions
  setShop: (shop: Shop) => void
  setTerminalId: (terminalId: string) => void
  setUser: (user: User | null) => void
  setApiUrl: (url: string) => void
  setIsOnline: (online: boolean) => void
  setIsApiHealthy: (healthy: boolean) => void
  logout: () => void
}

const DEFAULT_SHOP: Shop = {
  id: 'b0000000-0000-0000-0000-000000000001',
  tenant_id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Wasana Cake - Katugastota',
  branch_code: 'B1',
  address: 'Horana Wasana Bakers Galagedara Road Katugastota',
  phone: '071-1172201',
  currency: 'LKR',
  is_active: true
}

export const useAppStore = create<AppState>((set) => ({
  currentTenantId: 'a0000000-0000-0000-0000-000000000001',
  currentShop: DEFAULT_SHOP,
  currentTerminalId: localStorage.getItem('pos_terminal_id') || 'T1',
  currentUser: null,
  apiUrl: 'http://127.0.0.1:5292',
  isOnline: navigator.onLine,
  isApiHealthy: true,

  setShop: (shop) => set({ currentShop: shop }),
  setTerminalId: (terminalId) => {
    localStorage.setItem('pos_terminal_id', terminalId)
    set({ currentTerminalId: terminalId })
  },
  setUser: (user) => set({ currentUser: user }),
  setApiUrl: (apiUrl) => set({ apiUrl }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setIsApiHealthy: (isApiHealthy) => set({ isApiHealthy }),
  logout: () => {
    useStockAlertStore.getState().resetSession()
    set({ currentUser: null })
  }
}))
