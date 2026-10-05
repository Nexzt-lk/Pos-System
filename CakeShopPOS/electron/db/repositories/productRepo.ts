import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'

const KATUGASTOTA_ID = 'b0000000-0000-0000-0000-000000000001'

export interface DBProduct {
  id: string
  category_id?: string
  item_code?: string
  name: string
  description?: string
  price: number
  cost_price?: number
  barcode?: string
  image_path?: string
  unit: string
  track_inventory: number
  is_active: number
  shop_id?: string
  created_at: string
  updated_at: string
  category_name?: string
  category_color?: string
  current_stock?: number
}

export const productRepo = {
  /**
   * Get all active products for a specific shop/branch.
   */
  getByShopId: async (shopId?: string): Promise<DBProduct[]> => {
    const db = await getDatabase()
    if (!shopId) {
      return db.query<DBProduct>(
        `
        SELECT 
          p.*,
          c.name as category_name,
          c.color as category_color,
          COALESCE(i.quantity, 0) as current_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id AND (i.shop_id = p.shop_id OR i.shop_id IS NULL)
        WHERE p.is_active = 1
        ORDER BY c.sort_order ASC, p.name ASC
      `
      )
    }
    return db.query<DBProduct>(
      `
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        COALESCE(i.quantity, 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND (i.shop_id = ? OR i.shop_id IS NULL)
      WHERE p.is_active = 1
        AND p.shop_id = ?
      ORDER BY c.sort_order ASC, p.name ASC
    `,
      [shopId, shopId]
    )
  },

  /**
   * Look up product by barcode or item_code for a specific shop/branch.
   */
  getByBarcode: async (shopId: string, barcode: string): Promise<DBProduct | undefined> => {
    const db = await getDatabase()
    if (!shopId) {
      return db.queryOne<DBProduct>(
        `
        SELECT 
          p.*,
          c.name as category_name,
          c.color as category_color,
          COALESCE(i.quantity, 0) as current_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE (p.barcode = ? OR p.item_code = ?) AND p.is_active = 1
        LIMIT 1
      `,
        [barcode, barcode]
      )
    }
    return db.queryOne<DBProduct>(
      `
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        COALESCE(i.quantity, 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND (i.shop_id = ? OR i.shop_id IS NULL)
      WHERE (p.barcode = ? OR p.item_code = ?) AND p.is_active = 1
        AND p.shop_id = ?
      LIMIT 1
    `,
      [shopId, barcode, barcode, shopId]
    )
  },

  /**
   * Insert or update a product. Always stores shop_id for branch isolation.
   */
  upsert: async (product: any): Promise<void> => {
    const db = await getDatabase()
    const productId = product.id || uuidv4()
    const categoryId = product.category_id || product.categoryId || null
    const itemCode = product.item_code || product.itemCode || product.barcode || ('ITM-' + Date.now().toString().slice(-6))
    const cleanBarcode = product.barcode ? String(product.barcode).trim() : null
    const shopId = product.shop_id || product.shopId || KATUGASTOTA_ID

    // If an existing product has this id OR this item_code OR this barcode in this shop, reuse existing id to update it safely
    const existing = db.queryOne<any>(
      `SELECT id FROM products 
       WHERE id = ? 
          OR (item_code = ? AND item_code != '' AND (shop_id = ? OR shop_id IS NULL))
          OR (? IS NOT NULL AND ? != '' AND barcode = ? AND (shop_id = ? OR shop_id IS NULL))
       LIMIT 1;`,
      [productId, itemCode, shopId, cleanBarcode, cleanBarcode, cleanBarcode, shopId]
    )
    const targetId = existing?.id || productId

    db.run(
      `
      INSERT INTO products (
        id, category_id, item_code, name, description, price, cost_price,
        barcode, image_path, unit, track_inventory, is_active, shop_id, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'pending')
      ON CONFLICT(id) DO UPDATE SET
        category_id = excluded.category_id,
        item_code = excluded.item_code,
        name = excluded.name,
        description = excluded.description,
        price = excluded.price,
        cost_price = excluded.cost_price,
        barcode = excluded.barcode,
        image_path = CASE 
          WHEN excluded.image_path IS NOT NULL AND excluded.image_path != '' THEN excluded.image_path 
          ELSE products.image_path 
        END,
        unit = excluded.unit,
        track_inventory = excluded.track_inventory,
        is_active = excluded.is_active,
        shop_id = excluded.shop_id,
        sync_status = 'pending',
        updated_at = datetime('now')
    `,
      [
        targetId,
        categoryId,
        itemCode,
        product.name,
        product.description || null,
        Number(product.price) || 0,
        product.cost_price ? Number(product.cost_price) : (product.costPrice ? Number(product.costPrice) : null),
        cleanBarcode,
        product.image_path || product.imagePath || null,
        product.unit || 'pcs',
        product.track_inventory ? 1 : 0,
        product.is_active !== undefined ? (product.is_active ? 1 : 0) : 1,
        shopId
      ]
    )

    // Ensure inventory record exists if initialStock or current_stock is provided
    const initialQty = Number(product.initialStock ?? product.current_stock ?? product.currentStock ?? 0)
    if (initialQty > 0 || product.track_inventory) {
      db.run(
        `
        INSERT INTO inventory (id, product_id, shop_id, quantity, min_quantity, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(product_id) DO UPDATE SET
          quantity = CASE WHEN excluded.quantity > 0 AND inventory.quantity = 0 THEN excluded.quantity ELSE inventory.quantity END,
          shop_id = excluded.shop_id,
          updated_at = datetime('now');
      `,
        ['inv-' + targetId, targetId, shopId, initialQty, Number(product.min_quantity || 5)]
      )
    }

    // Enqueue in sync_queue for automatic cloud sync
    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('products', 'UPSERT', ?, ?, 'pending', datetime('now'))
    `,
      [targetId, JSON.stringify({ ...product, id: targetId, category_id: categoryId, item_code: itemCode, barcode: cleanBarcode, shop_id: shopId })]
    )

    db.save()
  }
}
