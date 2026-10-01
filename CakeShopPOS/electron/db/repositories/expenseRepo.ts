import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export interface DBExpense {
  id: string
  category?: string
  description: string
  amount: number
  expense_date: string
  linked_product_id?: string
  linked_stock_movement_id?: string
  added_by?: string
  created_at: string
  local_id: string
  sync_status: 'pending' | 'synced' | 'conflict'
}

export interface ExpenseFilterParams {
  shopId?: string
  from?: string
  to?: string
  category?: string
  search?: string
}

export interface ExpenseInput {
  id?: string
  category?: string
  description: string
  amount: number
  expenseDate?: string
  linkedProductId?: string
  addedBy?: string
}

export const expenseRepo = {
  getAll: async (params?: ExpenseFilterParams): Promise<any[]> => {
    const db = await getDatabase()
    let query = `SELECT * FROM expenses WHERE 1=1`
    const sqlParams: any[] = []

    if (params?.from) {
      query += ` AND substr(expense_date, 1, 10) >= ?`
      sqlParams.push(params.from)
    }

    if (params?.to) {
      query += ` AND substr(expense_date, 1, 10) <= ?`
      sqlParams.push(params.to)
    }

    if (params?.category && params.category !== 'all') {
      query += ` AND LOWER(category) = LOWER(?)`
      sqlParams.push(params.category)
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`
      query += ` AND (description LIKE ? OR category LIKE ? OR added_by LIKE ?)`
      sqlParams.push(term, term, term)
    }

    query += ` ORDER BY expense_date DESC, created_at DESC`

    const rows = db.query<DBExpense>(query, sqlParams)

    return rows.map((r) => ({
      id: r.id,
      category: r.category || 'Other',
      description: r.description,
      amount: Number(r.amount) || 0,
      expenseDate: r.expense_date ? r.expense_date.slice(0, 10) : dayjs().format('YYYY-MM-DD'),
      linkedProductId: r.linked_product_id,
      addedBy: r.added_by || 'Cashier',
      createdAt: r.created_at,
      localId: r.local_id,
      syncStatus: r.sync_status
    }))
  },

  getById: async (id: string): Promise<any | null> => {
    const db = await getDatabase()
    const r = db.queryOne<DBExpense>(`SELECT * FROM expenses WHERE id = ? OR local_id = ? LIMIT 1`, [id, id])
    if (!r) return null

    return {
      id: r.id,
      category: r.category || 'Other',
      description: r.description,
      amount: Number(r.amount) || 0,
      expenseDate: r.expense_date ? r.expense_date.slice(0, 10) : dayjs().format('YYYY-MM-DD'),
      linkedProductId: r.linked_product_id,
      addedBy: r.added_by || 'Cashier',
      createdAt: r.created_at,
      localId: r.local_id,
      syncStatus: r.sync_status
    }
  },

  create: async (data: ExpenseInput): Promise<any> => {
    const db = await getDatabase()
    const id = data.id || uuidv4()
    const localId = 'exp-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900)
    const expenseDate = data.expenseDate
      ? dayjs(data.expenseDate).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    const category = data.category || 'Other'
    const description = (data.description || 'Petty Cash').trim()
    const amount = Number(data.amount) || 0
    const addedBy = data.addedBy || 'Cashier'
    const linkedProductId = data.linkedProductId || null

    db.run(
      `
      INSERT INTO expenses (
        id, category, description, amount, expense_date,
        linked_product_id, added_by, created_at, local_id, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'pending')
    `,
      [id, category, description, amount, expenseDate, linkedProductId, addedBy, localId]
    )

    // Enqueue in sync_queue for cloud mirroring
    const payload = JSON.stringify({
      id,
      local_id: localId,
      category,
      description,
      amount,
      expense_date: expenseDate,
      added_by: addedBy,
      linked_product_id: linkedProductId
    })

    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('expenses', 'INSERT', ?, ?, 'pending', datetime('now'))
    `,
      [id, payload]
    )

    db.save()

    return {
      id,
      localId,
      category,
      description,
      amount,
      expenseDate,
      addedBy,
      linkedProductId,
      syncStatus: 'pending',
      createdAt: new Date().toISOString()
    }
  },

  update: async (id: string, data: ExpenseInput): Promise<any> => {
    const db = await getDatabase()
    const expenseDate = data.expenseDate
      ? dayjs(data.expenseDate).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    const category = data.category || 'Other'
    const description = (data.description || '').trim()
    const amount = Number(data.amount) || 0
    const addedBy = data.addedBy || 'Cashier'

    db.run(
      `
      UPDATE expenses SET
        category = ?,
        description = ?,
        amount = ?,
        expense_date = ?,
        added_by = COALESCE(?, added_by),
        sync_status = 'pending'
      WHERE id = ? OR local_id = ?
    `,
      [category, description, amount, expenseDate, addedBy, id, id]
    )

    const payload = JSON.stringify({
      id,
      category,
      description,
      amount,
      expense_date: expenseDate,
      added_by: addedBy
    })

    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('expenses', 'UPDATE', ?, ?, 'pending', datetime('now'))
    `,
      [id, payload]
    )

    db.save()

    return {
      id,
      category,
      description,
      amount,
      expenseDate,
      addedBy,
      syncStatus: 'pending'
    }
  },

  delete: async (id: string): Promise<void> => {
    const db = await getDatabase()
    db.run(`DELETE FROM expenses WHERE id = ? OR local_id = ?`, [id, id])

    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('expenses', 'DELETE', ?, ?, 'pending', datetime('now'))
    `,
      [id, JSON.stringify({ id })]
    )

    db.save()
  },

  getSummary: async (params?: ExpenseFilterParams): Promise<any> => {
    const db = await getDatabase()
    let whereClause = `WHERE 1=1`
    const sqlParams: any[] = []

    if (params?.from) {
      whereClause += ` AND substr(expense_date, 1, 10) >= ?`
      sqlParams.push(params.from)
    }
    if (params?.to) {
      whereClause += ` AND substr(expense_date, 1, 10) <= ?`
      sqlParams.push(params.to)
    }

    const summaryRow = db.queryOne<{
      total_amount: number
      count: number
      avg_amount: number
      max_amount: number
    }>(
      `
      SELECT 
        COALESCE(sum(amount), 0) as total_amount,
        count(*) as count,
        COALESCE(avg(amount), 0) as avg_amount,
        COALESCE(max(amount), 0) as max_amount
      FROM expenses
      ${whereClause}
    `,
      sqlParams
    )

    const categoryBreakdown = db.query<{
      category: string
      total: number
      count: number
    }>(
      `
      SELECT 
        COALESCE(category, 'Other') as category,
        COALESCE(sum(amount), 0) as total,
        count(*) as count
      FROM expenses
      ${whereClause}
      GROUP BY COALESCE(category, 'Other')
      ORDER BY total DESC
    `,
      sqlParams
    )

    const todayStr = dayjs().format('YYYY-MM-DD')
    const todayRow = db.queryOne<{ today_total: number; today_count: number }>(
      `
      SELECT 
        COALESCE(sum(amount), 0) as today_total,
        count(*) as today_count
      FROM expenses
      WHERE substr(expense_date, 1, 10) = ?
    `,
      [todayStr]
    )

    const monthPrefix = dayjs().format('YYYY-MM')
    const monthRow = db.queryOne<{ month_total: number }>(
      `
      SELECT COALESCE(sum(amount), 0) as month_total
      FROM expenses
      WHERE substr(expense_date, 1, 7) = ?
    `,
      [monthPrefix]
    )

    return {
      totalAmount: summaryRow?.total_amount || 0,
      count: summaryRow?.count || 0,
      avgAmount: summaryRow?.avg_amount || 0,
      maxAmount: summaryRow?.max_amount || 0,
      todayTotal: todayRow?.today_total || 0,
      todayCount: todayRow?.today_count || 0,
      monthTotal: monthRow?.month_total || 0,
      categoryBreakdown: categoryBreakdown || []
    }
  }
}
