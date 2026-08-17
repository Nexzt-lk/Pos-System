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
  getPendingCount: (): number => {
    const db = getDatabase()
    const result = db.prepare(`
      SELECT count(*) as count FROM sync_queue WHERE status = 'pending'
    `).get() as { count: number }
    return result?.count || 0
  },

  getPendingItems: (limit = 50): SyncQueueItem[] => {
    const db = getDatabase()
    return db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT ?
    `).all(limit) as SyncQueueItem[]
  },

  markAsSynced: (ids: number[]): void => {
    if (ids.length === 0) return
    const db = getDatabase()
    const placeholders = ids.map(() => '?').join(',')
    
    db.transaction(() => {
      db.prepare(`
        UPDATE sync_queue 
        SET status = 'synced', synced_at = datetime('now')
        WHERE id IN (${placeholders})
      `).run(...ids)
    })()
  },

  incrementRetry: (id: number): void => {
    const db = getDatabase()
    db.prepare(`
      UPDATE sync_queue 
      SET retry_count = retry_count + 1
      WHERE id = ?
    `).run(id)
  }
}
