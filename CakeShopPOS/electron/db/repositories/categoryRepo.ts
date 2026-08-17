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
  getByShopId: (shopId: string): DBCategory[] => {
    const db = getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM categories
      WHERE shop_id = ? AND is_active = 1
      ORDER BY sort_order ASC, name ASC
    `)
    return stmt.all(shopId) as DBCategory[]
  },

  upsert: (category: any): void => {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
      VALUES (@id, @shop_id, @name, @color, @icon, @sort_order, @is_active)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        icon = excluded.icon,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active
    `)
    stmt.run({
      id: category.id,
      shop_id: category.shop_id,
      name: category.name,
      color: category.color || '#6366f1',
      icon: category.icon || 'cake',
      sort_order: category.sort_order || 0,
      is_active: category.is_active ? 1 : 0
    })
  }
}
