import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export const orderRepo = {
  getNextOrderNumber: async (shopId: string, branchCode: string, terminalId: string): Promise<string> => {
    const db = await getDatabase()
    const todayPrefix = `${branchCode}-${terminalId}-${dayjs().format('YYYYMMDD')}-%`

    const row = db.queryOne<{ count: number }>(
      `
      SELECT count(*) as count FROM orders 
      WHERE shop_id = ? AND order_no LIKE ?
    `,
      [shopId, todayPrefix]
    )

    const seq = (row?.count || 0) + 1
    const seqPadded = seq.toString().padStart(4, '0')
    return `${branchCode}-${terminalId}-${dayjs().format('YYYYMMDD')}-${seqPadded}`
  },

  createOrderTransaction: async (orderData: any): Promise<{ success: boolean; orderId: string; orderNo: string }> => {
    const db = await getDatabase()
    const orderId = orderData.id || uuidv4()
    const localId = orderData.local_id || uuidv4()
    const createdAt = orderData.created_at || new Date().toISOString()

    // 1. Insert Order
    db.run(
      `
      INSERT INTO orders (
        id, shop_id, order_no, cashier_id, subtotal, discount_type,
        discount_amount, tax_amount, total_amount, status, note,
        created_at, time_drift_flag, local_id, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
      [
        orderId,
        orderData.shop_id,
        orderData.order_no,
        orderData.cashier_id || null,
        orderData.subtotal,
        orderData.discount_type || null,
        orderData.discount_amount || 0,
        orderData.tax_amount || 0,
        orderData.total_amount,
        orderData.status || 'completed',
        orderData.note || null,
        createdAt,
        orderData.time_drift_flag ? 1 : 0,
        localId
      ]
    )

    // 2. Insert Order Items & Decrement Stock
    for (const item of orderData.items) {
      const itemId = uuidv4()
      db.run(
        `
        INSERT INTO order_items (
          id, shop_id, order_id, product_id, product_name,
          unit_price, cost_price, quantity, discount, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          itemId,
          orderData.shop_id,
          orderId,
          item.product_id,
          item.product_name,
          item.unit_price,
          item.cost_price || null,
          item.quantity,
          item.discount || 0,
          item.subtotal
        ]
      )

      // Decrement inventory
      const currentInv = db.queryOne<{ quantity: number }>(
        `SELECT quantity FROM inventory WHERE shop_id = ? AND product_id = ?`,
        [orderData.shop_id, item.product_id]
      )

      const qtyBefore = currentInv?.quantity || 0
      const qtyAfter = qtyBefore - item.quantity

      db.run(
        `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE shop_id = ? AND product_id = ?`,
        [item.quantity, orderData.shop_id, item.product_id]
      )

      db.run(
        `
        INSERT INTO stock_movements (
          id, shop_id, product_id, type, quantity, quantity_before,
          quantity_after, reference_id, note, cost_per_unit, done_by,
          created_at, local_id, sync_status
        ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
        [
          uuidv4(),
          orderData.shop_id,
          item.product_id,
          item.quantity,
          qtyBefore,
          qtyAfter,
          orderId,
          `Sale #${orderData.order_no}`,
          item.cost_price || null,
          orderData.cashier_id || null,
          createdAt,
          uuidv4()
        ]
      )
    }

    // 3. Insert Payments
    for (const payment of orderData.payments || []) {
      db.run(
        `
        INSERT INTO payments (
          id, shop_id, order_id, method, amount,
          cash_given, change_given, reference_no, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          uuidv4(),
          orderData.shop_id,
          orderId,
          payment.method,
          payment.amount,
          payment.cash_given || null,
          payment.change_given || null,
          payment.reference_no || null,
          createdAt
        ]
      )
    }

    // 4. Enqueue in sync_queue
    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('orders', 'INSERT', ?, ?, 'pending', datetime('now'))
    `,
      [localId, JSON.stringify({ ...orderData, id: orderId, local_id: localId, created_at: createdAt })]
    )

    db.save()
    return { success: true, orderId, orderNo: orderData.order_no }
  },

  getDailySummary: async (shopId: string, dateStr?: string) => {
    const db = await getDatabase()
    const targetDate = dateStr || dayjs().format('YYYY-MM-DD')

    const summary = db.queryOne(
      `
      SELECT 
        count(*) as total_orders,
        COALESCE(sum(total_amount), 0) as total_revenue,
        COALESCE(sum(discount_amount), 0) as total_discount,
        COALESCE(avg(total_amount), 0) as avg_order_value
      FROM orders
      WHERE shop_id = ? AND date(created_at) = ? AND status = 'completed'
    `,
      [shopId, targetDate]
    )

    const paymentBreakdown = db.query(
      `
      SELECT p.method, COALESCE(sum(p.amount), 0) as total_amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.shop_id = ? AND date(o.created_at) = ? AND o.status = 'completed'
      GROUP BY p.method
    `,
      [shopId, targetDate]
    )

    return { summary, paymentBreakdown }
  }
}
