export type StockMovementType = 'IN' | 'OUT' | 'SALE' | 'ADJUST' | 'RETURN' | 'DAMAGE'

export interface Inventory {
  id?: string
  shop_id: string
  product_id: string
  quantity: number
  min_quantity: number
  updated_at?: string
  
  product_name?: string
  unit?: string
}

export interface StockMovement {
  id?: string
  shop_id: string
  product_id: string
  type: StockMovementType
  quantity: number
  quantity_before: number
  quantity_after: number
  reference_id?: string
  note?: string
  cost_per_unit?: number
  done_by?: string
  created_at: string
  local_id: string
  sync_status: 'pending' | 'synced' | 'conflict'
}
