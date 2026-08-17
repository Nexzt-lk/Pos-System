import { getDatabase } from '../database'

export interface DBCategory {
  id: string
  shop_id: string
  name: string
  color: string
  icon?: string
  sort_order: number
  is_active: number
  created_at: string
}

export const categoryRepo = {
  getByShopId: async (shopId: string): Promise<DBCategory[]> => {
    const db = await getDatabase()
    return db.query<DBCategory>(
      `
      SELECT * FROM categories
      WHERE shop_id = ? AND is_active = 1
      ORDER BY sort_order ASC, name ASC
    `,
      [shopId]
    )
  },

  upsert: async (category: any): Promise<void> => {
    const db = await getDatabase()
    db.run(
      `
      INSERT INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        icon = excluded.icon,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active
    `,
      [
        category.id,
        category.shop_id,
        category.name,
        category.color || '#6366f1',
        category.icon || 'cake',
        category.sort_order || 0,
        category.is_active ? 1 : 0
      ]
    )
  }
}
