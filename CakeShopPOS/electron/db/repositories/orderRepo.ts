import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export const orderRepo = {
  getNextOrderNumber: async (_shopId: string, branchCode: string, terminalId: string): Promise<string> => {
    const db = await getDatabase()
    const term = terminalId || branchCode || 'T1'
    const todayStr = dayjs().format('YYYYMMDD')
    const prefix = `${term}-${todayStr}-%`

    const rows = db.query<{ order_no: string }>(
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

    const shopId = orderData.shop_id || 'b0000000-0000-0000-0000-000000000001'

    // 1. Insert Order
    db.run(
      `
      INSERT INTO orders (
        id, order_no, terminal_id, subtotal, discount_type,
        discount_amount, tax_amount, total_amount, status, note,
        cashier_id, cashier_name, created_at, local_id, sync_status,
        shop_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
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
        localId,
        shopId
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

  getDailySummary: async (shopId?: string, dateStr?: string) => {
    const db = await getDatabase()
    const targetDate = dateStr || dayjs().format('YYYY-MM-DD')
    const filterByShop = shopId && shopId !== 'all'

    const summary = db.queryOne(
      `
      SELECT 
        count(*) as total_orders,
        COALESCE(sum(total_amount), 0) as total_revenue,
        COALESCE(sum(discount_amount), 0) as total_discount,
        COALESCE(avg(total_amount), 0) as avg_order_value
      FROM orders
      WHERE substr(created_at, 1, 10) = ? 
        AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
        AND (? = 0 OR shop_id = ?)
    `,
      [targetDate, filterByShop ? 1 : 0, shopId || '']
    )

    const paymentBreakdown = db.query(
      `
      SELECT p.method, COALESCE(sum(p.amount), 0) as total_amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE substr(o.created_at, 1, 10) = ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
        AND (? = 0 OR o.shop_id = ?)
      GROUP BY p.method
    `,
      [targetDate, filterByShop ? 1 : 0, shopId || '']
    )

    return { summary, paymentBreakdown }
  },

  getByShop: async (shopId?: string, limit: number = 200, dateStr?: string) => {
    const db = await getDatabase()
    const filterByShop = shopId && shopId !== 'all'
    let sql = `SELECT * FROM orders WHERE 1=1`
    const params: any[] = []

    if (dateStr) {
      sql += ` AND substr(created_at, 1, 10) = ?`
      params.push(dateStr)
    }
    if (filterByShop) {
      sql += ` AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`
      params.push(shopId, shopId)
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const orders = db.query(sql, params)
    return orders.map((o: any) => {
      const items = db.query(`SELECT * FROM order_items WHERE order_id = ?`, [o.id])
      const payments = db.query(`SELECT * FROM payments WHERE order_id = ?`, [o.id])
      return {
        id: o.id,
        localId: o.local_id || o.id,
        orderNo: o.order_no,
        cashierId: o.cashier_id,
        cashierName: o.cashier_name,
        subtotal: o.subtotal,
        discountAmount: o.discount_amount || 0,
        taxAmount: o.tax_amount || 0,
        totalAmount: o.total_amount,
        status: o.status || 'completed',
        createdAt: o.created_at,
        shopId: o.shop_id,
        items: (items || []).map((it: any) => ({
          productName: it.product_name,
          itemCode: it.item_code,
          unitPrice: it.unit_price,
          quantity: it.quantity,
          discount: it.discount || 0,
          subtotal: it.subtotal
        })),
        payments: (payments || []).map((pm: any) => ({
          method: pm.method,
          amount: pm.amount,
          cashGiven: pm.cash_given,
          changeGiven: pm.change_given
        }))
      }
    })
  },

  getAnalytics: async (params: {
    shopId?: string
    period?: 'daily' | 'weekly' | 'monthly' | 'custom'
    dateStr?: string
    startDate?: string
    endDate?: string
  }) => {
    const rawDb = await getDatabase()
    // Fail-safe wrappers: a single failing section must never blank the whole report
    const db = {
      query: <T = any>(sql: string, sqlParams: any[] = []): T[] => {
        try {
          return rawDb.query<T>(sql, sqlParams)
        } catch (err) {
          console.error('[Analytics] Query failed:', err)
          return []
        }
      },
      queryOne: <T = any>(sql: string, sqlParams: any[] = []): T | undefined => {
        try {
          return rawDb.queryOne<T>(sql, sqlParams)
        } catch (err) {
          console.error('[Analytics] Query failed:', err)
          return undefined
        }
      }
    }
    const period = params.period || 'daily'
    const isSpecificShop = Boolean(params.shopId && params.shopId !== 'all')
    const targetShopId = params.shopId || ''

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
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
    `,
      [prevStartDateStr, prevEndDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    // Items Cost and Items Count in Current Period
    const itemsStats = db.queryOne<{
      total_items_sold: number
      total_cost: number
    }>(
      `
      SELECT 
        COALESCE(sum(oi.quantity), 0) as total_items_sold,
        COALESCE(sum(oi.quantity * COALESCE(oi.cost_price, p.cost_price, 0)), 0) as total_cost
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    const totalRevenue = summaryRow?.total_revenue || 0
    const totalOrders = summaryRow?.total_orders || 0
    const totalDiscount = summaryRow?.total_discount || 0
    const totalCost = itemsStats?.total_cost || 0
    const netRevenue = totalRevenue
    const estimatedProfit = netRevenue - totalCost
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
          AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
        GROUP BY COALESCE(strftime('%H', created_at, 'localtime'), strftime('%H', created_at), substr(created_at, 12, 2))
      `,
        [startDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
          AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
        GROUP BY COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10))
        ORDER BY day_date ASC
      `,
        [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY UPPER(COALESCE(p.method, 'CASH'))
      ORDER BY total_amount DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    const totalPaymentsAmount = paymentRows.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0)
    const paymentBreakdown = paymentRows.map((p) => ({
      method: p.method,
      total_amount: p.total_amount,
      count: p.payment_count,
      percent: totalPaymentsAmount > 0 ? Number(((p.total_amount / totalPaymentsAmount) * 100).toFixed(1)) : 0
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
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY COALESCE(oi.product_name, p.name, 'Unknown Item')
      ORDER BY total_revenue DESC
      LIMIT 8
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY COALESCE(c.name, 'General')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    // 6. Peak Hour / Day
    let peakSlot: { label: string; revenue: number; orders: number } | null = null
    const positiveTimeline = timeline.filter(t => t.revenue > 0 || t.orders > 0)
    if (positiveTimeline.length > 0) {
      peakSlot = [...positiveTimeline].sort((a, b) => b.revenue - a.revenue)[0]
    }

    // 7. Full Completed Orders Ledger for this range (used by the orders log + CSV exports)
    const recentOrders = db.query<{
      id: string
      order_no: string
      created_at: string
      subtotal: number
      tax_amount: number
      total_amount: number
      discount_amount: number
      status: string
      items_count: number
      payment_method: string
      cashier_name: string
      terminal_id: string
    }>(
      `
      SELECT 
        o.id,
        o.order_no,
        o.created_at,
        COALESCE(o.subtotal, o.total_amount) as subtotal,
        COALESCE(o.tax_amount, 0) as tax_amount,
        o.total_amount,
        COALESCE(o.discount_amount, 0) as discount_amount,
        COALESCE(o.status, 'completed') as status,
        COALESCE((SELECT sum(quantity) FROM order_items WHERE order_id = o.id), 0) as items_count,
        CASE
          WHEN (SELECT count(DISTINCT UPPER(method)) FROM payments WHERE order_id = o.id) > 1 THEN 'MIXED'
          ELSE COALESCE((SELECT UPPER(method) FROM payments WHERE order_id = o.id LIMIT 1), 'CASH')
        END as payment_method,
        COALESCE(o.cashier_name, u.name, '') as cashier_name,
        COALESCE(o.terminal_id, 'T1') as terminal_id,
        COALESCE(o.shop_id, 'b0000000-0000-0000-0000-000000000001') as shop_id
      FROM orders o
      LEFT JOIN users u ON o.cashier_id = u.id
      WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
        AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      ORDER BY o.created_at DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY COALESCE(oi.product_name, p.name, 'Unknown Item'), COALESCE(oi.item_code, p.item_code, '-')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY COALESCE(category, 'General')
      ORDER BY total_amount DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY COALESCE(o.cashier_name, u.name, 'Cashier')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      GROUP BY COALESCE(terminal_id, 'T1')
      ORDER BY total_revenue DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
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
        COALESCE(sum(MAX(COALESCE(i.quantity, 0), 0) * COALESCE(p.cost_price, 0)), 0) as total_cost_value,
        COALESCE(sum(MAX(COALESCE(i.quantity, 0), 0) * COALESCE(p.price, 0)), 0) as total_retail_value,
        sum(CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5) AND COALESCE(i.quantity, 0) > 0 THEN 1 ELSE 0 END) as low_stock_count,
        sum(CASE WHEN COALESCE(i.quantity, 0) <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND (? = 0 OR i.shop_id = ? OR (i.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      WHERE (p.is_active = 1 OR p.is_active IS NULL)
        AND (? = 0 OR p.shop_id = ? OR (p.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
    `,
      [
        isSpecificShop ? 1 : 0, targetShopId, targetShopId,
        isSpecificShop ? 1 : 0, targetShopId, targetShopId
      ]
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
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    // Detailed expenses list for drill-down & reports
    const detailedExpenses = db.query<{
      id: string
      category: string
      description: string
      amount: number
      expense_date: string
      added_by: string
      payment_method: string
      notes: string
      shop_id: string
    }>(
      `
      SELECT 
        id,
        COALESCE(category, 'General') as category,
        COALESCE(description, '') as description,
        COALESCE(amount, 0) as amount,
        COALESCE(expense_date, '') as expense_date,
        COALESCE(added_by, 'Staff') as added_by,
        'CASH' as payment_method,
        '' as notes,
        COALESCE(shop_id, 'b0000000-0000-0000-0000-000000000001') as shop_id
      FROM expenses
      WHERE substr(expense_date, 1, 10) >= ? AND substr(expense_date, 1, 10) <= ?
        AND (? = 0 OR shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      ORDER BY expense_date DESC, created_at DESC
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    // Critical low stock and out-of-stock items for drill-down
    const lowStockList = db.query<{
      id: string
      product_name: string
      item_code: string
      category_name: string
      current_stock: number
      min_quantity: number
      cost_price: number
      price: number
      unit: string
      shop_id: string
    }>(
      `
      SELECT 
        p.id,
        p.name as product_name,
        COALESCE(p.item_code, '-') as item_code,
        COALESCE(c.name, 'General') as category_name,
        COALESCE(i.quantity, 0) as current_stock,
        COALESCE(i.min_quantity, 5) as min_quantity,
        COALESCE(p.cost_price, 0) as cost_price,
        COALESCE(p.price, 0) as price,
        COALESCE(p.unit, 'pcs') as unit,
        COALESCE(p.shop_id, 'b0000000-0000-0000-0000-000000000001') as shop_id
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND (? = 0 OR i.shop_id = ? OR (i.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.is_active = 1 OR p.is_active IS NULL)
        AND (? = 0 OR p.shop_id = ? OR (p.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
        AND COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5)
      ORDER BY current_stock ASC
      LIMIT 50
    `,
      [
        isSpecificShop ? 1 : 0, targetShopId, targetShopId,
        isSpecificShop ? 1 : 0, targetShopId, targetShopId
      ]
    )

    // Damage loss details for drill-down
    const damageLossList = db.query<{
      id: string
      product_name: string
      quantity: number
      cost_per_unit: number
      total_cost: number
      note: string
      created_at: string
      shop_id: string
    }>(
      `
      SELECT 
        sm.id,
        COALESCE(p.name, 'Unknown Item') as product_name,
        sm.quantity,
        COALESCE(sm.cost_per_unit, p.cost_price, 0) as cost_per_unit,
        COALESCE(sm.quantity * COALESCE(sm.cost_per_unit, p.cost_price, 0), 0) as total_cost,
        COALESCE(sm.note, '-') as note,
        sm.created_at,
        COALESCE(sm.shop_id, p.shop_id, 'b0000000-0000-0000-0000-000000000001') as shop_id
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      WHERE sm.type = 'DAMAGE'
        AND COALESCE(strftime('%Y-%m-%d', sm.created_at, 'localtime'), substr(sm.created_at, 1, 10)) >= ? 
        AND COALESCE(strftime('%Y-%m-%d', sm.created_at, 'localtime'), substr(sm.created_at, 1, 10)) <= ?
        AND (? = 0 OR sm.shop_id = ? OR (sm.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
      ORDER BY sm.created_at DESC
      LIMIT 50
    `,
      [startDateStr, endDateStr, isSpecificShop ? 1 : 0, targetShopId, targetShopId]
    )

    const totalExpenses = expensesSummary?.total_expenses || 0
    const netProfit = estimatedProfit - totalExpenses
    const netProfitMarginPct = totalRevenue > 0
      ? Number(((netProfit / totalRevenue) * 100).toFixed(1))
      : 0

    // Cash in drawer estimation
    const cashPayments = paymentRows.find(p => p.method === 'CASH')?.total_amount || 0
    const netCashInDrawer = cashPayments - totalExpenses

    // 10. Multi-Branch Comparative Breakdown for Executive Owner Intelligence
    const allRegisteredShops = db.query<{
      id: string
      name: string
      branch_code: string
      address: string
      phone: string
    }>(
      `SELECT id, name, branch_code, address, phone FROM shops WHERE is_active = 1 OR is_active IS NULL ORDER BY branch_code ASC`
    )

    const branchBreakdown = allRegisteredShops.map((s) => {
      const sId = s.id
      const bSummary = db.queryOne<{
        total_orders: number
        total_revenue: number
        avg_order_value: number
      }>(
        `SELECT 
           count(*) as total_orders,
           COALESCE(sum(total_amount), 0) as total_revenue,
           COALESCE(avg(total_amount), 0) as avg_order_value
         FROM orders
         WHERE COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) >= ? 
           AND COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), substr(created_at, 1, 10)) <= ? 
           AND (LOWER(status) = 'completed' OR status IS NULL OR status = '')
           AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`,
        [startDateStr, endDateStr, sId, sId]
      )

      const bCost = db.queryOne<{ total_cost: number }>(
        `SELECT COALESCE(sum(oi.quantity * COALESCE(oi.cost_price, p.cost_price, 0)), 0) as total_cost
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
           AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
           AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
           AND (o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`,
        [startDateStr, endDateStr, sId, sId]
      )?.total_cost || 0

      const bExpenses = db.queryOne<{ total_expenses: number }>(
        `SELECT COALESCE(sum(amount), 0) as total_expenses
         FROM expenses
         WHERE substr(expense_date, 1, 10) >= ? AND substr(expense_date, 1, 10) <= ?
           AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`,
        [startDateStr, endDateStr, sId, sId]
      )?.total_expenses || 0

      const bCashSales = db.queryOne<{ total_cash: number }>(
        `SELECT COALESCE(sum(p.amount), 0) as total_cash
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE UPPER(COALESCE(p.method, 'CASH')) = 'CASH'
           AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) >= ? 
           AND COALESCE(strftime('%Y-%m-%d', o.created_at, 'localtime'), substr(o.created_at, 1, 10)) <= ? 
           AND (LOWER(o.status) = 'completed' OR o.status IS NULL OR o.status = '')
           AND (o.shop_id = ? OR (o.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`,
        [startDateStr, endDateStr, sId, sId]
      )?.total_cash || 0

      const bInv = db.queryOne<{
        total_products: number
        total_cost_value: number
        total_retail_value: number
        low_stock_count: number
      }>(
        `SELECT 
           count(p.id) as total_products,
           COALESCE(sum(MAX(COALESCE(i.quantity, 0), 0) * COALESCE(p.cost_price, 0)), 0) as total_cost_value,
           COALESCE(sum(MAX(COALESCE(i.quantity, 0), 0) * COALESCE(p.price, 0)), 0) as total_retail_value,
           sum(CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5) AND COALESCE(i.quantity, 0) > 0 THEN 1 ELSE 0 END) as low_stock_count
         FROM products p
         LEFT JOIN inventory i ON p.id = i.product_id AND (i.shop_id = ? OR (i.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))
         WHERE (p.is_active = 1 OR p.is_active IS NULL)
           AND (p.shop_id = ? OR (p.shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`,
        [sId, sId, sId, sId]
      )

      const bRev = bSummary?.total_revenue || 0
      const bGrossProfit = bRev - bCost
      const bNetProfit = bGrossProfit - bExpenses
      const bNetMargin = bRev > 0 ? Number(((bNetProfit / bRev) * 100).toFixed(1)) : 0
      const bGrossMargin = bRev > 0 ? Number(((bGrossProfit / bRev) * 100).toFixed(1)) : 0

      return {
        shopId: s.id,
        shopName: s.name,
        branchCode: s.branch_code || (s.id.endsWith('2') ? 'B2' : 'B1'),
        address: s.address,
        phone: s.phone,
        totalOrders: bSummary?.total_orders || 0,
        totalRevenue: bRev,
        avgTicket: bSummary?.avg_order_value || 0,
        costOfGoods: bCost,
        grossProfit: bGrossProfit,
        grossProfitMargin: bGrossMargin,
        totalExpenses: bExpenses,
        netProfit: bNetProfit,
        netProfitMargin: bNetMargin,
        cashSales: bCashSales,
        cashExpenses: bExpenses,
        netCashInDrawer: bCashSales - bExpenses,
        totalProducts: bInv?.total_products || 0,
        inventoryCostValue: bInv?.total_cost_value || 0,
        inventoryRetailValue: bInv?.total_retail_value || 0,
        lowStockCount: bInv?.low_stock_count || 0
      }
    })

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
      },
      detailedExpenses,
      lowStockList,
      damageLossList,
      branchBreakdown
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
      recentOrders,
      branchBreakdown
    }
  }
}

