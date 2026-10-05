import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

interface CashSession {
  id: string
  shop_id?: string
  session_date: string
  terminal_id: string
  cashier_id: string | null
  cashier_name: string | null
  opening_float: number
  notes: string | null
  created_at: string
  sync_status?: string
}

export const cashSessionRepo = {
  /**
   * Check if a session already exists for a given date + terminal
   */
  getByDate: async (date: string, terminalId: string = 'T1'): Promise<any | null> => {
    const db = await getDatabase()
    const row = db.queryOne<CashSession>(
      `SELECT * FROM cash_sessions WHERE session_date = ? AND terminal_id = ? LIMIT 1`,
      [date, terminalId]
    )
    if (!row) return null
    return {
      id: row.id,
      shopId: row.shop_id || 'b0000000-0000-0000-0000-000000000001',
      sessionDate: row.session_date,
      terminalId: row.terminal_id,
      cashierId: row.cashier_id,
      cashierName: row.cashier_name,
      openingFloat: Number(row.opening_float) || 0,
      notes: row.notes,
      createdAt: row.created_at,
      syncStatus: row.sync_status || 'pending'
    }
  },

  /**
   * Check if today's session exists for a given terminal
   */
  getTodaySession: async (terminalId: string = 'T1'): Promise<any | null> => {
    const today = dayjs().format('YYYY-MM-DD')
    return cashSessionRepo.getByDate(today, terminalId)
  },

  /**
   * Create a new cash session (opening float entry)
   */
  create: async (data: {
    openingFloat: number
    shopId?: string
    cashierId?: string
    cashierName?: string
    terminalId?: string
    notes?: string
    sessionDate?: string
  }): Promise<any> => {
    const db = await getDatabase()
    const id = uuidv4()
    const sessionDate = data.sessionDate || dayjs().format('YYYY-MM-DD')
    const terminalId = data.terminalId || 'T1'
    const shopId = data.shopId || 'b0000000-0000-0000-0000-000000000001'

    db.run(
      `INSERT OR REPLACE INTO cash_sessions
        (id, shop_id, session_date, terminal_id, cashier_id, cashier_name, opening_float, notes, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        shopId,
        sessionDate,
        terminalId,
        data.cashierId || null,
        data.cashierName || null,
        Number(data.openingFloat) || 0,
        data.notes || null
      ]
    )

    db.save()

    return {
      id,
      shopId,
      sessionDate,
      terminalId,
      cashierId: data.cashierId || null,
      cashierName: data.cashierName || null,
      openingFloat: Number(data.openingFloat) || 0,
      notes: data.notes || null
    }
  },

  /**
   * Get opening float for a specific date (for Reports)
   */
  getOpeningFloat: async (date: string, terminalId: string = 'T1'): Promise<number> => {
    const session = await cashSessionRepo.getByDate(date, terminalId)
    return session?.openingFloat || 0
  },

  /**
   * Get recent sessions (last 30 days) for reporting
   */
  getRecent: async (limit: number = 30): Promise<any[]> => {
    const db = await getDatabase()
    const rows = db.query<CashSession>(
      `SELECT * FROM cash_sessions ORDER BY session_date DESC, created_at DESC LIMIT ?`,
      [limit]
    )
    return rows.map((r) => ({
      id: r.id,
      sessionDate: r.session_date,
      terminalId: r.terminal_id,
      cashierId: r.cashier_id,
      cashierName: r.cashier_name,
      openingFloat: Number(r.opening_float) || 0,
      notes: r.notes,
      createdAt: r.created_at
    }))
  }
}
