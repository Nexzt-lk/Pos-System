export interface Category {
  id: string
  shop_id?: string
  name: string
  code_prefix?: string
  codePrefix?: string
  color: string
  icon?: string
  sort_order?: number
  sortOrder?: number
  is_active?: boolean
  isActive?: boolean
  created_at?: string
  createdAt?: string
}

export interface Product {
  id: string
  shop_id?: string
  category_id?: string
  categoryId?: string
  category_name?: string
  categoryName?: string
  category_color?: string
  categoryColor?: string
  item_code?: string
  itemCode?: string
  name: string
  description?: string
  price: number // LKR selling price
  cost_price?: number // LKR cost price for profit reports
  costPrice?: number
  barcode?: string
  image_path?: string // Relative AppData path or URL
  imagePath?: string
  unit: string // pcs, kg, slice, box
  track_inventory: boolean
  trackInventory?: boolean
  is_active: boolean
  isActive?: boolean
  current_stock?: number
  currentStock?: number
  is_low_stock?: boolean
  isLowStock?: boolean
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
}

export function normalizeProduct(raw: any, shopId: string = 'default'): Product {
  return {
    id: raw.id || raw.productId || '',
    shop_id: raw.shop_id || raw.shopId || shopId,
    category_id: raw.category_id || raw.categoryId || '',
    categoryId: raw.categoryId || raw.category_id || '',
    category_name: raw.category_name || raw.categoryName || '',
    categoryName: raw.categoryName || raw.category_name || '',
    category_color: raw.category_color || raw.categoryColor || '#6366f1',
    categoryColor: raw.categoryColor || raw.category_color || '#6366f1',
    item_code: raw.item_code || raw.itemCode || '',
    itemCode: raw.itemCode || raw.item_code || '',
    name: raw.name || '',
    description: raw.description || '',
    price: Number(raw.price) || 0,
    cost_price: raw.cost_price !== undefined ? Number(raw.cost_price) : (raw.costPrice !== undefined ? Number(raw.costPrice) : undefined),
    costPrice: raw.costPrice !== undefined ? Number(raw.costPrice) : (raw.cost_price !== undefined ? Number(raw.cost_price) : undefined),
    barcode: raw.barcode || '',
    image_path: raw.image_path || raw.imagePath || '',
    imagePath: raw.imagePath || raw.image_path || '',
    unit: raw.unit || 'pcs',
    track_inventory: raw.track_inventory !== undefined ? Boolean(raw.track_inventory) : (raw.trackInventory !== undefined ? Boolean(raw.trackInventory) : true),
    trackInventory: raw.trackInventory !== undefined ? Boolean(raw.trackInventory) : (raw.track_inventory !== undefined ? Boolean(raw.track_inventory) : true),
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : (raw.isActive !== undefined ? Boolean(raw.isActive) : true),
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : (raw.is_active !== undefined ? Boolean(raw.is_active) : true),
    current_stock: raw.current_stock !== undefined ? Number(raw.current_stock) : (raw.currentStock !== undefined ? Number(raw.currentStock) : 0),
    currentStock: raw.currentStock !== undefined ? Number(raw.currentStock) : (raw.current_stock !== undefined ? Number(raw.current_stock) : 0),
    is_low_stock: raw.is_low_stock !== undefined ? Boolean(raw.is_low_stock) : Boolean(raw.isLowStock),
    isLowStock: raw.isLowStock !== undefined ? Boolean(raw.isLowStock) : Boolean(raw.is_low_stock),
    created_at: raw.created_at || raw.createdAt,
    createdAt: raw.createdAt || raw.created_at,
    updated_at: raw.updated_at || raw.updatedAt,
    updatedAt: raw.updatedAt || raw.updated_at
  }
}

export function normalizeCategory(raw: any, shopId: string = 'default'): Category {
  return {
    id: raw.id || '',
    shop_id: raw.shop_id || raw.shopId || shopId,
    name: raw.name || '',
    code_prefix: raw.code_prefix || raw.codePrefix || '',
    codePrefix: raw.codePrefix || raw.code_prefix || '',
    color: raw.color || '#6366f1',
    icon: raw.icon || 'cake',
    sort_order: raw.sort_order !== undefined ? Number(raw.sort_order) : (raw.sortOrder !== undefined ? Number(raw.sortOrder) : 0),
    sortOrder: raw.sortOrder !== undefined ? Number(raw.sortOrder) : (raw.sort_order !== undefined ? Number(raw.sort_order) : 0),
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : (raw.isActive !== undefined ? Boolean(raw.isActive) : true),
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : (raw.is_active !== undefined ? Boolean(raw.is_active) : true),
    created_at: raw.created_at || raw.createdAt,
    createdAt: raw.createdAt || raw.created_at
  }
}
