import { create } from 'zustand'
import { Product } from '../types/product'
import { OrderItem, DiscountType, PaymentMethod } from '../types/order'

export interface CartItem extends OrderItem {
  barcode?: string
  image_path?: string
  unit: string
  current_stock?: number
  track_inventory?: boolean
}

interface CartState {
  items: CartItem[]
  discountType: DiscountType
  discountValue: number // percentage (0-100) or fixed amount
  taxRate: number // percentage e.g. 0%
  customerNote: string
  paymentMethod: PaymentMethod
  cashTendered: number

  // Actions
  addItem: (product: Product, quantity?: number, replaceQty?: boolean, customSubtotal?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setItemQuantity: (productId: string, quantity: number) => void
  setItemDiscount: (productId: string, discountAmount: number) => void
  setOrderDiscount: (type: DiscountType, value: number) => void
  setCustomerNote: (note: string) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setCashTendered: (amount: number) => void
  clearCart: () => void

  // Computed Selectors
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTaxAmount: () => number
  getTotalAmount: () => number
  getChangeAmount: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discountType: 'fixed',
  discountValue: 0,
  taxRate: 0,
  customerNote: '',
  paymentMethod: 'CASH',
  cashTendered: 0,

  addItem: (product, quantity = 1, replaceQty = false, customSubtotal?: number) => {
    let qty = Math.round(quantity * 1000) / 1000
    if (qty <= 0) return

    // If stock is tracked, enforce max available stock
    if (product.track_inventory && product.current_stock !== undefined) {
      if (product.current_stock <= 0) {
        return // out of stock, cannot add
      }
      if (qty > product.current_stock) {
        qty = product.current_stock
      }
    }

    set((state) => {
      const existingIndex = state.items.findIndex((i) => i.product_id === product.id)
      if (existingIndex > -1) {
        const updated = [...state.items]
        const existing = updated[existingIndex]
        let newQty = replaceQty ? qty : Math.round((existing.quantity + qty) * 1000) / 1000

        // If stock is tracked, clamp to max available stock
        if (product.track_inventory && product.current_stock !== undefined) {
          if (newQty > product.current_stock) {
            newQty = product.current_stock
          }
        }

        const calculatedSubtotal = customSubtotal !== undefined
          ? Math.max(0, Math.round(customSubtotal * 100) / 100)
          : Math.round((newQty * existing.unit_price - existing.discount) * 100) / 100
        existing.quantity = newQty
        existing.subtotal = Math.max(0, calculatedSubtotal)
        existing.current_stock = product.current_stock
        existing.track_inventory = Boolean(product.track_inventory)
        return { items: updated }
      } else {
        const calculatedSubtotal = customSubtotal !== undefined
          ? Math.max(0, Math.round(customSubtotal * 100) / 100)
          : Math.round((qty * product.price) * 100) / 100
        const newItem: CartItem = {
          shop_id: product.shop_id || 'default',
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          cost_price: product.cost_price,
          quantity: qty,
          discount: 0,
          subtotal: calculatedSubtotal,
          barcode: product.barcode,
          image_path: product.image_path,
          unit: product.unit || 'pcs',
          current_stock: product.current_stock,
          track_inventory: Boolean(product.track_inventory)
        }
        return { items: [...state.items, newItem] }
      }
    })
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.product_id !== productId)
    }))
  },

  setItemQuantity: (productId, quantity) => {
    let qty = Math.round(quantity * 1000) / 1000
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((item) => {
        if (item.product_id === productId) {
          if (item.track_inventory && item.current_stock !== undefined && qty > item.current_stock) {
            qty = item.current_stock
          }
          return {
            ...item,
            quantity: qty,
            subtotal: Math.max(0, Math.round((qty * item.unit_price - item.discount) * 100) / 100)
          }
        }
        return item
      })
    }))
  },

  updateQuantity: (productId, quantity) => {
    let qty = Math.round(quantity * 1000) / 1000
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((item) => {
        if (item.product_id === productId) {
          if (item.track_inventory && item.current_stock !== undefined && qty > item.current_stock) {
            qty = item.current_stock
          }
          return {
            ...item,
            quantity: qty,
            subtotal: Math.max(0, Math.round((qty * item.unit_price - item.discount) * 100) / 100)
          }
        }
        return item
      })
    }))
  },

  setItemDiscount: (productId, discountAmount) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              discount: Math.max(0, discountAmount),
              subtotal: Math.max(0, item.quantity * item.unit_price - discountAmount)
            }
          : item
      )
    }))
  },

  setOrderDiscount: (type, value) => {
    set({ discountType: type, discountValue: Math.max(0, value) })
  },

  setCustomerNote: (note) => set({ customerNote: note }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setCashTendered: (amount) => set({ cashTendered: amount }),

  clearCart: () =>
    set({
      items: [],
      discountType: 'fixed',
      discountValue: 0,
      customerNote: '',
      cashTendered: 0
    }),

  getSubtotal: () => {
    return Math.round(
      get().items.reduce((sum, item) => sum + (item.subtotal ?? (item.quantity * item.unit_price)), 0) * 100
    ) / 100
  },

  getDiscountAmount: () => {
    const { discountType, discountValue, items } = get()
    const itemDiscounts = items.reduce((sum, item) => sum + item.discount, 0)
    const subtotal = get().getSubtotal()

    let orderDiscount = 0
    if (discountType === 'percent') {
      orderDiscount = (subtotal * discountValue) / 100
    } else {
      orderDiscount = discountValue
    }

    return itemDiscounts + orderDiscount
  },

  getTaxAmount: () => {
    const { taxRate } = get()
    if (taxRate <= 0) return 0
    const taxableAmount = Math.max(0, get().getSubtotal() - get().getDiscountAmount())
    return (taxableAmount * taxRate) / 100
  },

  getTotalAmount: () => {
    const subtotal = get().getSubtotal()
    const discount = get().getDiscountAmount()
    const tax = get().getTaxAmount()
    return Math.max(0, subtotal - discount + tax)
  },

  getChangeAmount: () => {
    const { cashTendered } = get()
    const total = get().getTotalAmount()
    return Math.max(0, cashTendered - total)
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0)
  }
}))
