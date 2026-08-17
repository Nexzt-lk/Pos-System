export type DiscountType = 'percent' | 'fixed'
export type OrderStatus = 'completed' | 'refunded' | 'voided'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED'
export type SyncStatus = 'pending' | 'synced' | 'conflict'

export interface OrderItem {
  id?: string
  shop_id: string
  order_id?: string
  product_id: string
  product_name: string // 📸 Snapshot
  unit_price: number // 📸 Snapshot
  cost_price?: number // 📸 Snapshot
  quantity: number
  discount: number
  subtotal: number
}

export interface Payment {
  id?: string
  shop_id: string
  order_id?: string
  method: PaymentMethod
  amount: number
  cash_given?: number
  change_given?: number
  reference_no?: string
  created_at?: string
}

export interface Order {
  id?: string
  shop_id: string
  order_no: string // e.g. B1-T1-20260817-0001
  cashier_id?: string
  cashier_name?: string
  subtotal: number
  discount_type?: DiscountType
  discount_amount: number
  tax_amount: number
  total_amount: number
  status: OrderStatus
  note?: string
  created_at: string
  time_drift_flag?: boolean
  local_id: string
  sync_status: SyncStatus
  synced_at?: string
  
  items: OrderItem[]
  payments: Payment[]
}
