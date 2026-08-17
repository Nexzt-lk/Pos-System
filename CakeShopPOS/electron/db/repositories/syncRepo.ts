import { getDatabase } from '../database'

export interface SyncQueueItem {
  id: number
  table_name: string
  operation: string
  record_id: string
  payload: string
  retry_count: number
  status: string
  created_at: string
}

export const syncRepo = {
  getPendingCount: async (): Promise<number> => {
    const db = await getDatabase()
    const result = db.queryOne<{ count: number }>(`
      SELECT count(*) as count FROM sync_queue WHERE status = 'pending'
    `)
    return result?.count || 0
  },

  getPendingItems: async (limit = 50): Promise<SyncQueueItem[]> => {
    const db = await getDatabase()
    return db.query<SyncQueueItem>(
      `
      SELECT * FROM sync_queue 
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT ?
    `,
      [limit]
    )
  },

  markAsSynced: async (ids: number[]): Promise<void> => {
    if (ids.length === 0) return
    const db = await getDatabase()
    for (const id of ids) {
      db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE id = ?`, [id])
    }
    db.save()
  },

  incrementRetry: async (id: number): Promise<void> => {
    const db = await getDatabase()
    db.run(`UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?`, [id])
    db.save()
  }
}
