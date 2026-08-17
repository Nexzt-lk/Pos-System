import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'

export const inventoryRepo = {
  getLowStock: (shopId: string) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.unit,
        COALESCE(i.quantity, 0) as current_stock,
        COALESCE(i.min_quantity, 5) as min_quantity
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND p.shop_id = i.shop_id
      WHERE p.shop_id = ? AND p.track_inventory = 1 AND p.is_active = 1
        AND COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5)
      ORDER BY current_stock ASC
    `).all(shopId)
  },

  recordMovement: (movement: {
    shopId: string
    productId: string
    type: 'IN' | 'OUT' | 'ADJUST' | 'RETURN' | 'DAMAGE'
    quantity: number
    note?: string
    costPerUnit?: number
    doneBy?: string
  }) => {
    const db = getDatabase()
    const localId = uuidv4()

    const transaction = db.transaction(() => {
      // 1. Get current stock
      const inv = db.prepare(`
        SELECT quantity FROM inventory WHERE shop_id = ? AND product_id = ?
      `).get(movement.shopId, movement.productId) as { quantity: number } | undefined

      const qtyBefore = inv?.quantity || 0
      let qtyAfter = qtyBefore

      if (movement.type === 'IN' || movement.type === 'RETURN') {
        qtyAfter = qtyBefore + movement.quantity
      } else if (movement.type === 'OUT' || movement.type === 'DAMAGE') {
        qtyAfter = Math.max(0, qtyBefore - movement.quantity)
      } else if (movement.type === 'ADJUST') {
        qtyAfter = movement.quantity // Direct override
      }

      // 2. Upsert inventory
      db.prepare(`
        INSERT INTO inventory (id, shop_id, product_id, quantity, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(shop_id, product_id) DO UPDATE SET
          quantity = excluded.quantity,
          updated_at = datetime('now')
      `).run(uuidv4(), movement.shopId, movement.productId, qtyAfter)

      // 3. Record movement
      db.prepare(`
        INSERT INTO stock_movements (
          id, shop_id, product_id, type, quantity, quantity_before,
          quantity_after, note, cost_per_unit, done_by, created_at,
          local_id, sync_status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'pending'
        )
      `).run(
        uuidv4(),
        movement.shopId,
        movement.productId,
        movement.type,
        movement.quantity,
        qtyBefore,
        qtyAfter,
        movement.note || null,
        movement.costPerUnit || null,
        movement.doneBy || null,
        localId
      )

      // 4. Enqueue in sync_queue
      db.prepare(`
        INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
        VALUES ('stock_movements', 'INSERT', ?, ?, 'pending', datetime('now'))
      `).run(localId, JSON.stringify({ ...movement, local_id: localId }))
    })

    transaction()
    return { success: true }
  }
}
