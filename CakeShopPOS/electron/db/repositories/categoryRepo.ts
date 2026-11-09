import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'

export interface DBCategory {
  id: string
  name: string
  code_prefix?: string
  color: string
  icon?: string
  sort_order: number
  is_active: number
  created_at: string
}

export const categoryRepo = {
  getByShopId: async (_shopId?: string): Promise<DBCategory[]> => {
    const db = await getDatabase()
    return db.query<DBCategory>(
      `
      SELECT * FROM categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `
    )
  },

  upsert: async (category: any): Promise<void> => {
    const db = await getDatabase()
    const catId = category.id || uuidv4()

    db.run(
      `
      INSERT INTO categories (id, name, code_prefix, color, icon, sort_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        code_prefix = excluded.code_prefix,
        color = excluded.color,
        icon = excluded.icon,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active
    `,
      [
        catId,
        category.name,
        category.code_prefix || category.codePrefix || 'CAT',
        category.color || '#6366f1',
        category.icon || 'cake',
        category.sort_order ?? category.sortOrder ?? 0,
        category.is_active !== undefined ? (category.is_active ? 1 : 0) : 1
      ]
    )

    // Enqueue in sync_queue for automatic cloud sync
    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('categories', 'UPSERT', ?, ?, 'pending', datetime('now'))
    `,
      [catId, JSON.stringify({ ...category, id: catId })]
    )

    db.save()
  }
}
