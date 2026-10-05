import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'

export interface DBSupplier {
  id: string
  name: string
  phone?: string
  contact_person?: string
  email?: string
  address?: string
  notes?: string
  is_active: number
  created_at: string
  sync_status?: string
}

export interface SupplierInput {
  id?: string
  name: string
  phone?: string
  contactPerson?: string
  email?: string
  address?: string
  notes?: string
}

export const suppliersRepo = {
  getAll: async (): Promise<any[]> => {
    const db = await getDatabase()
    const rows = db.query<DBSupplier>(
      `SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC`
    )
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      contactPerson: r.contact_person || '',
      email: r.email || '',
      address: r.address || '',
      notes: r.notes || '',
      createdAt: r.created_at,
      syncStatus: r.sync_status || 'synced'
    }))
  },

  getById: async (id: string): Promise<any | null> => {
    const db = await getDatabase()
    const r = db.queryOne<DBSupplier>(
      `SELECT * FROM suppliers WHERE id = ? LIMIT 1`,
      [id]
    )
    if (!r) return null
    return {
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      contactPerson: r.contact_person || '',
      email: r.email || '',
      address: r.address || '',
      notes: r.notes || '',
      createdAt: r.created_at,
      syncStatus: r.sync_status || 'synced'
    }
  },

  create: async (data: SupplierInput): Promise<any> => {
    const db = await getDatabase()
    const id = data.id || uuidv4()
    const name = (data.name || '').trim()

    db.run(
      `
      INSERT INTO suppliers (
        id, name, phone, contact_person, email, address, notes, is_active, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), 'pending')
      ON CONFLICT(name) DO UPDATE SET
        phone = excluded.phone,
        contact_person = excluded.contact_person,
        email = excluded.email,
        address = excluded.address,
        notes = excluded.notes,
        is_active = 1,
        sync_status = 'pending'
    `,
      [
        id,
        name,
        data.phone?.trim() || null,
        data.contactPerson?.trim() || null,
        data.email?.trim() || null,
        data.address?.trim() || null,
        data.notes?.trim() || null
      ]
    )

    // Enqueue in sync_queue for cloud mirroring
    const payload = JSON.stringify({
      id,
      name,
      phone: data.phone?.trim() || null,
      contact_person: data.contactPerson?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      is_active: 1
    })

    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('suppliers', 'INSERT', ?, ?, 'pending', datetime('now'))
    `,
      [id, payload]
    )

    db.save()

    return {
      id,
      name,
      phone: data.phone || '',
      contactPerson: data.contactPerson || '',
      email: data.email || '',
      address: data.address || '',
      notes: data.notes || '',
      syncStatus: 'pending',
      createdAt: new Date().toISOString()
    }
  },

  update: async (id: string, data: SupplierInput): Promise<any> => {
    const db = await getDatabase()
    db.run(
      `
      UPDATE suppliers SET
        name = ?,
        phone = ?,
        contact_person = ?,
        email = ?,
        address = ?,
        notes = ?,
        sync_status = 'pending'
      WHERE id = ?
    `,
      [
        data.name.trim(),
        data.phone?.trim() || null,
        data.contactPerson?.trim() || null,
        data.email?.trim() || null,
        data.address?.trim() || null,
        data.notes?.trim() || null,
        id
      ]
    )

    const payload = JSON.stringify({
      id,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      contact_person: data.contactPerson?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      is_active: 1
    })

    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('suppliers', 'UPDATE', ?, ?, 'pending', datetime('now'))
    `,
      [id, payload]
    )

    db.save()
    return suppliersRepo.getById(id)
  },

  delete: async (id: string): Promise<boolean> => {
    const db = await getDatabase()
    // Soft delete
    db.run(`UPDATE suppliers SET is_active = 0, sync_status = 'pending' WHERE id = ?`, [id])
    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('suppliers', 'DELETE', ?, ?, 'pending', datetime('now'))
    `,
      [id, JSON.stringify({ id, is_active: 0 })]
    )
    db.save()
    return true
  }
}
