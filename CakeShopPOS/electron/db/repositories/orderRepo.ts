import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export const orderRepo = {
  getNextOrderNumber: async (_shopId: string, branchCode: string, terminalId: string): Promise<string> => {
    const db = await getDatabase()
    const term = terminalId || branchCode || 'T1'
    const todayStr = dayjs().format('YYYYMMDD')
    const prefix = `${term}-${todayStr}-%`

    const rows = db.queryAll<{ order_no: string }>(
      `SELECT order_no FROM orders WHERE order_no LIKE ?`,
      [prefix]
    )

    let maxSeq = 0
    const regex = new RegExp(`^${term}-${todayStr}-(\\d+)`)
    for (const r of rows) {
      const match = r.order_no ? r.order_no.match(regex) : null
      if (match && match[1]) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num
        }
      }
    }

    const nextSeq = Math.max(rows.length, maxSeq) + 1
    const seqPadded = nextSeq.toString().padStart(4, '0')
    return `${term}-${todayStr}-${seqPadded}`
  },

  createOrderTransaction: async (orderData: any): Promise<{ success: boolean; orderId: string; orderNo: string }> => {
    const db = await getDatabase()
    const orderId = orderData.id || uuidv4()
    const localId = orderData.local_id || uuidv4()
    const createdAt = orderData.created_at || new Date().toISOString()
    const terminalId = orderData.terminal_id || 'T1'

    // Ensure clean sequential order number (e.g. T1-20260920-0008) instead of random fallback
    let orderNo = orderData.order_no
    if (!orderNo || orderNo.startsWith('B1-T1-') || orderNo.startsWith('TEMP-')) {
      orderNo = await orderRepo.getNextOrderNumber(orderData.shop_id, orderData.branch_code, terminalId)
    }

    // 1. Insert Order
    db.run(
      `
      INSERT INTO orders (
        id, order_no, terminal_id, subtotal, discount_type,
        discount_amount, tax_amount, total_amount, status, note,
        cashier_id, cashier_name, created_at, local_id, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
      [
        orderId,
        orderNo,
        terminalId,
        orderData.subtotal,
        orderData.discount_type || null,
        orderData.discount_amount || 0,
        orderData.tax_amount || 0,
        orderData.total_amount,
        orderData.status || 'completed',
        orderData.note || null,
        orderData.cashier_id || null,
        orderData.cashier_name || null,
        createdAt,
        localId
      ]
    )

    // 2. Insert Order Items & Decrement Stock
    for (const item of orderData.items || []) {
      const itemId = uuidv4()
      db.run(
        `
        INSERT INTO order_items (
          id, order_id, product_id, product_name, item_code,
          unit_price, cost_price, quantity, discount, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          itemId,
          orderId,
          item.product_id,
          item.product_name,
          item.item_code || null,
          item.unit_price,
          item.cost_price || null,
          item.quantity,
          item.discount || 0,
          item.subtotal
        ]
      )

      // Decrement inventory
      const currentInv = db.queryOne<{ quantity: number }>(
        `SELECT quantity FROM inventory WHERE product_id = ?`,
        [item.product_id]
      )

      const qtyBefore = currentInv?.quantity || 0
      const qtyAfter = qtyBefore - item.quantity

      db.run(
        `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ?`,
        [item.quantity, item.product_id]
      )

      db.run(
        `
        INSERT INTO stock_movements (
          id, product_id, type, quantity, quantity_before,
          quantity_after, reference_id, note, cost_per_unit,
          created_at, sync_status
        ) VALUES (?, ?, 'SALE', ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
        [
          uuidv4(),
          item.product_id,
          item.quantity,
          qtyBefore,
          qtyAfter,
          orderId,
          `Sale #${orderNo}`,
          item.cost_price || null,
          createdAt
        ]
      )
    }

    // 3. Insert Payments
    for (const payment of orderData.payments || []) {
      db.run(
        `
        INSERT INTO payments (
          id, order_id, method, amount,
          cash_given, change_given, reference_no, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          uuidv4(),
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
      [localId, JSON.stringify({ ...orderData, id: orderId, order_no: orderNo, local_id: localId, created_at: createdAt })]
    )

    db.save()
    return { success: true, orderId, orderNo }
  },

  getDailySummary: async (_shopId?: string, dateStr?: string) => {
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
      WHERE substr(created_at, 1, 10) = ? AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
    `,
      [targetDate]
    )

    const paymentBreakdown = db.query(
      `
      SELECT p.method, COALESCE(sum(p.amount), 0) as total_amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE substr(o.created_at, 1, 10) = ? AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      GROUP BY p.method
    `,
      [targetDate]
    )

    return { summary, paymentBreakdown }
  },

  getAnalytics: async (params: {
    shopId?: string
    period?: 'daily' | 'weekly' | 'monthly' | 'custom'
    dateStr?: string
    startDate?: string
    endDate?: string
  }) => {
    const db = await getDatabase()
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
      WHERE COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) <= ? 
        AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
    `,
      [startDateStr, endDateStr]
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
      WHERE COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) <= ? 
        AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
    `,
      [prevStartDateStr, prevEndDateStr]
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
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
    `,
      [startDateStr, endDateStr]
    )

    const totalRevenue = summaryRow?.total_revenue || 0
    const totalOrders = summaryRow?.total_orders || 0
    const totalDiscount = summaryRow?.total_discount || 0
    const totalCost = itemsStats?.total_cost || 0
    const netRevenue = totalRevenue
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
      // Group by Hour (Local Time)
      const hourlyData = db.query<{
        hour_str: string
        orders_count: number
        revenue: number
        discount: number
      }>(
        `
        SELECT 
          COALESCE(strftime('%H', created_at, 'localtime'), strftime('%H', created_at), substr(created_at, 12, 2)) as hour_str,
          count(*) as orders_count,
          COALESCE(sum(total_amount), 0) as revenue,
          COALESCE(sum(discount_amount), 0) as discount
        FROM orders
        WHERE COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) = ? 
          AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
        GROUP BY COALESCE(strftime('%H', created_at, 'localtime'), strftime('%H', created_at), substr(created_at, 12, 2))
      `,
        [startDateStr]
      )

      const hourMap: Record<string, { orders: number; revenue: number; discount: number }> = {}
      for (const h of hourlyData) {
        if (h.hour_str) {
          const padded = h.hour_str.padStart(2, '0')
          hourMap[padded] = {
            orders: h.orders_count,
            revenue: h.revenue,
            discount: h.discount
          }
        }
      }

      // Generate continuous slots covering standard store hours (06:00 to 22:00) plus any earlier/later recorded hours
      const recordedHours = Object.keys(hourMap).map(Number).filter((n) => !isNaN(n))
      const minHour = recordedHours.length > 0 ? Math.min(6, Math.min(...recordedHours)) : 6
      const maxHour = recordedHours.length > 0 ? Math.max(22, Math.max(...recordedHours)) : 22
      for (let hr = minHour; hr <= maxHour; hr++) {
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
          COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) as day_date,
          count(*) as orders_count,
          COALESCE(sum(total_amount), 0) as revenue,
          COALESCE(sum(discount_amount), 0) as discount
        FROM orders
        WHERE COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) >= ? 
          AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) <= ? 
          AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
        GROUP BY COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10))
        ORDER BY day_date ASC
      `,
        [startDateStr, endDateStr]
      )

      const dailyMap: Record<string, { orders: number; revenue: number; discount: number }> = {}
      for (const d of dailyData) {
        if (d.day_date) {
          dailyMap[d.day_date] = {
            orders: d.orders_count,
            revenue: d.revenue,
            discount: d.discount
          }
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
        UPPER(COALESCE(p.method, 'CASH')) as method, 
        COALESCE(sum(p.amount), 0) as total_amount,
        count(p.id) as payment_count
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      GROUP BY UPPER(COALESCE(p.method, 'CASH'))
      ORDER BY total_amount DESC
    `,
      [startDateStr, endDateStr]
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
        COALESCE(oi.product_name, p.name, 'Unknown Item') as product_name,
        COALESCE(sum(oi.quantity), 0) as total_qty,
        COALESCE(sum(oi.subtotal), 0) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      GROUP BY COALESCE(oi.product_name, p.name, 'Unknown Item')
      ORDER BY total_revenue DESC
      LIMIT 8
    `,
      [startDateStr, endDateStr]
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
        COALESCE(c.name, 'General') as category_name,
        COALESCE(c.color, '#16a34a') as color,
        COALESCE(sum(oi.quantity), 0) as total_qty,
        COALESCE(sum(oi.subtotal), 0) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      GROUP BY COALESCE(c.name, 'General')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr]
    )

    // 6. Peak Hour / Day
    let peakSlot: { label: string; revenue: number; orders: number } | null = null
    const positiveTimeline = timeline.filter(t => t.revenue > 0 || t.orders > 0)
    if (positiveTimeline.length > 0) {
      peakSlot = [...positiveTimeline].sort((a, b) => b.revenue - a.revenue)[0]
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
        COALESCE(o.discount_amount, 0) as discount_amount,
        o.status,
        COALESCE((SELECT sum(quantity) FROM order_items WHERE order_id = o.id), 1) as items_count,
        COALESCE((SELECT UPPER(method) FROM payments WHERE order_id = o.id LIMIT 1), 'CASH') as payment_method
      FROM orders o
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      ORDER BY o.created_at DESC
      LIMIT 25
    `,
      [startDateStr, endDateStr]
    )

    // 8. Item-Wise Sales & Profit Performance Breakdown
    const itemRows = db.query<{
      product_id: string
      product_name: string
      item_code: string
      category_name: string
      avg_unit_price: number
      avg_cost_price: number
      total_qty: number
      total_discount: number
      total_revenue: number
      total_cogs: number
      gross_profit: number
    }>(
      `
      SELECT 
        COALESCE(oi.product_id, p.id, '') as product_id,
        COALESCE(oi.product_name, p.name, 'Unknown Item') as product_name,
        COALESCE(oi.item_code, p.item_code, '-') as item_code,
        COALESCE(c.name, 'General') as category_name,
        COALESCE(avg(oi.unit_price), p.price, 0) as avg_unit_price,
        COALESCE(avg(oi.cost_price), p.cost_price, 0) as avg_cost_price,
        COALESCE(sum(oi.quantity), 0) as total_qty,
        COALESCE(sum(oi.discount), 0) as total_discount,
        COALESCE(sum(oi.subtotal), 0) as total_revenue,
        COALESCE(sum(oi.quantity * COALESCE(oi.cost_price, p.cost_price, 0)), 0) as total_cogs,
        COALESCE(sum(oi.subtotal) - sum(oi.quantity * COALESCE(oi.cost_price, p.cost_price, 0)), 0) as gross_profit
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      GROUP BY COALESCE(oi.product_name, p.name, 'Unknown Item'), COALESCE(oi.item_code, p.item_code, '-')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr]
    )

    const itemBreakdown = itemRows.map((item) => {
      const marginPct = item.total_revenue > 0
        ? Number(((item.gross_profit / item.total_revenue) * 100).toFixed(1))
        : 0
      const revenueSharePct = totalRevenue > 0
        ? Number(((item.total_revenue / totalRevenue) * 100).toFixed(1))
        : 0
      return {
        ...item,
        margin_pct: marginPct,
        revenue_share_pct: revenueSharePct
      }
    })

    // 9. Owner's Executive Business Intelligence Metrics
    // Expenses query
    const expensesSummary = db.queryOne<{
      total_expenses: number
      expense_count: number
    }>(
      `
      SELECT 
        COALESCE(sum(amount), 0) as total_expenses,
        count(*) as expense_count
      FROM expenses
      WHERE substr(expense_date, 1, 10) >= ? AND substr(expense_date, 1, 10) <= ?
    `,
      [startDateStr, endDateStr]
    )

    const expenseCategories = db.query<{
      category: string
      total_amount: number
      count: number
    }>(
      `
      SELECT 
        COALESCE(category, 'General') as category,
        COALESCE(sum(amount), 0) as total_amount,
        count(*) as count
      FROM expenses
      WHERE substr(expense_date, 1, 10) >= ? AND substr(expense_date, 1, 10) <= ?
      GROUP BY COALESCE(category, 'General')
      ORDER BY total_amount DESC
    `,
      [startDateStr, endDateStr]
    )

    // Staff / Cashier sales performance
    const cashierPerformance = db.query<{
      cashier_name: string
      orders_count: number
      total_revenue: number
      total_discount: number
      avg_ticket: number
    }>(
      `
      SELECT 
        COALESCE(o.cashier_name, u.name, 'Cashier') as cashier_name,
        count(o.id) as orders_count,
        COALESCE(sum(o.total_amount), 0) as total_revenue,
        COALESCE(sum(o.discount_amount), 0) as total_discount,
        COALESCE(avg(o.total_amount), 0) as avg_ticket
      FROM orders o
      LEFT JOIN users u ON o.cashier_id = u.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
      GROUP BY COALESCE(o.cashier_name, u.name, 'Cashier')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr]
    )

    // Terminal Breakdown
    const terminalPerformance = db.query<{
      terminal_id: string
      orders_count: number
      total_revenue: number
    }>(
      `
      SELECT 
        COALESCE(terminal_id, 'T1') as terminal_id,
        count(id) as orders_count,
        COALESCE(sum(total_amount), 0) as total_revenue
      FROM orders
      WHERE COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) <= ? 
        AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
      GROUP BY COALESCE(terminal_id, 'T1')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr]
    )

    // Inventory Valuation & Capital Health
    const inventoryValuation = db.queryOne<{
      total_products: number
      total_cost_value: number
      total_retail_value: number
      low_stock_count: number
      out_of_stock_count: number
    }>(
      `
      SELECT 
        count(p.id) as total_products,
        COALESCE(sum(COALESCE(i.quantity, 0) * COALESCE(p.cost_price, 0)), 0) as total_cost_value,
        COALESCE(sum(COALESCE(i.quantity, 0) * COALESCE(p.price, 0)), 0) as total_retail_value,
        sum(CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5) AND COALESCE(i.quantity, 0) > 0 THEN 1 ELSE 0 END) as low_stock_count,
        sum(CASE WHEN COALESCE(i.quantity, 0) <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = 1 OR p.is_active IS NULL
    `
    )

    // Damage loss from stock_movements
    const damageLossRow = db.queryOne<{
      damage_cost: number
      damage_qty: number
      damage_events: number
    }>(
      `
      SELECT 
        COALESCE(sum(quantity * COALESCE(cost_per_unit, 0)), 0) as damage_cost,
        COALESCE(sum(quantity), 0) as damage_qty,
        count(*) as damage_events
      FROM stock_movements
      WHERE type = 'DAMAGE' 
        AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) <= ?
    `,
      [startDateStr, endDateStr]
    )

    const totalExpenses = expensesSummary?.total_expenses || 0
    const netProfit = estimatedProfit - totalExpenses
    const netProfitMarginPct = totalRevenue > 0
      ? Number(((netProfit / totalRevenue) * 100).toFixed(1))
      : 0

    // Cash in drawer estimation
    const cashPayments = paymentRows.find(p => p.method === 'CASH')?.total_amount || 0
    const netCashInDrawer = Math.max(0, cashPayments - totalExpenses)

    const ownerMetrics = {
      grossProfit: estimatedProfit,
      grossProfitMargin: Number(profitMargin.toFixed(1)),
      totalExpenses,
      netProfit,
      netProfitMargin: netProfitMarginPct,
      expenseCategories,
      cashierPerformance,
      terminalPerformance,
      inventoryValuation: {
        totalProducts: inventoryValuation?.total_products || 0,
        totalCostValue: inventoryValuation?.total_cost_value || 0,
        totalRetailValue: inventoryValuation?.total_retail_value || 0,
        potentialMarginValue: Math.max(0, (inventoryValuation?.total_retail_value || 0) - (inventoryValuation?.total_cost_value || 0)),
        lowStockCount: inventoryValuation?.low_stock_count || 0,
        outOfStockCount: inventoryValuation?.out_of_stock_count || 0
      },
      damageLoss: {
        cost: damageLossRow?.damage_cost || 0,
        quantity: damageLossRow?.damage_qty || 0,
        events: damageLossRow?.damage_events || 0
      },
      cashDrawer: {
        cashSales: cashPayments,
        cashExpenses: totalExpenses,
        netCashEstimated: netCashInDrawer
      }
    }

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
      itemBreakdown,
      ownerMetrics,
      peakSlot,
      recentOrders
    }
  }
}

