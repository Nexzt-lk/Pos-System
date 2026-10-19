import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export interface DBCakeOrder {
  id: string
  order_no: string
  shop_id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  cake_name: string
  flavor?: string
  weight_kg: number
  shape?: string
  tier_count?: number
  wording?: string
  special_instructions?: string
  reference_image?: string
  pickup_date: string
  pickup_time?: string
  total_amount: number
  advance_amount: number
  balance_amount: number
  advance_payment_method: string
  balance_payment_method?: string
  payment_status: 'pending' | 'advance_paid' | 'fully_paid'
  status: 'pending' | 'baking' | 'ready' | 'completed' | 'cancelled'
  taken_by?: string
  created_at: string
  updated_at: string
  completed_at?: string
  sync_status: 'pending' | 'synced' | 'conflict'
}

export interface CakeOrderFilterParams {
  shopId?: string
  status?: string
  startDate?: string
  endDate?: string
  search?: string
  dueTodayOnly?: boolean
}

export interface CakeOrderInput {
  id?: string
  shopId?: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  cakeName: string
  flavor?: string
  weightKg?: number
  shape?: string
  tierCount?: number
  wording?: string
  specialInstructions?: string
  referenceImage?: string
  pickupDate: string
  pickupTime?: string
  totalAmount: number
  advanceAmount: number
  advancePaymentMethod?: string
  takenBy?: string
}

export const cakeOrderRepo = {
  getNextOrderNumber: async (_shopId?: string): Promise<string> => {
    const db = await getDatabase()
    const todayPrefix = `CK-${dayjs().format('YYMMDD')}-`
    
    // Find the latest order_no for today
    const row = db.queryOne<{ order_no: string }>(
      `SELECT order_no FROM cake_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1`,
      [`${todayPrefix}%`]
    )

    let nextSeq = 1
    if (row && row.order_no) {
      const parts = row.order_no.split('-')
      const lastSeq = parseInt(parts[2], 10)
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1
      }
    }

    return `${todayPrefix}${String(nextSeq).padStart(3, '0')}`
  },

  getAll: async (params?: CakeOrderFilterParams): Promise<DBCakeOrder[]> => {
    const db = await getDatabase()
    let query = `SELECT * FROM cake_orders WHERE 1=1`
    const sqlParams: any[] = []

    if (params?.shopId && params.shopId !== 'all') {
      query += ` AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`
      sqlParams.push(params.shopId, params.shopId)
    }

    if (params?.status && params.status !== 'all') {
      query += ` AND status = ?`
      sqlParams.push(params.status)
    }

    if (params?.dueTodayOnly) {
      const today = dayjs().format('YYYY-MM-DD')
      query += ` AND pickup_date = ? AND status NOT IN ('completed', 'cancelled')`
      sqlParams.push(today)
    } else {
      if (params?.startDate) {
        query += ` AND pickup_date >= ?`
        sqlParams.push(params.startDate)
      }
      if (params?.endDate) {
        query += ` AND pickup_date <= ?`
        sqlParams.push(params.endDate)
      }
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`
      query += ` AND (
        order_no LIKE ? OR 
        customer_name LIKE ? OR 
        customer_phone LIKE ? OR 
        cake_name LIKE ? OR 
        wording LIKE ?
      )`
      sqlParams.push(term, term, term, term, term)
    }

    query += ` ORDER BY pickup_date ASC, pickup_time ASC, created_at DESC`

    const orders = db.query<DBCakeOrder>(query, sqlParams)
    return orders || []
  },

  getById: async (id: string): Promise<DBCakeOrder | null> => {
    const db = await getDatabase()
    return db.queryOne<DBCakeOrder>(`SELECT * FROM cake_orders WHERE id = ?`, [id]) || null
  },

  getDueTodayCount: async (shopId?: string): Promise<number> => {
    const db = await getDatabase()
    const today = dayjs().format('YYYY-MM-DD')
    let query = `SELECT COUNT(*) as count FROM cake_orders WHERE pickup_date = ? AND status NOT IN ('completed', 'cancelled')`
    const sqlParams: any[] = [today]

    if (shopId && shopId !== 'all') {
      query += ` AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`
      sqlParams.push(shopId, shopId)
    }

    const res = db.queryOne<{ count: number }>(query, sqlParams)
    return res?.count || 0
  },

  getUpcoming: async (shopId?: string, limit: number = 10): Promise<DBCakeOrder[]> => {
    const db = await getDatabase()
    const today = dayjs().format('YYYY-MM-DD')
    let query = `SELECT * FROM cake_orders WHERE pickup_date >= ? AND status NOT IN ('completed', 'cancelled')`
    const sqlParams: any[] = [today]

    if (shopId && shopId !== 'all') {
      query += ` AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`
      sqlParams.push(shopId, shopId)
    }

    query += ` ORDER BY pickup_date ASC, pickup_time ASC LIMIT ?`
    sqlParams.push(limit)

    return db.query<DBCakeOrder>(query, sqlParams) || []
  },

  getSummary: async (shopId?: string) => {
    const db = await getDatabase()
    const today = dayjs().format('YYYY-MM-DD')
    let shopClause = ''
    const sqlParams: any[] = []

    if (shopId && shopId !== 'all') {
      shopClause = ` AND (shop_id = ? OR (shop_id IS NULL AND ? = 'b0000000-0000-0000-0000-000000000001'))`
      sqlParams.push(shopId, shopId)
    }

    // Due today
    const dueTodayRow = db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM cake_orders WHERE pickup_date = ? AND status NOT IN ('completed', 'cancelled') ${shopClause}`,
      [today, ...sqlParams]
    )

    // Active (pending, baking, ready)
    const activeRow = db.queryOne<{ count: number; totalAdvance: number; totalBalance: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(advance_amount), 0) as totalAdvance, COALESCE(SUM(balance_amount), 0) as totalBalance 
       FROM cake_orders WHERE status IN ('pending', 'baking', 'ready') ${shopClause}`,
      sqlParams
    )

    // Ready for pickup
    const readyRow = db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM cake_orders WHERE status = 'ready' ${shopClause}`,
      sqlParams
    )

    // Total orders ever
    const totalRow = db.queryOne<{ count: number; totalRevenue: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as totalRevenue FROM cake_orders WHERE status != 'cancelled' ${shopClause}`,
      sqlParams
    )

    return {
      dueTodayCount: dueTodayRow?.count || 0,
      activeCount: activeRow?.count || 0,
      readyCount: readyRow?.count || 0,
      totalOrders: totalRow?.count || 0,
      totalAdvanceActive: activeRow?.totalAdvance || 0,
      totalBalanceActive: activeRow?.totalBalance || 0,
      totalRevenue: totalRow?.totalRevenue || 0
    }
  },

  create: async (data: CakeOrderInput): Promise<DBCakeOrder> => {
    const db = await getDatabase()
    const id = data.id || uuidv4()
    const shopId = data.shopId || 'b0000000-0000-0000-0000-000000000001'
    const orderNo = await cakeOrderRepo.getNextOrderNumber(shopId)
    const now = new Date().toISOString()

    const totalAmount = Number(data.totalAmount) || 0
    const advanceAmount = Number(data.advanceAmount) || 0
    const balanceAmount = Math.max(0, totalAmount - advanceAmount)

    let paymentStatus: 'pending' | 'advance_paid' | 'fully_paid' = 'pending'
    if (balanceAmount <= 0 && totalAmount > 0) {
      paymentStatus = 'fully_paid'
    } else if (advanceAmount > 0) {
      paymentStatus = 'advance_paid'
    }

    const order: DBCakeOrder = {
      id,
      order_no: orderNo,
      shop_id: shopId,
      customer_name: (data.customerName || '').trim(),
      customer_phone: (data.customerPhone || '').trim(),
      customer_email: (data.customerEmail || '').trim() || undefined,
      cake_name: (data.cakeName || '').trim(),
      flavor: (data.flavor || '').trim() || undefined,
      weight_kg: Number(data.weightKg) || 1,
      shape: data.shape || 'Round',
      tier_count: Number(data.tierCount) || 1,
      wording: (data.wording || '').trim() || undefined,
      special_instructions: (data.specialInstructions || '').trim() || undefined,
      reference_image: data.referenceImage || undefined,
      pickup_date: data.pickupDate,
      pickup_time: data.pickupTime || undefined,
      total_amount: totalAmount,
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
      advance_payment_method: data.advancePaymentMethod || 'CASH',
      payment_status: paymentStatus,
      status: 'pending',
      taken_by: data.takenBy || 'Counter Cashier',
      created_at: now,
      updated_at: now,
      sync_status: 'pending'
    }

    db.run(
      `INSERT INTO cake_orders (
        id, order_no, shop_id, customer_name, customer_phone, customer_email,
        cake_name, flavor, weight_kg, shape, tier_count, wording,
        special_instructions, reference_image, pickup_date, pickup_time,
        total_amount, advance_amount, balance_amount, advance_payment_method,
        payment_status, status, taken_by, created_at, updated_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )`,
      [
        order.id,
        order.order_no,
        order.shop_id,
        order.customer_name,
        order.customer_phone,
        order.customer_email || null,
        order.cake_name,
        order.flavor || null,
        order.weight_kg,
        order.shape || null,
        order.tier_count,
        order.wording || null,
        order.special_instructions || null,
        order.reference_image || null,
        order.pickup_date,
        order.pickup_time || null,
        order.total_amount,
        order.advance_amount,
        order.balance_amount,
        order.advance_payment_method,
        order.payment_status,
        order.status,
        order.taken_by || null,
        order.created_at,
        order.updated_at,
        order.sync_status
      ]
    )

    // Enqueue for cloud sync
    try {
      db.run(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at)
         VALUES (?, 'cake_order', ?, 'create', ?, ?)`,
        [uuidv4(), order.id, JSON.stringify(order), now]
      )
    } catch (_) {}

    return order
  },

  updateStatus: async (id: string, status: 'pending' | 'baking' | 'ready' | 'completed' | 'cancelled'): Promise<boolean> => {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const completedAt = status === 'completed' ? now : null

    db.run(
      `UPDATE cake_orders 
       SET status = ?, 
           completed_at = COALESCE(?, completed_at), 
           updated_at = ?,
           sync_status = 'pending'
       WHERE id = ?`,
      [status, completedAt, now, id]
    )

    try {
      db.run(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at)
         VALUES (?, 'cake_order', ?, 'update_status', ?, ?)`,
        [uuidv4(), id, JSON.stringify({ status, completedAt }), now]
      )
    } catch (_) {}

    return true
  },

  collectBalance: async (id: string, paymentMethod: string): Promise<DBCakeOrder | null> => {
    const db = await getDatabase()
    const existing = db.queryOne<DBCakeOrder>(`SELECT * FROM cake_orders WHERE id = ?`, [id])
    if (!existing) return null

    const now = new Date().toISOString()
    db.run(
      `UPDATE cake_orders 
       SET balance_amount = 0,
           balance_payment_method = ?,
           payment_status = 'fully_paid',
           status = 'completed',
           completed_at = ?,
           updated_at = ?,
           sync_status = 'pending'
       WHERE id = ?`,
      [paymentMethod || 'CASH', now, now, id]
    )

    try {
      db.run(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at)
         VALUES (?, 'cake_order', ?, 'collect_balance', ?, ?)`,
        [uuidv4(), id, JSON.stringify({ balance_payment_method: paymentMethod, payment_status: 'fully_paid' }), now]
      )
    } catch (_) {}

    return cakeOrderRepo.getById(id)
  },

  delete: async (id: string): Promise<boolean> => {
    const db = await getDatabase()
    db.run(`DELETE FROM cake_orders WHERE id = ?`, [id])
    return true
  }
}
