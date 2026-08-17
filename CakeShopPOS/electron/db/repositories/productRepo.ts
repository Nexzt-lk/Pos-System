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
  getByShopId: async (shopId: string): Promise<DBProduct[]> => {
    const db = await getDatabase()
    return db.query<DBProduct>(
      `
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
    `,
      [shopId]
    )
  },

  getByBarcode: async (shopId: string, barcode: string): Promise<DBProduct | undefined> => {
    const db = await getDatabase()
    return db.queryOne<DBProduct>(
      `
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        COALESCE(i.quantity, 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND p.shop_id = i.shop_id
      WHERE p.shop_id = ? AND p.barcode = ? AND p.is_active = 1
    `,
      [shopId, barcode]
    )
  },

  upsert: async (product: any): Promise<void> => {
    const db = await getDatabase()
    db.run(
      `
      INSERT INTO products (
        id, shop_id, category_id, name, description, price, cost_price,
        barcode, image_path, unit, track_inventory, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    `,
      [
        product.id,
        product.shop_id,
        product.category_id || null,
        product.name,
        product.description || null,
        product.price,
        product.cost_price || null,
        product.barcode || null,
        product.image_path || null,
        product.unit || 'pcs',
        product.track_inventory ? 1 : 0,
        product.is_active ? 1 : 0
      ]
    )
  }
}
