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
  },

  getAnalytics: async (params: {
    shopId: string
    period: 'daily' | 'weekly' | 'monthly' | 'custom'
    dateStr?: string
    startDate?: string
    endDate?: string
  }) => {
    const db = await getDatabase()
    const shopId = params.shopId
    const period = params.period || 'daily'

    let startDateStr = ''
    let endDateStr = ''
    let prevStartDateStr = ''
    let prevEndDateStr = ''

    const anchorDate = params.dateStr ? dayjs(params.dateStr) : dayjs()

    if (period === 'daily') {
      startDateStr = anchorDate.format('YYYY-MM-DD')
      endDateStr = startDateStr
      prevStartDateStr = anchorDate.subtract(1, 'day').format('YYYY-MM-DD')
      prevEndDateStr = prevStartDateStr
    } else if (period === 'weekly') {
      // 7-day range ending on anchorDate
      startDateStr = anchorDate.subtract(6, 'day').format('YYYY-MM-DD')
      endDateStr = anchorDate.format('YYYY-MM-DD')
      prevStartDateStr = anchorDate.subtract(13, 'day').format('YYYY-MM-DD')
      prevEndDateStr = anchorDate.subtract(7, 'day').format('YYYY-MM-DD')
    } else if (period === 'monthly') {
      const monthStart = anchorDate.startOf('month')
      const monthEnd = anchorDate.endOf('month')
      startDateStr = monthStart.format('YYYY-MM-DD')
      endDateStr = monthEnd.format('YYYY-MM-DD')
      const prevMonth = anchorDate.subtract(1, 'month')
      prevStartDateStr = prevMonth.startOf('month').format('YYYY-MM-DD')
      prevEndDateStr = prevMonth.endOf('month').format('YYYY-MM-DD')
    } else {
      startDateStr = params.startDate || anchorDate.subtract(29, 'day').format('YYYY-MM-DD')
      endDateStr = params.endDate || anchorDate.format('YYYY-MM-DD')
      const diffDays = dayjs(endDateStr).diff(dayjs(startDateStr), 'day') + 1
      prevEndDateStr = dayjs(startDateStr).subtract(1, 'day').format('YYYY-MM-DD')
      prevStartDateStr = dayjs(prevEndDateStr).subtract(diffDays - 1, 'day').format('YYYY-MM-DD')
    }

    // 1. Current Period Summary
    const summaryRow = db.queryOne<{
      total_orders: number
      total_revenue: number
      total_subtotal: number
      total_discount: number
      total_tax: number
      avg_order_value: number
    }>(
      `
      SELECT 
        count(*) as total_orders,
        COALESCE(sum(total_amount), 0) as total_revenue,
        COALESCE(sum(subtotal), 0) as total_subtotal,
        COALESCE(sum(discount_amount), 0) as total_discount,
        COALESCE(sum(tax_amount), 0) as total_tax,
        COALESCE(avg(total_amount), 0) as avg_order_value
      FROM orders
      WHERE shop_id = ? 
        AND date(created_at) >= ? 
        AND date(created_at) <= ? 
        AND status = 'completed'
    `,
      [shopId, startDateStr, endDateStr]
    )

    // Previous Period Summary for growth calculation
    const prevSummaryRow = db.queryOne<{
      total_orders: number
      total_revenue: number
    }>(
      `
      SELECT 
        count(*) as total_orders,
        COALESCE(sum(total_amount), 0) as total_revenue
      FROM orders
      WHERE shop_id = ? 
        AND date(created_at) >= ? 
        AND date(created_at) <= ? 
        AND status = 'completed'
    `,
      [shopId, prevStartDateStr, prevEndDateStr]
    )

    // Items Cost and Items Count in Current Period
    const itemsStats = db.queryOne<{
      total_items_sold: number
      total_cost: number
    }>(
      `
      SELECT 
        COALESCE(sum(oi.quantity), 0) as total_items_sold,
        COALESCE(sum(oi.quantity * COALESCE(oi.cost_price, 0)), 0) as total_cost
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.shop_id = ? 
        AND date(o.created_at) >= ? 
        AND date(o.created_at) <= ? 
        AND o.status = 'completed'
    `,
      [shopId, startDateStr, endDateStr]
    )

    const totalRevenue = summaryRow?.total_revenue || 0
    const totalOrders = summaryRow?.total_orders || 0
    const totalDiscount = summaryRow?.total_discount || 0
    const totalCost = itemsStats?.total_cost || 0
    const netRevenue = totalRevenue // In POS, total_amount is already net of discount
    const estimatedProfit = Math.max(0, netRevenue - totalCost)
    const profitMargin = totalRevenue > 0 ? ((estimatedProfit / totalRevenue) * 100) : 0

    const prevRevenue = prevSummaryRow?.total_revenue || 0
    const prevOrders = prevSummaryRow?.total_orders || 0
    const revenueGrowthPct = prevRevenue > 0 
      ? Number((((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
      : totalRevenue > 0 ? 100 : 0
    const ordersGrowthPct = prevOrders > 0
      ? Number((((totalOrders - prevOrders) / prevOrders) * 100).toFixed(1))
      : totalOrders > 0 ? 100 : 0

    // 2. Timeline Chart Data
    let timeline: Array<{
      label: string
      date?: string
      hour?: string
      revenue: number
      orders: number
      discount: number
      avgTicket: number
    }> = []

    if (period === 'daily') {
      // Group by Hour (06:00 to 22:00)
      const hourlyData = db.query<{
        hour_str: string
        orders_count: number
        revenue: number
        discount: number
      }>(
        `
        SELECT 
          strftime('%H', created_at) as hour_str,
          count(*) as orders_count,
          COALESCE(sum(total_amount), 0) as revenue,
          COALESCE(sum(discount_amount), 0) as discount
        FROM orders
        WHERE shop_id = ? 
          AND date(created_at) = ? 
          AND status = 'completed'
        GROUP BY strftime('%H', created_at)
      `,
        [shopId, startDateStr]
      )

      const hourMap: Record<string, { orders: number; revenue: number; discount: number }> = {}
      for (const h of hourlyData) {
        hourMap[h.hour_str] = {
          orders: h.orders_count,
          revenue: h.revenue,
          discount: h.discount
        }
      }

      // Generate 06:00 to 22:00 continuous slots
      for (let hr = 6; hr <= 22; hr++) {
        const hrStr = hr.toString().padStart(2, '0')
        const displayLabel = `${hrStr}:00`
        const entry = hourMap[hrStr] || { orders: 0, revenue: 0, discount: 0 }
        timeline.push({
          label: displayLabel,
          hour: displayLabel,
          revenue: entry.revenue,
          orders: entry.orders,
          discount: entry.discount,
          avgTicket: entry.orders > 0 ? Math.round(entry.revenue / entry.orders) : 0
        })
      }
    } else {
      // Daily Grouping for Weekly / Monthly / Custom
      const dailyData = db.query<{
        day_date: string
        orders_count: number
        revenue: number
        discount: number
      }>(
        `
        SELECT 
          date(created_at) as day_date,
          count(*) as orders_count,
          COALESCE(sum(total_amount), 0) as revenue,
          COALESCE(sum(discount_amount), 0) as discount
        FROM orders
        WHERE shop_id = ? 
          AND date(created_at) >= ? 
          AND date(created_at) <= ? 
          AND status = 'completed'
        GROUP BY date(created_at)
        ORDER BY date(created_at) ASC
      `,
        [shopId, startDateStr, endDateStr]
      )

      const dailyMap: Record<string, { orders: number; revenue: number; discount: number }> = {}
      for (const d of dailyData) {
        dailyMap[d.day_date] = {
          orders: d.orders_count,
          revenue: d.revenue,
          discount: d.discount
        }
      }

      // Fill missing days continuously
      let curr = dayjs(startDateStr)
      const end = dayjs(endDateStr)

      while (curr.isBefore(end) || curr.isSame(end, 'day')) {
        const dStr = curr.format('YYYY-MM-DD')
        const entry = dailyMap[dStr] || { orders: 0, revenue: 0, discount: 0 }
        
        let label = ''
        if (period === 'weekly') {
          label = curr.format('ddd (DD)') // Mon (18)
        } else if (period === 'monthly') {
          label = curr.format('DD MMM') // 18 Aug
        } else {
          label = curr.format('MM-DD') // 08-18
        }

        timeline.push({
          label,
          date: dStr,
          revenue: entry.revenue,
          orders: entry.orders,
          discount: entry.discount,
          avgTicket: entry.orders > 0 ? Math.round(entry.revenue / entry.orders) : 0
        })

        curr = curr.add(1, 'day')
      }
    }

    // 3. Payment Methods Breakdown
    const paymentRows = db.query<{
      method: string
      total_amount: number
      payment_count: number
    }>(
      `
      SELECT 
        p.method, 
        COALESCE(sum(p.amount), 0) as total_amount,
        count(p.id) as payment_count
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.shop_id = ? 
        AND date(o.created_at) >= ? 
        AND date(o.created_at) <= ? 
        AND o.status = 'completed'
      GROUP BY p.method
      ORDER BY total_amount DESC
    `,
      [shopId, startDateStr, endDateStr]
    )

    const paymentBreakdown = paymentRows.map((p) => ({
      method: p.method,
      total_amount: p.total_amount,
      count: p.payment_count,
      percent: totalRevenue > 0 ? Number(((p.total_amount / totalRevenue) * 100).toFixed(1)) : 0
    }))

    // 4. Top Selling Products
    const topProducts = db.query<{
      product_name: string
      total_qty: number
      total_revenue: number
    }>(
      `
      SELECT 
        oi.product_name,
        COALESCE(sum(oi.quantity), 0) as total_qty,
        COALESCE(sum(oi.subtotal), 0) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.shop_id = ? 
        AND date(o.created_at) >= ? 
        AND date(o.created_at) <= ? 
        AND o.status = 'completed'
      GROUP BY oi.product_name
      ORDER BY total_revenue DESC
      LIMIT 8
    `,
      [shopId, startDateStr, endDateStr]
    )

    // 5. Category Distribution
    const categoryRows = db.query<{
      category_name: string
      color: string
      total_qty: number
      total_revenue: number
    }>(
      `
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(c.color, '#6366f1') as color,
        COALESCE(sum(oi.quantity), 0) as total_qty,
        COALESCE(sum(oi.subtotal), 0) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.shop_id = ? 
        AND date(o.created_at) >= ? 
        AND date(o.created_at) <= ? 
        AND o.status = 'completed'
      GROUP BY COALESCE(c.name, 'Uncategorized')
      ORDER BY total_revenue DESC
    `,
      [shopId, startDateStr, endDateStr]
    )

    // 6. Peak Hour / Day
    let peakSlot: { label: string; revenue: number; orders: number } | null = null
    if (timeline.length > 0) {
      peakSlot = [...timeline].sort((a, b) => b.revenue - a.revenue)[0]
    }

    // 7. Recent Transactions / Orders in this range
    const recentOrders = db.query<{
      id: string
      order_no: string
      created_at: string
      total_amount: number
      discount_amount: number
      status: string
      items_count: number
      payment_method: string
    }>(
      `
      SELECT 
        o.id,
        o.order_no,
        o.created_at,
        o.total_amount,
        o.discount_amount,
        o.status,
        (SELECT count(*) FROM order_items WHERE order_id = o.id) as items_count,
        COALESCE((SELECT method FROM payments WHERE order_id = o.id LIMIT 1), 'CASH') as payment_method
      FROM orders o
      WHERE o.shop_id = ? 
        AND date(o.created_at) >= ? 
        AND date(o.created_at) <= ? 
        AND o.status = 'completed'
      ORDER BY o.created_at DESC
      LIMIT 25
    `,
      [shopId, startDateStr, endDateStr]
    )

    return {
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      summary: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_subtotal: summaryRow?.total_subtotal || 0,
        total_discount: totalDiscount,
        total_tax: summaryRow?.total_tax || 0,
        avg_order_value: summaryRow?.avg_order_value || 0,
        net_revenue: netRevenue,
        total_cost: totalCost,
        estimated_profit: estimatedProfit,
        profit_margin_pct: Number(profitMargin.toFixed(1)),
        total_items_sold: itemsStats?.total_items_sold || 0,
        revenue_growth_pct: revenueGrowthPct,
        orders_growth_pct: ordersGrowthPct,
        prev_revenue: prevRevenue,
        prev_orders: prevOrders
      },
      timeline,
      paymentBreakdown,
      topProducts,
      categoryBreakdown: categoryRows,
      peakSlot,
      recentOrders
    }
  }
}
