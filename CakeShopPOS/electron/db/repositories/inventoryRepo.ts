import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'

export const inventoryRepo = {
  getLowStock: async (_shopId?: string) => {
    const db = await getDatabase()
    return db.query(
      `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.unit,
        COALESCE(i.quantity, 0) as current_stock,
        COALESCE(i.min_quantity, 5) as min_quantity
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.track_inventory = 1 AND p.is_active = 1
        AND COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5)
      ORDER BY current_stock ASC
    `
    )
  },

  recordMovement: async (movement: {
    shopId?: string
    productId: string
    type: 'IN' | 'OUT' | 'SALE' | 'ADJUST' | 'RETURN' | 'DAMAGE'
    quantity: number
    note?: string
    costPerUnit?: number
    doneBy?: string
  }) => {
    const db = await getDatabase()
    const localId = uuidv4()

    const inv = db.queryOne<{ quantity: number }>(
      `SELECT quantity FROM inventory WHERE product_id = ?`,
      [movement.productId]
    )

    const qtyBefore = inv?.quantity || 0
    let qtyAfter = qtyBefore

    if (movement.type === 'IN' || movement.type === 'RETURN') {
      qtyAfter = qtyBefore + movement.quantity
    } else if (movement.type === 'OUT' || movement.type === 'SALE' || movement.type === 'DAMAGE') {
      qtyAfter = Math.max(0, qtyBefore - movement.quantity)
    } else if (movement.type === 'ADJUST') {
      qtyAfter = movement.quantity
    }

    db.run(
      `
      INSERT INTO inventory (id, product_id, quantity, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(product_id) DO UPDATE SET
        quantity = excluded.quantity,
        updated_at = datetime('now')
    `,
      [uuidv4(), movement.productId, qtyAfter]
    )

    db.run(
      `
      INSERT INTO stock_movements (
        id, product_id, type, quantity, quantity_before,
        quantity_after, note, cost_per_unit, created_at,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'pending')
    `,
      [
        uuidv4(),
        movement.productId,
        movement.type,
        movement.quantity,
        qtyBefore,
        qtyAfter,
        movement.note || null,
        movement.costPerUnit || null
      ]
    )

    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('stock_movements', 'INSERT', ?, ?, 'pending', datetime('now'))
    `,
      [localId, JSON.stringify({ ...movement, local_id: localId })]
    )

    db.save()
    return { success: true }
  }
}

