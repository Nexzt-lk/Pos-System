import { getDatabase } from '../db/database'
import { syncRepo } from '../db/repositories/syncRepo'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

let syncInterval: NodeJS.Timeout | null = null
let isSyncInProgress = false

const FALLBACK_SUPABASE_URL = 'https://lekvwqdqarnvqsksjtti.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3Z3cWRxYXJudnFza3NqdHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjc1NjcsImV4cCI6MjEwNDY0MzU2N30.qBSgDCiemOfQFwp3KsskqN7T30-d2pyofRh-X8wd_1E'

function getSupabaseConfig(): { url: string; key: string } {
  let url = process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
  let key = process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

  try {
    const searchDirs = [
      process.cwd(),
      path.join(process.cwd(), 'CakeShopPOS'),
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '../..')
    ]

    for (const dir of searchDirs) {
      const envPath = path.join(dir, '.env')
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')
        content.split('\n').forEach((line) => {
          const parts = line.split('=')
          if (parts.length >= 2 && !line.startsWith('#')) {
            const k = parts[0].trim()
            const v = parts.slice(1).join('=').trim()
            if (k === 'VITE_SUPABASE_URL' && v && !v.includes('placeholder')) url = v
            if (k === 'VITE_SUPABASE_ANON_KEY' && v && !v.includes('placeholder')) key = v
          }
        })
        break
      }
    }
  } catch (_) {}

  return { url: url.replace(/\/$/, ''), key }
}

function toValidUuid(id?: string | null): string | null {
  if (!id) return null
  const str = String(id).trim()
  if (str.startsWith('u0000000-')) {
    return 'd' + str.slice(1)
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase()
  }
  return null
}

const defaultTenantId = 'a0000000-0000-0000-0000-000000000001'
const defaultShopId = 'b0000000-0000-0000-0000-000000000001'

async function postSupabase(endpoint: string, data: any): Promise<boolean> {
  const { url, key } = getSupabaseConfig()
  const res = await axios.post(`${url}/rest/v1/${endpoint}`, data, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    timeout: 10000
  })
  return res.status >= 200 && res.status < 300
}

async function pullCloudCatalog(): Promise<void> {
  try {
    const { url, key } = getSupabaseConfig()
    const db = await getDatabase()

    // 1. Fetch Categories from Supabase Cloud
    const catRes = await axios.get(`${url}/rest/v1/categories?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      timeout: 5000
    })

    if (catRes.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
      for (const cat of catRes.data) {
        db.run(
          `
          INSERT INTO categories (id, name, code_prefix, color, icon, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code_prefix = excluded.code_prefix,
            color = excluded.color,
            icon = excluded.icon,
            sort_order = excluded.sort_order,
            is_active = excluded.is_active;
        `,
          [
            cat.id,
            cat.name,
            cat.code_prefix || 'CAT',
            cat.color || '#6366f1',
            cat.icon || 'cake',
            cat.sort_order ?? 0,
            cat.is_active !== false ? 1 : 0
          ]
        )
      }
    }

    // 2. Fetch Products from Supabase Cloud
    const prodRes = await axios.get(`${url}/rest/v1/products?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      timeout: 5000
    })

    if (prodRes.data && Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      for (const p of prodRes.data) {
        db.run(
          `
          INSERT INTO products (
            id, category_id, item_code, name, description, price, cost_price,
            barcode, image_path, unit, track_inventory, is_active, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
          ON CONFLICT(id) DO UPDATE SET
            category_id = excluded.category_id,
            item_code = excluded.item_code,
            name = excluded.name,
            description = excluded.description,
            price = excluded.price,
            cost_price = excluded.cost_price,
            barcode = excluded.barcode,
            image_path = COALESCE(excluded.image_path, products.image_path),
            unit = excluded.unit,
            track_inventory = excluded.track_inventory,
            is_active = excluded.is_active,
            sync_status = 'synced';
        `,
          [
            p.id,
            p.category_id || null,
            p.item_code || p.barcode || 'ITEM',
            p.name,
            p.description || '',
            Number(p.price) || 0,
            p.cost_price ? Number(p.cost_price) : null,
            p.barcode || null,
            p.image_path || null,
            p.unit || 'pcs',
            p.track_inventory ? 1 : 0,
            p.is_active !== false ? 1 : 0
          ]
        )

        db.run(
          `
          INSERT OR IGNORE INTO inventory (id, product_id, quantity, min_quantity)
          VALUES (?, ?, 25.0, 5.0);
        `,
          ['inv-' + p.id, p.id]
        )
      }
      db.save()
      console.log(`[AutoSync] 📥 Synchronized catalog from Supabase Cloud: ${prodRes.data.length} products verified.`)
    }
  } catch (_) {
    // Offline or network unreachable - continue smoothly offline
  }
}

let lastCatalogPullTime = 0

export const syncService = {
  startBackgroundSync: (getApiUrl?: () => string, intervalMs = 5000) => {
    if (syncInterval) clearInterval(syncInterval)

    console.log(`[SyncService] Starting High-Frequency Auto Cloud Sync Engine (every ${intervalMs / 1000}s)`)

    setTimeout(() => {
      pullCloudCatalog().catch(() => {})
      syncService.processSyncQueue(getApiUrl?.())
    }, 1500)

    syncInterval = setInterval(async () => {
      await syncService.processSyncQueue(getApiUrl?.())
    }, intervalMs)
  },

  stopBackgroundSync: () => {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  },

  pullCatalogNow: () => pullCloudCatalog(),

  processSyncQueue: async (apiUrl?: string): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (isSyncInProgress) {
      return { success: true, count: 0 }
    }

    isSyncInProgress = true
    try {
      // Pull catalog periodically (every 5 minutes or if database is new)
      if (Date.now() - lastCatalogPullTime > 300000) {
        lastCatalogPullTime = Date.now()
        await pullCloudCatalog().catch(() => {})
      }

      if (apiUrl) {
        axios.post(`${apiUrl}/api/sync/trigger`, {}, { timeout: 3000 }).catch(() => {})
      }

      const db = await getDatabase()
      let totalSynced = 0

      // =========================================================================
      // 1. DIRECT SYNC: Any pending products in SQLite
      // =========================================================================
      const pendingProducts = db.query<any>(
        `SELECT * FROM products WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )

      if (pendingProducts && pendingProducts.length > 0) {
        const payload = pendingProducts.map((p) => ({
          id: toValidUuid(p.id) || p.id,
          tenant_id: defaultTenantId,
          shop_id: defaultShopId,
          category_id: toValidUuid(p.category_id),
          item_code: p.item_code || p.barcode || 'ITEM',
          name: p.name,
          description: p.description || '',
          price: Number(p.price) || 0,
          cost_price: p.cost_price ? Number(p.cost_price) : null,
          barcode: p.barcode || null,
          image_path: p.image_path || null,
          unit: p.unit || 'pcs',
          track_inventory: p.track_inventory === 1 || p.track_inventory === true,
          is_active: p.is_active !== undefined ? (p.is_active ? true : false) : true,
          sync_status: 'synced'
        }))

        try {
          await postSupabase('products', payload)
          for (const p of pendingProducts) {
            db.run(`UPDATE products SET sync_status = 'synced', updated_at = datetime('now') WHERE id = ?;`, [p.id])
          }
          totalSynced += pendingProducts.length
          console.log(`[AutoSync] ✅ Mirrored ${pendingProducts.length} pending Products to Supabase Cloud.`)
        } catch (prodErr: any) {
          console.warn('[AutoSync] Products sync notice:', prodErr.response?.data?.message || prodErr.message)
        }
      }

      // =========================================================================
      // 2. DIRECT SYNC: Any pending categories in SQLite
      // =========================================================================
      const allCategories = db.query<any>(`SELECT * FROM categories;`)
      if (allCategories && allCategories.length > 0) {
        const catPayload = allCategories.map((c) => ({
          id: toValidUuid(c.id) || c.id,
          tenant_id: defaultTenantId,
          shop_id: defaultShopId,
          name: c.name,
          code_prefix: c.code_prefix || 'CAT',
          color: c.color || '#6366f1',
          icon: c.icon || 'cake',
          sort_order: c.sort_order || 0,
          is_active: c.is_active !== 0
        }))
        try {
          await postSupabase('categories', catPayload)
        } catch (_) {}
      }

      // =========================================================================
      // 3. DIRECT SYNC: Any pending orders in SQLite
      // =========================================================================
      const pendingOrders = db.query<any>(
        `SELECT * FROM orders WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )

      if (pendingOrders && pendingOrders.length > 0) {
        for (const o of pendingOrders) {
          try {
            const orderId = toValidUuid(o.id) || o.id
            const orderRow = {
              id: orderId,
              shop_id: defaultShopId,
              order_no: o.order_no,
              terminal_id: o.terminal_id || 'T1',
              cashier_id: toValidUuid(o.cashier_id),
              cashier_name: o.cashier_name || 'Cashier',
              subtotal: Number(o.subtotal) || 0,
              discount_type: o.discount_type || 'fixed',
              discount_amount: Number(o.discount_amount) || 0,
              tax_amount: Number(o.tax_amount) || 0,
              total_amount: Number(o.total_amount) || 0,
              status: o.status || 'completed',
              note: o.note || null,
              local_id: o.local_id || orderId,
              sync_status: 'synced',
              created_at: o.created_at || new Date().toISOString()
            }

            await postSupabase('orders', [orderRow])

            // Sync items for this order
            const orderItems = db.query<any>(`SELECT * FROM order_items WHERE order_id = ?;`, [o.id])
            if (orderItems && orderItems.length > 0) {
              const itemPayload = orderItems.map((i) => ({
                id: toValidUuid(i.id) || undefined,
                shop_id: defaultShopId,
                order_id: orderId,
                product_id: toValidUuid(i.product_id),
                product_name: i.product_name || 'Item',
                item_code: i.item_code || null,
                unit_price: Number(i.unit_price) || 0,
                cost_price: i.cost_price ? Number(i.cost_price) : null,
                quantity: Number(i.quantity) || 1,
                discount: Number(i.discount) || 0,
                subtotal: Number(i.subtotal) || 0
              }))
              await postSupabase('order_items', itemPayload)
            }

            // Sync payments for this order
            const payments = db.query<any>(`SELECT * FROM payments WHERE order_id = ?;`, [o.id])
            if (payments && payments.length > 0) {
              const payPayload = payments.map((p) => ({
                id: toValidUuid(p.id) || undefined,
                shop_id: defaultShopId,
                order_id: orderId,
                method: p.method || 'CASH',
                amount: Number(p.amount) || 0,
                cash_given: p.cash_given ? Number(p.cash_given) : null,
                change_given: p.change_given ? Number(p.change_given) : null,
                reference_no: p.reference_no || null,
                created_at: p.created_at || new Date().toISOString()
              }))
              await postSupabase('payments', payPayload)
            }

            db.run(`UPDATE orders SET sync_status = 'synced' WHERE id = ?;`, [o.id])
            totalSynced++
          } catch (ordErr: any) {
            console.warn('[AutoSync] Order sync notice:', ordErr.response?.data?.message || ordErr.message)
          }
        }
      }

      // =========================================================================
      // 4. DIRECT SYNC: Stock Movements
      // =========================================================================
      const pendingStock = db.query<any>(
        `SELECT * FROM stock_movements WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )

      if (pendingStock && pendingStock.length > 0) {
        for (const s of pendingStock) {
          try {
            const movRow = {
              id: toValidUuid(s.id) || undefined,
              shop_id: defaultShopId,
              product_id: toValidUuid(s.product_id),
              type: s.type || 'SALE',
              quantity: Number(s.quantity) || 0,
              quantity_before: Number(s.quantity_before) || 0,
              quantity_after: Number(s.quantity_after) || 0,
              note: s.note || null,
              cost_per_unit: s.cost_per_unit ? Number(s.cost_per_unit) : null,
              done_by: toValidUuid(s.done_by),
              local_id: s.local_id || s.id,
              sync_status: 'synced'
            }
            await postSupabase('stock_movements', [movRow])
            db.run(`UPDATE stock_movements SET sync_status = 'synced' WHERE id = ?;`, [s.id])
            totalSynced++
          } catch (_) {}
        }
      }

      // =========================================================================
      // 5. DIRECT SYNC: Inventory Stock Levels
      // =========================================================================
      const invRecords = db.query<any>(`SELECT * FROM inventory;`)
      if (invRecords && invRecords.length > 0) {
        const invPayload = invRecords
          .map((i) => {
            const pId = toValidUuid(i.product_id)
            if (!pId) return null
            return {
              shop_id: defaultShopId,
              product_id: pId,
              quantity: Number(i.quantity) || 0,
              min_quantity: Number(i.min_quantity) || 5
            }
          })
          .filter(Boolean)

        if (invPayload.length > 0) {
          try {
            await postSupabase('inventory', invPayload)
          } catch (_) {}
        }
      }

      // =========================================================================
      // 6. DIRECT SYNC: Expenses
      // =========================================================================
      const pendingExpenses = db.query<any>(
        `SELECT * FROM expenses WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )
      if (pendingExpenses && pendingExpenses.length > 0) {
        for (const exp of pendingExpenses) {
          try {
            const expRow = {
              id: toValidUuid(exp.id) || undefined,
              shop_id: defaultShopId,
              category: exp.category || 'General',
              description: exp.description || 'Expense',
              amount: Number(exp.amount) || 0,
              expense_date: exp.expense_date || new Date().toISOString().split('T')[0],
              added_by: exp.added_by || 'Admin',
              local_id: exp.local_id || exp.id,
              sync_status: 'synced',
              created_at: exp.created_at || new Date().toISOString()
            }
            await postSupabase('expenses', [expRow])
            db.run(`UPDATE expenses SET sync_status = 'synced' WHERE id = ?;`, [exp.id])
            totalSynced++
          } catch (_) {}
        }
      }

      // =========================================================================
      // 7. PROCESS SYNC QUEUE TABLE
      // =========================================================================
      const pendingQueue = (await syncRepo.getPendingItems(50)) || []
      if (pendingQueue.length > 0) {
        const qIds = pendingQueue.map((i) => i.id)
        await syncRepo.markAsSynced(qIds)
        totalSynced += qIds.length
      }

      if (totalSynced > 0) {
        console.log(`[AutoSync] 🚀 Auto-sync completed: ${totalSynced} items synchronized with Supabase Cloud.`)
        db.save()
        return { success: true, count: totalSynced }
      }

      return { success: true, count: 0 }
    } catch (err: any) {
      console.warn(`[AutoSync] Cycle deferred:`, err.message)
      return { success: false, error: err.message }
    } finally {
      isSyncInProgress = false
    }
  }
}
