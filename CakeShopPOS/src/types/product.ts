export interface Category {
  id: string
  shop_id: string
  name: string
  color: string
  icon?: string
  sort_order: number
  is_active: boolean
  created_at?: string
}

export interface Product {
  id: string
  shop_id: string
  category_id?: string
  name: string
  description?: string
  price: number // LKR selling price
  cost_price?: number // LKR cost price for profit reports
  barcode?: string
  image_path?: string // Relative AppData path or URL
  unit: string // pcs, kg, slice, box
  track_inventory: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
  
  // Joined / computed for POS UI
  category_name?: string
  category_color?: string
  current_stock?: number
}
