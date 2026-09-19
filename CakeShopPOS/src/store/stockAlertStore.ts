import { create } from 'zustand'
import { normalizeProduct } from '../types/product'
import { productsApi } from '../api/productsApi'

export interface StockAlertItem {
  id: string
  name: string
  categoryName?: string
  barcode?: string
  currentStock: number
  unit: string
  isOutOfStock: boolean
  isLowStock: boolean
  threshold: number
}

interface StockAlertState {
  alertItems: StockAlertItem[]
  isLoading: boolean
  hasPromptedForSession: boolean
  isAlertModalOpen: boolean
  isPopoverOpen: boolean

  fetchStockAlerts: (shopId?: string, isInitialLoginCheck?: boolean) => Promise<StockAlertItem[]>
  dismissLoginModal: () => void
  openAlertModal: () => void
  closeAlertModal: () => void
  setIsPopoverOpen: (open: boolean) => void
  resetSession: () => void
}

export const useStockAlertStore = create<StockAlertState>((set, get) => ({
  alertItems: [],
  isLoading: false,
  hasPromptedForSession: false,
  isAlertModalOpen: false,
  isPopoverOpen: false,

  fetchStockAlerts: async (shopId?: string, isInitialLoginCheck: boolean = false) => {
    set({ isLoading: true })
    try {
      const rawProducts = await productsApi.getAll(false, shopId || 'b0000000-0000-0000-0000-000000000001')
      const targetShopId = shopId || 'b0000000-0000-0000-0000-000000000001'

      const alerts: StockAlertItem[] = []

      for (const raw of rawProducts) {
        const p = normalizeProduct(raw, targetShopId)
        if (!p.track_inventory) continue

        const stock = p.current_stock ?? 0
        const unit = (p.unit || 'pcs').toLowerCase()
        const isGram = unit === 'g'
        const threshold = isGram ? 500 : 5

        const isOutOfStock = stock <= 0
        const isLowStock = stock > 0 && stock <= threshold

        if (isOutOfStock || isLowStock) {
          alerts.push({
            id: p.id,
            name: p.name,
            categoryName: p.category_name || '',
            barcode: p.barcode || p.item_code || '',
            currentStock: stock,
            unit: p.unit || 'pcs',
            isOutOfStock,
            isLowStock,
            threshold
          })
        }
      }

      // Sort: Out of stock first, then ascending by current stock
      alerts.sort((a, b) => {
        if (a.isOutOfStock && !b.isOutOfStock) return -1
        if (!a.isOutOfStock && b.isOutOfStock) return 1
        return a.currentStock - b.currentStock
      })

      const currentState = get()
      const shouldPromptModal =
        isInitialLoginCheck && !currentState.hasPromptedForSession && alerts.length > 0

      set({
        alertItems: alerts,
        isLoading: false,
        isAlertModalOpen: shouldPromptModal ? true : currentState.isAlertModalOpen,
        hasPromptedForSession: isInitialLoginCheck ? true : currentState.hasPromptedForSession
      })

      return alerts
    } catch (err) {
      console.error('[StockAlertStore] Failed to fetch stock alerts:', err)
      set({ isLoading: false })
      return []
    }
  },

  dismissLoginModal: () => {
    set({ isAlertModalOpen: false })
  },

  openAlertModal: () => {
    set({ isAlertModalOpen: true, isPopoverOpen: false })
  },

  closeAlertModal: () => {
    set({ isAlertModalOpen: false })
  },

  setIsPopoverOpen: (open: boolean) => {
    set({ isPopoverOpen: open })
  },

  resetSession: () => {
    set({
      hasPromptedForSession: false,
      isAlertModalOpen: false,
      isPopoverOpen: false
    })
  }
}))
