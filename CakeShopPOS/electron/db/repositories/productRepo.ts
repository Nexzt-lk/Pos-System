import { getDatabase } from '../database'

export interface DBProduct {
  id: string
  shop_id: string
  category_id?: string
  name: string
  description?: string
  price: number
  cost_price?: number
  barcode?: string
  image_path?: string
  unit: string
  track_inventory: number
  is_active: number
  created_at: string
  updated_at: string
  category_name?: string
  category_color?: string
  current_stock?: number
}

export const productRepo = {
  getByShopId: (shopId: string): DBProduct[] => {
    const db = getDatabase()
    const stmt = db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        COALESCE(i.quantity, 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND p.shop_id = i.shop_id
      WHERE p.shop_id = ? AND p.is_active = 1
      ORDER BY c.sort_order ASC, p.name ASC
    `)
    return stmt.all(shopId) as DBProduct[]
  },

  getByBarcode: (shopId: string, barcode: string): DBProduct | undefined => {
    const db = getDatabase()
    const stmt = db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        COALESCE(i.quantity, 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND p.shop_id = i.shop_id
      WHERE p.shop_id = ? AND p.barcode = ? AND p.is_active = 1
    `)
    return stmt.get(shopId, barcode) as DBProduct | undefined
  },

  upsert: (product: any): void => {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO products (
        id, shop_id, category_id, name, description, price, cost_price,
        barcode, image_path, unit, track_inventory, is_active, updated_at
      ) VALUES (
        @id, @shop_id, @category_id, @name, @description, @price, @cost_price,
        @barcode, @image_path, @unit, @track_inventory, @is_active, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        category_id = excluded.category_id,
        name = excluded.name,
        description = excluded.description,
        price = excluded.price,
        cost_price = excluded.cost_price,
        barcode = excluded.barcode,
        image_path = excluded.image_path,
        unit = excluded.unit,
        track_inventory = excluded.track_inventory,
        is_active = excluded.is_active,
        updated_at = datetime('now')
    `)
    stmt.run({
      id: product.id,
      shop_id: product.shop_id,
      category_id: product.category_id || null,
      name: product.name,
      description: product.description || null,
      price: product.price,
      cost_price: product.cost_price || null,
      barcode: product.barcode || null,
      image_path: product.image_path || null,
      unit: product.unit || 'pcs',
      track_inventory: product.track_inventory ? 1 : 0,
      is_active: product.is_active ? 1 : 0
    })
  }
}
