import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export const orderRepo = {
  // Generate Next Order Sequence Number for today
  getNextOrderNumber: (shopId: string, branchCode: string, terminalId: string): string => {
    const db = getDatabase()
    const todayPrefix = `${branchCode}-${terminalId}-${dayjs().format('YYYYMMDD')}-%`
    
    const row = db.prepare(`
      SELECT count(*) as count FROM orders 
      WHERE shop_id = ? AND order_no LIKE ?
    `).get(shopId, todayPrefix) as { count: number }
    
    const seq = (row?.count || 0) + 1
    const seqPadded = seq.toString().padStart(4, '0')
    return `${branchCode}-${terminalId}-${dayjs().format('YYYYMMDD')}-${seqPadded}`
  },

  // Atomic Transaction: Create Order, Snapshot Items, Payments, Decrement Stock, Enqueue Sync
  createOrderTransaction: (orderData: any): { success: boolean; orderId: string; orderNo: string } => {
    const db = getDatabase()
    const orderId = orderData.id || uuidv4()
    const localId = orderData.local_id || uuidv4()
    const createdAt = orderData.created_at || new Date().toISOString()

    const transaction = db.transaction(() => {
      // 1. Insert Order
      const insertOrderStmt = db.prepare(`
        INSERT INTO orders (
          id, shop_id, order_no, cashier_id, subtotal, discount_type,
          discount_amount, tax_amount, total_amount, status, note,
          created_at, time_drift_flag, local_id, sync_status
        ) VALUES (
          @id, @shop_id, @order_no, @cashier_id, @subtotal, @discount_type,
          @discount_amount, @tax_amount, @total_amount, @status, @note,
          @created_at, @time_drift_flag, @local_id, 'pending'
        )
      `)

      insertOrderStmt.run({
        id: orderId,
        shop_id: orderData.shop_id,
        order_no: orderData.order_no,
        cashier_id: orderData.cashier_id || null,
        subtotal: orderData.subtotal,
        discount_type: orderData.discount_type || null,
        discount_amount: orderData.discount_amount || 0,
        tax_amount: orderData.tax_amount || 0,
        total_amount: orderData.total_amount,
        status: orderData.status || 'completed',
        note: orderData.note || null,
        created_at: createdAt,
        time_drift_flag: orderData.time_drift_flag ? 1 : 0,
        local_id: localId
      })

      // 2. Insert Order Items (📸 Fixed Snapshots) & Decrement Stock
      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (
          id, shop_id, order_id, product_id, product_name,
          unit_price, cost_price, quantity, discount, subtotal
        ) VALUES (
          @id, @shop_id, @order_id, @product_id, @product_name,
          @unit_price, @cost_price, @quantity, @discount, @subtotal
        )
      `)

      const decrementStockStmt = db.prepare(`
        UPDATE inventory 
        SET quantity = quantity - @quantity, updated_at = datetime('now')
        WHERE shop_id = @shop_id AND product_id = @product_id
      `)

      const recordMovementStmt = db.prepare(`
        INSERT INTO stock_movements (
          id, shop_id, product_id, type, quantity, quantity_before,
          quantity_after, reference_id, note, cost_per_unit, done_by,
          created_at, local_id, sync_status
        ) VALUES (
          @id, @shop_id, @product_id, 'SALE', @quantity, @quantity_before,
          @quantity_after, @reference_id, @note, @cost_per_unit, @done_by,
          @created_at, @local_id, 'pending'
        )
      `)

      for (const item of orderData.items) {
        const itemId = uuidv4()
        insertItemStmt.run({
          id: itemId,
          shop_id: orderData.shop_id,
          order_id: orderId,
          product_id: item.product_id,
          product_name: item.product_name,
          unit_price: item.unit_price,
          cost_price: item.cost_price || null,
          quantity: item.quantity,
          discount: item.discount || 0,
          subtotal: item.subtotal
        })

        // Decrement Stock & record movement if tracked
        const currentInv = db.prepare(`
          SELECT quantity FROM inventory WHERE shop_id = ? AND product_id = ?
        `).get(orderData.shop_id, item.product_id) as { quantity: number } | undefined

        const qtyBefore = currentInv?.quantity || 0
        const qtyAfter = qtyBefore - item.quantity

        decrementStockStmt.run({
          shop_id: orderData.shop_id,
          product_id: item.product_id,
          quantity: item.quantity
        })

        recordMovementStmt.run({
          id: uuidv4(),
          shop_id: orderData.shop_id,
          product_id: item.product_id,
          quantity: item.quantity,
          quantity_before: qtyBefore,
          quantity_after: qtyAfter,
          reference_id: orderId,
          note: `Sale #${orderData.order_no}`,
          cost_per_unit: item.cost_price || null,
          done_by: orderData.cashier_id || null,
          created_at: createdAt,
          local_id: uuidv4()
        })
      }

      // 3. Insert Payments
      const insertPaymentStmt = db.prepare(`
        INSERT INTO payments (
          id, shop_id, order_id, method, amount,
          cash_given, change_given, reference_no, created_at
        ) VALUES (
          @id, @shop_id, @order_id, @method, @amount,
          @cash_given, @change_given, @reference_no, @created_at
        )
      `)

      for (const payment of orderData.payments || []) {
        insertPaymentStmt.run({
          id: uuidv4(),
          shop_id: orderData.shop_id,
          order_id: orderId,
          method: payment.method,
          amount: payment.amount,
          cash_given: payment.cash_given || null,
          change_given: payment.change_given || null,
          reference_no: payment.reference_no || null,
          created_at: createdAt
        })
      }

      // 4. Enqueue in sync_queue
      const enqueueStmt = db.prepare(`
        INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
        VALUES ('orders', 'INSERT', ?, ?, 'pending', datetime('now'))
      `)
      enqueueStmt.run(localId, JSON.stringify({ ...orderData, id: orderId, local_id: localId, created_at: createdAt }))
    })

    transaction()
    return { success: true, orderId, orderNo: orderData.order_no }
  },

  // Daily summary metrics
  getDailySummary: (shopId: string, dateStr?: string) => {
    const db = getDatabase()
    const targetDate = dateStr || dayjs().format('YYYY-MM-DD')

    const summary = db.prepare(`
      SELECT 
        count(*) as total_orders,
        COALESCE(sum(total_amount), 0) as total_revenue,
        COALESCE(sum(discount_amount), 0) as total_discount,
        COALESCE(avg(total_amount), 0) as avg_order_value
      FROM orders
      WHERE shop_id = ? AND date(created_at) = ? AND status = 'completed'
    `).get(shopId, targetDate)

    const paymentBreakdown = db.prepare(`
      SELECT p.method, COALESCE(sum(p.amount), 0) as total_amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.shop_id = ? AND date(o.created_at) = ? AND o.status = 'completed'
      GROUP BY p.method
    `).all(shopId, targetDate)

    return { summary, paymentBreakdown }
  }
}
