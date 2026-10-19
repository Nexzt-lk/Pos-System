import { apiClient } from './apiClient'

export interface CakeOrderDto {
  id: string
  orderNo: string
  order_no?: string
  shopId?: string
  shop_id?: string
  customerName: string
  customer_name?: string
  customerPhone: string
  customer_phone?: string
  customerEmail?: string
  customer_email?: string
  cakeName: string
  cake_name?: string
  flavor?: string
  weightKg: number
  weight_kg?: number
  shape?: string
  tierCount: number
  tier_count?: number
  wording?: string
  specialInstructions?: string
  special_instructions?: string
  referenceImage?: string
  reference_image?: string
  pickupDate: string
  pickup_date?: string
  pickupTime?: string
  pickup_time?: string
  totalAmount: number
  total_amount?: number
  advanceAmount: number
  advance_amount?: number
  balanceAmount: number
  balance_amount?: number
  advancePaymentMethod: string
  advance_payment_method?: string
  balancePaymentMethod?: string
  balance_payment_method?: string
  paymentStatus: 'pending' | 'advance_paid' | 'fully_paid'
  payment_status?: 'pending' | 'advance_paid' | 'fully_paid'
  status: 'pending' | 'baking' | 'ready' | 'completed' | 'cancelled'
  takenBy?: string
  taken_by?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  completedAt?: string
  completed_at?: string
  syncStatus?: string
  sync_status?: string
}

export interface CreateCakeOrderRequest {
  shopId?: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  cakeName: string
  flavor?: string
  weightKg?: number
  shape?: string
  tierCount?: number
  wording?: string
  specialInstructions?: string
  referenceImage?: string
  pickupDate: string
  pickupTime?: string
  totalAmount: number
  advanceAmount: number
  advancePaymentMethod?: string
  takenBy?: string
}

export function normalizeCakeOrder(raw: any): CakeOrderDto {
  return {
    id: raw.id || String(Math.random()),
    orderNo: raw.orderNo || raw.order_no || 'CK-000',
    order_no: raw.order_no || raw.orderNo,
    shopId: raw.shopId || raw.shop_id,
    shop_id: raw.shop_id || raw.shopId,
    customerName: raw.customerName || raw.customer_name || 'Walk-in Customer',
    customer_name: raw.customer_name || raw.customerName,
    customerPhone: raw.customerPhone || raw.customer_phone || '',
    customer_phone: raw.customer_phone || raw.customerPhone,
    customerEmail: raw.customerEmail || raw.customer_email || undefined,
    customer_email: raw.customer_email || raw.customerEmail,
    cakeName: raw.cakeName || raw.cake_name || 'Custom Cake',
    cake_name: raw.cake_name || raw.cakeName,
    flavor: raw.flavor || '',
    weightKg: Number(raw.weightKg ?? raw.weight_kg ?? 1),
    weight_kg: Number(raw.weight_kg ?? raw.weightKg ?? 1),
    shape: raw.shape || 'Round',
    tierCount: Number(raw.tierCount ?? raw.tier_count ?? 1),
    tier_count: Number(raw.tier_count ?? raw.tierCount ?? 1),
    wording: raw.wording || '',
    specialInstructions: raw.specialInstructions || raw.special_instructions || '',
    special_instructions: raw.special_instructions || raw.specialInstructions,
    referenceImage: raw.referenceImage || raw.reference_image || undefined,
    reference_image: raw.reference_image || raw.referenceImage,
    pickupDate: (raw.pickupDate || raw.pickup_date || '').slice(0, 10),
    pickup_date: (raw.pickup_date || raw.pickupDate || '').slice(0, 10),
    pickupTime: raw.pickupTime || raw.pickup_time || '',
    pickup_time: raw.pickup_time || raw.pickupTime,
    totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
    total_amount: Number(raw.total_amount ?? raw.totalAmount ?? 0),
    advanceAmount: Number(raw.advanceAmount ?? raw.advance_amount ?? 0),
    advance_amount: Number(raw.advance_amount ?? raw.advanceAmount ?? 0),
    balanceAmount: Number(raw.balanceAmount ?? raw.balance_amount ?? 0),
    balance_amount: Number(raw.balance_amount ?? raw.balanceAmount ?? 0),
    advancePaymentMethod: raw.advancePaymentMethod || raw.advance_payment_method || 'CASH',
    advance_payment_method: raw.advance_payment_method || raw.advancePaymentMethod,
    balancePaymentMethod: raw.balancePaymentMethod || raw.balance_payment_method || undefined,
    balance_payment_method: raw.balance_payment_method || raw.balancePaymentMethod,
    paymentStatus: raw.paymentStatus || raw.payment_status || 'pending',
    payment_status: raw.payment_status || raw.paymentStatus,
    status: raw.status || 'pending',
    takenBy: raw.takenBy || raw.taken_by || 'Cashier',
    taken_by: raw.taken_by || raw.takenBy,
    createdAt: raw.createdAt || raw.created_at,
    created_at: raw.created_at || raw.createdAt,
    updatedAt: raw.updatedAt || raw.updated_at,
    updated_at: raw.updated_at || raw.updatedAt,
    completedAt: raw.completedAt || raw.completed_at,
    completed_at: raw.completed_at || raw.completedAt,
    syncStatus: raw.syncStatus || raw.sync_status,
    sync_status: raw.sync_status || raw.syncStatus
  }
}

export const cakeOrdersApi = {
  getAll: async (params?: { shopId?: string; status?: string; startDate?: string; endDate?: string; search?: string; dueTodayOnly?: boolean }): Promise<CakeOrderDto[]> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getCakeOrders) {
      try {
        const rows = await api.getCakeOrders(params)
        return (rows || []).map(normalizeCakeOrder)
      } catch (e) {
        console.warn('[CakeOrdersApi] getCakeOrders IPC error:', e)
      }
    }

    try {
      const res = await apiClient.get<any[]>('/cake-orders', { params })
      if (Array.isArray(res)) return res.map(normalizeCakeOrder)
    } catch (_) {}

    return []
  },

  getById: async (id: string): Promise<CakeOrderDto | null> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getCakeOrderById) {
      try {
        const row = await api.getCakeOrderById(id)
        return row ? normalizeCakeOrder(row) : null
      } catch (e) {
        console.warn('[CakeOrdersApi] getCakeOrderById IPC error:', e)
      }
    }
    return null
  },

  getDueTodayCount: async (shopId?: string): Promise<number> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getCakeOrdersDueCount) {
      try {
        return await api.getCakeOrdersDueCount(shopId)
      } catch (e) {
        console.warn('[CakeOrdersApi] getCakeOrdersDueCount IPC error:', e)
      }
    }
    return 0
  },

  getUpcoming: async (params?: { shopId?: string; limit?: number }): Promise<CakeOrderDto[]> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getUpcomingCakeOrders) {
      try {
        const rows = await api.getUpcomingCakeOrders(params)
        return (rows || []).map(normalizeCakeOrder)
      } catch (e) {
        console.warn('[CakeOrdersApi] getUpcomingCakeOrders IPC error:', e)
      }
    }
    return []
  },

  getSummary: async (shopId?: string) => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getCakeOrderSummary) {
      try {
        return await api.getCakeOrderSummary(shopId)
      } catch (e) {
        console.warn('[CakeOrdersApi] getCakeOrderSummary IPC error:', e)
      }
    }
    return {
      dueTodayCount: 0,
      activeCount: 0,
      readyCount: 0,
      totalOrders: 0,
      totalAdvanceActive: 0,
      totalBalanceActive: 0,
      totalRevenue: 0
    }
  },

  getNextOrderNo: async (shopId?: string): Promise<string> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getNextCakeOrderNo) {
      try {
        return await api.getNextCakeOrderNo(shopId)
      } catch (e) {
        console.warn('[CakeOrdersApi] getNextCakeOrderNo error:', e)
      }
    }
    return `CK-${Date.now().toString().slice(-6)}`
  },

  create: async (data: CreateCakeOrderRequest): Promise<CakeOrderDto> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.createCakeOrder) {
      const res = await api.createCakeOrder(data)
      return normalizeCakeOrder(res)
    }

    const res = await apiClient.post<any>('/cake-orders', data)
    return normalizeCakeOrder(res)
  },

  updateStatus: async (id: string, status: 'pending' | 'baking' | 'ready' | 'completed' | 'cancelled'): Promise<boolean> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.updateCakeOrderStatus) {
      return await api.updateCakeOrderStatus(id, status)
    }
    return false
  },

  collectBalance: async (id: string, paymentMethod: string): Promise<CakeOrderDto | null> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.collectCakeOrderBalance) {
      const res = await api.collectCakeOrderBalance(id, paymentMethod)
      return res ? normalizeCakeOrder(res) : null
    }
    return null
  },

  delete: async (id: string): Promise<boolean> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.deleteCakeOrder) {
      return await api.deleteCakeOrder(id)
    }
    return false
  },

  printSlip: async (data: any, printerName?: string): Promise<{ success: boolean; message?: string }> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.printCakeOrderSlip) {
      return await api.printCakeOrderSlip(data, printerName)
    }
    return { success: false, message: 'Electron printer API not available' }
  }
}
