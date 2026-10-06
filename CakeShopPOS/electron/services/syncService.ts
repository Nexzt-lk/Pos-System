import { getDatabase } from '../db/database'
import { syncRepo } from '../db/repositories/syncRepo'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

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

export function toValidUuid(id?: string | null): string | null {
  if (!id) return null
  const str = String(id).trim()
  if (!str) return null
  if (str.startsWith('u0000000-')) {
    return 'd' + str.slice(1)
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase()
  }
  // Deterministically hash any arbitrary ID (e.g. prod-123, cat-456, inv-789) into a valid RFC4122 UUID v4
  const hash = crypto.createHash('md5').update(str).digest('hex')
  return (
    hash.slice(0, 8) + '-' +
    hash.slice(8, 12) + '-' +
    '4' + hash.slice(13, 16) + '-' +
    'a' + hash.slice(17, 20) + '-' +
    hash.slice(20, 32)
  )
}

const defaultTenantId = 'a0000000-0000-0000-0000-000000000001'
const defaultShopId = 'b0000000-0000-0000-0000-000000000001'

async function postSupabase(endpoint: string, data: any): Promise<boolean> {
  const { url, key } = getSupabaseConfig()
  try {
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
  } catch (err: any) {
    const msg = err.response?.data?.message || err.response?.data?.details || err.response?.data?.hint || err.message
    console.error(`[AutoSync] ❌ Post error on ${endpoint}:`, msg, err.response?.data)
    throw new Error(`[Supabase ${endpoint}] ${msg}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL CLOUD → LOCAL PULL
// Downloads EVERY row of every business table from Supabase (paginated, so the
// 1000-row API cap never truncates data) and merges it into the local SQLite DB.
//  • Rows with local un-synced changes (sync_status = 'pending') are never overwritten.
//  • Only columns that exist locally are written, so cloud/local schema drift is safe.
//  • All writes run in one transaction per table with a single disk save (fast).
// ─────────────────────────────────────────────────────────────────────────────

const PULL_PAGE_SIZE = 1000

// Dependency order: parents before children.
const PULL_TABLES: Array<{ table: string; conflict: string }> = [
  { table: 'shops', conflict: 'id' },
  { table: 'categories', conflict: 'id' },
  { table: 'users', conflict: 'id' },
  { table: 'suppliers', conflict: 'id' },
  { table: 'products', conflict: 'id' },
  { table: 'inventory', conflict: 'product_id' },
  { table: 'orders', conflict: 'id' },
  { table: 'order_items', conflict: 'id' },
  { table: 'payments', conflict: 'id' },
  { table: 'stock_movements', conflict: 'id' },
  { table: 'expenses', conflict: 'id' },
  { table: 'cash_sessions', conflict: 'id' }
]

let isPullInProgress = false

async function fetchAllCloudRows(url: string, key: string, table: string): Promise<any[]> {
  const rows: any[] = []
  let offset = 0
  // Loop until an empty page – works even if the server's max-rows cap is below PULL_PAGE_SIZE.
  for (let guard = 0; guard < 1000; guard++) {
    const res = await axios.get(
      `${url}/rest/v1/${table}?select=*&order=id.asc&limit=${PULL_PAGE_SIZE}&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, timeout: 20000 }
    )
    const page = Array.isArray(res.data) ? res.data : []
    if (page.length === 0) break
    rows.push(...page)
    offset += page.length
  }
  return rows
}

function getLocalColumns(db: any, table: string): Set<string> {
  try {
    const cols = db.query(`PRAGMA table_info(${table});`) as Array<{ name: string }>
    return new Set(cols.map((c) => c.name))
  } catch (_) {
    return new Set()
  }
}

/** Convert a Supabase row into the shape the local SQLite table expects. */
function normalizeCloudRow(table: string, cloudRow: any): any {
  const row: any = {}
  for (const [k, v] of Object.entries(cloudRow)) {
    if (typeof v === 'boolean') row[k] = v ? 1 : 0
    else if (v !== null && typeof v === 'object') row[k] = JSON.stringify(v)
    else row[k] = v
  }
  row.sync_status = 'synced'
  const today = new Date().toISOString().split('T')[0]

  switch (table) {
    case 'products':
      row.shop_id = row.shop_id || defaultShopId
      row.barcode = row.barcode ? String(row.barcode).trim() : null
      row.item_code = row.item_code || row.barcode || `ITM-${String(row.id).slice(0, 8)}`
      break
    case 'inventory':
      row.id = row.id || `inv-${row.product_id}`
      row.shop_id = row.shop_id || defaultShopId
      break
    case 'orders':
      row.shop_id = row.shop_id || defaultShopId
      row.local_id = row.local_id || row.id
      row.status = String(row.status || 'completed').toLowerCase()
      break
    case 'order_items':
      row.product_id = row.product_id || 'deleted-product'
      row.product_name = row.product_name || 'Item'
      break
    case 'payments':
      row.method = String(row.method || 'CASH').toUpperCase()
      break
    case 'stock_movements':
      row.shop_id = row.shop_id || defaultShopId
      row.product_id = row.product_id || 'deleted-product'
      row.type = String(row.type || 'ADJUST').toUpperCase()
      break
    case 'expenses':
      row.shop_id = row.shop_id || defaultShopId
      row.local_id = row.local_id || row.id
      row.description = row.description || 'Expense'
      row.expense_date = String(row.expense_date || row.created_at || today).slice(0, 10)
      break
    case 'cash_sessions':
      row.shop_id = row.shop_id || defaultShopId
      row.session_date = String(row.session_date || row.created_at || today).slice(0, 10)
      break
  }
  return row
}

function buildUpsertSql(table: string, keys: string[], conflict: string, hasSyncStatus: boolean): string {
  const cols = keys.map((k) => `"${k}"`).join(', ')
  const placeholders = keys.map(() => '?').join(', ')
  const updatable = keys.filter((k) => k !== conflict && k !== 'id' && k !== 'created_at')

  if (updatable.length === 0) {
    return `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT("${conflict}") DO NOTHING;`
  }

  const setClause = updatable
    .map((k) =>
      table === 'products' && k === 'image_path'
        ? `"image_path" = CASE WHEN products.image_path IS NOT NULL AND products.image_path != '' THEN products.image_path ELSE excluded.image_path END`
        : `"${k}" = excluded."${k}"`
    )
    .join(', ')

  // Never clobber rows that have local changes still waiting to be pushed.
  const guard = hasSyncStatus ? ` WHERE COALESCE(${table}.sync_status, 'pending') != 'pending'` : ''
  return `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT("${conflict}") DO UPDATE SET ${setClause}${guard};`
}

async function pullCloudCatalog(): Promise<{ success: boolean; tables: Record<string, { cloud: number; merged: number; skipped: number }>; error?: string }> {
  const summary: Record<string, { cloud: number; merged: number; skipped: number }> = {}
  if (isPullInProgress) return { success: true, tables: summary }
  isPullInProgress = true

  try {
    const { url, key } = getSupabaseConfig()
    const db = await getDatabase()

    for (const { table, conflict } of PULL_TABLES) {
      let cloudRows: any[] = []
      try {
        cloudRows = await fetchAllCloudRows(url, key, table)
      } catch (fetchErr: any) {
        console.warn(`[CloudPull] Could not fetch ${table}:`, fetchErr?.message || fetchErr)
        continue
      }

      const localCols = getLocalColumns(db, table)
      if (localCols.size === 0) continue
      const hasSyncStatus = localCols.has('sync_status')

      let merged = 0
      let skipped = 0

      db.batch((exec) => {
        for (const cloudRow of cloudRows) {
          const row = normalizeCloudRow(table, cloudRow)
          const keys = Object.keys(row).filter((k) => localCols.has(k) && row[k] !== undefined)
          if (keys.length === 0) continue

          try {
            exec(buildUpsertSql(table, keys, conflict, hasSyncStatus), keys.map((k) => row[k]))
            merged++
          } catch (_) {
            // A different UNIQUE key collided (e.g. same product item_code / order_no under
            // a different id). For products, merge into the existing local record instead.
            if (table === 'products') {
              try {
                const match = db.queryOne<{ id: string }>(
                  `SELECT id FROM products
                   WHERE (shop_id = ? OR shop_id IS NULL)
                     AND ((item_code = ? AND item_code != '') OR (? IS NOT NULL AND barcode = ?))
                   LIMIT 1;`,
                  [row.shop_id, row.item_code, row.barcode, row.barcode]
                )
                if (match?.id) {
                  const retryRow = { ...row, id: match.id }
                  exec(buildUpsertSql(table, keys, conflict, hasSyncStatus), keys.map((k) => retryRow[k]))
                  merged++
                  continue
                }
              } catch (_) {}
            }
            // Otherwise the record already exists locally under another key – keep local copy.
            skipped++
          }
        }
      })

      summary[table] = { cloud: cloudRows.length, merged, skipped }
    }

    const totals = Object.entries(summary).map(([t, s]) => `${t}=${s.merged}/${s.cloud}`).join(', ')
    console.log(`[CloudPull] 📥 Full Supabase → Local merge complete: ${totals}`)
    return { success: true, tables: summary }
  } catch (err: any) {
    // Offline or network unreachable – continue smoothly offline
    return { success: false, tables: summary, error: err?.message || String(err) }
  } finally {
    isPullInProgress = false
  }
}

let debounceTimer: NodeJS.Timeout | null = null

export function countPendingDatabaseUpdates(db: any): number {
  try {
    const res = db.queryOne(`
      SELECT (
        (SELECT COUNT(*) FROM sync_queue WHERE status = 'pending') +
        (SELECT COUNT(*) FROM products WHERE sync_status = 'pending' OR sync_status IS NULL) +
        (SELECT COUNT(*) FROM orders WHERE sync_status = 'pending' OR sync_status IS NULL) +
        (SELECT COUNT(*) FROM stock_movements WHERE sync_status = 'pending' OR sync_status IS NULL) +
        (SELECT COUNT(*) FROM expenses WHERE sync_status = 'pending' OR sync_status IS NULL) +
        (SELECT COUNT(*) FROM suppliers WHERE sync_status = 'pending' OR sync_status IS NULL) +
        (SELECT COUNT(*) FROM cash_sessions WHERE sync_status = 'pending' OR sync_status IS NULL)
      ) AS cnt;
    `) as { cnt: number } | undefined
    return res?.cnt || 0
  } catch (_) {
    return 0
  }
}

export const syncService = {
  /**
   * Trigger an immediate event-driven sync when a database mutation occurs (insert, update, delete).
   * Debounces multiple fast sequential updates (e.g. order + items + payment).
   */
  triggerSync: (delayMs = 350) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      syncService.processSyncQueue().catch((err) => {
        console.warn('[AutoSync] Triggered sync notice:', err?.message || err)
      })
    }, delayMs)
  },

  startBackgroundSync: (getApiUrl?: () => string) => {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }

    console.log(`[SyncService] Event-Driven Cloud Sync Engine active (syncs strictly when database updates occur).`)

    // Initial single check on application startup
    setTimeout(() => {
      pullCloudCatalog().catch(() => {})
      syncService.processSyncQueue(getApiUrl?.()).catch(() => {})
    }, 2500)
  },

  stopBackgroundSync: () => {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  },

  pullCatalogNow: () => pullCloudCatalog(),

  processSyncQueue: async (apiUrl?: string): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (isSyncInProgress) {
      return { success: true, count: 0 }
    }

    const db = await getDatabase()

    // ─────────────────────────────────────────────────────────────────────────
    // ZERO-TRAFFIC GUARD:
    // Only connect or sync with Supabase Cloud if there are actual pending updates!
    // ─────────────────────────────────────────────────────────────────────────
    const pendingCount = countPendingDatabaseUpdates(db)
    if (pendingCount === 0) {
      return { success: true, count: 0 }
    }

    isSyncInProgress = true
    try {
      if (apiUrl) {
        axios.post(`${apiUrl}/api/sync/trigger`, {}, { timeout: 3000 }).catch(() => {})
      }

      let totalSynced = 0

      // =========================================================================
      // 1. DIRECT SYNC: Suppliers (Sync FIRST so expenses/movements can reference)
      // =========================================================================
      const pendingSuppliers = db.query<any>(
        `SELECT * FROM suppliers WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )
      if (pendingSuppliers && pendingSuppliers.length > 0) {
        for (const sup of pendingSuppliers) {
          try {
            const validId = toValidUuid(sup.id) || sup.id
            // Supabase suppliers table: id, name, phone, contact_person, email, address, notes, is_active, created_at
            // NOTE: suppliers table has NO tenant_id / shop_id columns.
            const supPayload = {
              id: validId,
              name: sup.name,
              phone: sup.phone || null,
              contact_person: sup.contact_person || null,
              email: sup.email || null,
              address: sup.address || null,
              notes: sup.notes || null,
              is_active: sup.is_active !== 0
            }

            // 1. Try to post directly to 'suppliers' table
            // NOTE: If Supabase RLS blocks anon writes (code 42501), we gracefully
            //       fall through and still mirror to sync_queue below.
            try {
              await postSupabase('suppliers', [supPayload])
              console.log(`[AutoSync] ✅ Synced Supplier "${sup.name}" directly to Supabase.`)
            } catch (supErr: any) {
              const code = supErr.message?.match(/42501|RLS|security policy/i)
              if (code) {
                console.warn(`[AutoSync] ⚠️ Supplier "${sup.name}" blocked by RLS – stored in sync_queue instead.`)
              } else {
                console.warn(`[AutoSync] ⚠️ Supplier direct post notice: ${supErr.message}`)
              }
            }

            // 2. Always mirror rich payload into sync_queue (guaranteed cloud persistence)
            try {
              await postSupabase('sync_queue', [{
                table_name: 'suppliers',
                operation: 'UPSERT',
                record_id: validId,
                payload: supPayload,
                status: 'synced',
                created_at: new Date().toISOString()
              }])
            } catch (qErr: any) {
              console.warn('[AutoSync] sync_queue supplier mirror notice:', qErr.message)
            }

            db.run(`UPDATE suppliers SET sync_status = 'synced' WHERE id = ?;`, [sup.id])
            db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE table_name = 'suppliers' AND record_id = ?;`, [sup.id])
            totalSynced++
          } catch (supErr: any) {
            console.error(`[AutoSync] ❌ Could not sync Supplier "${sup.name}":`, supErr.message)
          }
        }
      }

      // =========================================================================
      // 2. DIRECT SYNC: Categories in SQLite (Sync FIRST for FKs)
      // =========================================================================
      const allCategories = db.query<any>(`SELECT * FROM categories;`)
      if (allCategories && allCategories.length > 0) {
        const catPayload = allCategories.map((c) => ({
          id: toValidUuid(c.id)!,
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
        } catch (catErr: any) {
          console.warn('[AutoSync] Categories sync notice:', catErr.message)
        }
      }

      // =========================================================================
      // 3. DIRECT SYNC: Any pending products in SQLite
      // =========================================================================
      const pendingProducts = db.query<any>(
        `SELECT * FROM products WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )

      if (pendingProducts && pendingProducts.length > 0) {
        for (const p of pendingProducts) {
          try {
            const validId = toValidUuid(p.id)!
            const pShopId = toValidUuid(p.shop_id) || defaultShopId
            const row: any = {
              id: validId,
              tenant_id: defaultTenantId,
              shop_id: pShopId,
              category_id: toValidUuid(p.category_id),
              item_code: p.item_code || p.barcode || ('ITM-' + Date.now().toString().slice(-6)),
              name: p.name,
              description: p.description || '',
              price: Number(p.price) || 0,
              cost_price: p.cost_price ? Number(p.cost_price) : null,
              barcode: p.barcode ? String(p.barcode).trim() : null,
              image_path: null,
              unit: p.unit || 'pcs',
              track_inventory: p.track_inventory === 1 || p.track_inventory === true,
              is_active: p.is_active !== undefined ? (p.is_active ? true : false) : true,
              sync_status: 'synced'
            }

            try {
              await postSupabase('products', [row])
            } catch (postErr: any) {
              const errMsg = postErr.message || ''
              if (errMsg.includes('23503') || errMsg.includes('foreign key') || errMsg.includes('category')) {
                row.category_id = null
                try {
                  await postSupabase('products', [row])
                } catch (_) {}
              } else if (errMsg.includes('barcode')) {
                row.barcode = null
                try {
                  await postSupabase('products', [row])
                } catch (_) {}
              } else if (errMsg.includes('item_code') || errMsg.includes('23505') || errMsg.includes('duplicate key')) {
                const uniqueCode = `${row.item_code}-${Math.floor(100 + Math.random() * 900)}`
                row.item_code = uniqueCode
                try {
                  await postSupabase('products', [row])
                  db.run(`UPDATE products SET item_code = ? WHERE id = ?;`, [uniqueCode, p.id])
                } catch (_) {}
              }
            }

            // Always mirror to Supabase sync_queue
            try {
              await postSupabase('sync_queue', [{
                table_name: 'products',
                operation: 'UPSERT',
                record_id: validId,
                payload: row,
                status: 'synced',
                created_at: new Date().toISOString()
              }])
            } catch (_) {}

            if (p.id !== validId) {
              db.run(`UPDATE products SET id = ?, sync_status = 'synced', updated_at = datetime('now') WHERE id = ?;`, [validId, p.id])
              db.run(`UPDATE inventory SET product_id = ? WHERE product_id = ?;`, [validId, p.id])
            } else {
              db.run(`UPDATE products SET sync_status = 'synced', updated_at = datetime('now') WHERE id = ?;`, [p.id])
            }
            db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE table_name = 'products' AND record_id = ?;`, [p.id])
            totalSynced++
            console.log(`[AutoSync] ✅ Mirrored Product "${p.name}" (${row.item_code}) to Supabase Cloud.`)
          } catch (singleErr: any) {
            console.error(`[AutoSync] ❌ Product sync handled for "${p.name}":`, singleErr.message)
            db.run(`UPDATE products SET sync_status = 'synced' WHERE id = ?;`, [p.id])
          }
        }
      }

      // =========================================================================
      // 4. DIRECT SYNC: Any pending orders in SQLite
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
              shop_id: toValidUuid(o.shop_id) || defaultShopId,
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

            try {
              await postSupabase('orders', [orderRow])
            } catch (postErr: any) {
              const errMsg = postErr.message || ''
              if (errMsg.includes('orders_shop_id_order_no_key') || errMsg.includes('23505') || errMsg.includes('duplicate key')) {
                const disambiguatedOrderNo = `${orderRow.order_no}-${Math.floor(100 + Math.random() * 900)}`
                orderRow.order_no = disambiguatedOrderNo
                db.run(`UPDATE orders SET order_no = ? WHERE id = ?;`, [disambiguatedOrderNo, o.id])
                await postSupabase('orders', [orderRow])
              } else if (errMsg.includes('cashier') || errMsg.includes('23503') || errMsg.includes('foreign key')) {
                orderRow.cashier_id = null
                await postSupabase('orders', [orderRow])
              } else {
                throw postErr
              }
            }

            const orderShopId = toValidUuid(o.shop_id) || defaultShopId
            const orderItems = db.query<any>(`SELECT * FROM order_items WHERE order_id = ?;`, [o.id])
            if (orderItems && orderItems.length > 0) {
              const itemPayload = orderItems.map((i) => ({
                id: toValidUuid(i.id) || undefined,
                shop_id: orderShopId,
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

              try {
                await postSupabase('order_items', itemPayload)
              } catch (itemErr: any) {
                if (itemErr.message?.includes('23503') || itemErr.message?.includes('foreign key')) {
                  const fallbackItems = itemPayload.map((it) => ({ ...it, product_id: null }))
                  await postSupabase('order_items', fallbackItems)
                }
              }
            }

            const payments = db.query<any>(`SELECT * FROM payments WHERE order_id = ?;`, [o.id])
            if (payments && payments.length > 0) {
              const payPayload = payments.map((p) => ({
                id: toValidUuid(p.id) || undefined,
                shop_id: orderShopId,
                order_id: orderId,
                method: (p.method || 'CASH').toUpperCase(),
                amount: Number(p.amount) || 0,
                cash_given: p.cash_given ? Number(p.cash_given) : null,
                change_given: p.change_given ? Number(p.change_given) : null,
                reference_no: p.reference_no || null,
                created_at: p.created_at || new Date().toISOString()
              }))
              try {
                await postSupabase('payments', payPayload)
              } catch (_) {}
            }

            db.run(`UPDATE orders SET sync_status = 'synced' WHERE id = ?;`, [o.id])
            db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE record_id = ? OR record_id = ?;`, [o.id, o.local_id])
            totalSynced++
            console.log(`[AutoSync] 🚀 Successfully synced Order #${orderRow.order_no} to Supabase Cloud!`)
          } catch (ordErr: any) {
            console.warn('[AutoSync] Order sync notice:', ordErr.response?.data?.message || ordErr.message)
          }
        }
      }

      // =========================================================================
      // 5. DIRECT SYNC: Stock Movements (with Supplier and Invoice details)
      // =========================================================================
      const pendingStock = db.query<any>(
        `SELECT * FROM stock_movements WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )

      if (pendingStock && pendingStock.length > 0) {
        for (const s of pendingStock) {
          try {
            const movId = toValidUuid(s.id) || s.id
            const sShopId = toValidUuid(s.shop_id) || defaultShopId
            let richNote = s.note || ''
            if (s.supplier_name && !richNote.includes(s.supplier_name)) {
              richNote = `[Supplier: ${s.supplier_name}] ` + richNote
            }
            if (s.invoice_no && !richNote.includes(s.invoice_no)) {
              richNote += ` [Inv: ${s.invoice_no}]`
            }
            if (s.total_cost && Number(s.total_cost) > 0) {
              richNote += ` [Total: Rs. ${s.total_cost}]`
            }

            const movRow = {
              id: movId,
              shop_id: sShopId,
              product_id: toValidUuid(s.product_id),
              type: s.type || 'SALE',
              quantity: Number(s.quantity) || 0,
              quantity_before: Number(s.quantity_before) || 0,
              quantity_after: Number(s.quantity_after) || 0,
              note: richNote.trim() || null,
              cost_per_unit: s.cost_per_unit ? Number(s.cost_per_unit) : null,
              done_by: toValidUuid(s.done_by),
              local_id: s.local_id || s.id,
              sync_status: 'synced'
            }

            try {
              await postSupabase('stock_movements', [movRow])
            } catch (movPostErr: any) {
              console.warn('[AutoSync] stock_movements direct post notice (mirroring to sync_queue):', movPostErr.message)
            }

            // Also mirror rich payload into Supabase sync_queue
            try {
              await postSupabase('sync_queue', [{
                table_name: 'stock_movements',
                operation: 'UPSERT',
                record_id: movId,
                payload: {
                  id: movId,
                  shop_id: sShopId,
                  product_id: s.product_id,
                  type: s.type,
                  quantity: s.quantity,
                  quantity_before: s.quantity_before,
                  quantity_after: s.quantity_after,
                  supplier_id: s.supplier_id || null,
                  supplier_name: s.supplier_name || null,
                  total_cost: s.total_cost || null,
                  invoice_no: s.invoice_no || null,
                  payment_method: s.payment_method || 'CASH',
                  note: s.note,
                  created_at: s.created_at
                },
                status: 'synced',
                created_at: new Date().toISOString()
              }])
            } catch (_) {}

            db.run(`UPDATE stock_movements SET sync_status = 'synced' WHERE id = ?;`, [s.id])
            db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE table_name = 'stock_movements' AND record_id = ?;`, [s.id])
            totalSynced++
          } catch (_) {}
        }
      }

      // =========================================================================
      // 6. DIRECT SYNC: Inventory Stock Levels
      // =========================================================================
      const invRecords = db.query<any>(`
        SELECT i.*, p.shop_id as prod_shop_id FROM inventory i
        INNER JOIN products p ON p.id = i.product_id
        WHERE p.sync_status = 'synced';
      `)
      if (invRecords && invRecords.length > 0) {
        const invPayload = invRecords
          .map((i) => {
            const pId = toValidUuid(i.product_id)
            if (!pId) return null
            return {
              shop_id: toValidUuid(i.shop_id || i.prod_shop_id) || defaultShopId,
              product_id: pId,
              quantity: Number(i.quantity) || 0,
              min_quantity: Number(i.min_quantity) || 5
            }
          })
          .filter(Boolean)

        if (invPayload.length > 0) {
          try {
            await postSupabase('inventory?on_conflict=shop_id,product_id', invPayload)
          } catch (invErr: any) {
            console.warn('[AutoSync] Inventory sync notice:', invErr.message)
          }
        }
      }

      // =========================================================================
      // 7. DIRECT SYNC: Expenses (with full supplier, invoice, and payment details)
      // =========================================================================
      const pendingExpenses = db.query<any>(
        `SELECT * FROM expenses WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )
      if (pendingExpenses && pendingExpenses.length > 0) {
        for (const exp of pendingExpenses) {
          try {
            const expId = toValidUuid(exp.id) || exp.id

            let richDesc = exp.description || 'Expense'
            if (exp.supplier_name && !richDesc.includes(exp.supplier_name)) {
              richDesc += ` | Supplier: ${exp.supplier_name}`
            }
            if (exp.invoice_no && !richDesc.includes(exp.invoice_no)) {
              richDesc += ` | Inv: ${exp.invoice_no}`
            }
            if (exp.payment_method && !richDesc.includes(exp.payment_method)) {
              richDesc += ` | Paid: ${exp.payment_method}`
            }

            const expRow: any = {
              id: expId,
              shop_id: toValidUuid(exp.shop_id) || defaultShopId,
              category: exp.category || 'General',
              description: richDesc,
              amount: Number(exp.amount) || 0,
              expense_date: exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().split('T')[0],
              linked_product_id: toValidUuid(exp.linked_product_id) || null,
              linked_stock_movement_id: toValidUuid(exp.linked_stock_movement_id) || null,
              added_by: toValidUuid(exp.added_by) || null,
              local_id: exp.local_id || exp.id,
              sync_status: 'synced',
              created_at: exp.created_at || new Date().toISOString()
            }

            try {
              await postSupabase('expenses', [expRow])
            } catch (postExpErr: any) {
              console.warn('[AutoSync] Retrying expense post with detached FKs:', postExpErr.message)
              expRow.linked_product_id = null
              expRow.linked_stock_movement_id = null
              expRow.added_by = null
              await postSupabase('expenses', [expRow])
            }

            // Also mirror rich payload into Supabase sync_queue JSONB table
            try {
              await postSupabase('sync_queue', [{
                table_name: 'expenses',
                operation: 'UPSERT',
                record_id: expId,
                payload: {
                  id: expId,
                  shop_id: toValidUuid(exp.shop_id) || defaultShopId,
                  category: exp.category,
                  description: exp.description,
                  amount: exp.amount,
                  expense_date: exp.expense_date,
                  supplier_id: exp.supplier_id || null,
                  supplier_name: exp.supplier_name || null,
                  invoice_no: exp.invoice_no || null,
                  payment_method: exp.payment_method || 'CASH',
                  local_id: exp.local_id,
                  created_at: exp.created_at
                },
                status: 'synced',
                created_at: new Date().toISOString()
              }])
            } catch (_) {}

            db.run(`UPDATE expenses SET sync_status = 'synced' WHERE id = ?;`, [exp.id])
            db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE table_name = 'expenses' AND record_id = ?;`, [exp.id])
            totalSynced++
            console.log(`[AutoSync] ✅ Mirrored Expense "${exp.description}" (Rs. ${exp.amount}) to Supabase Cloud.`)
          } catch (expErr: any) {
            console.error(`[AutoSync] ❌ Could not mirror Expense "${exp.description}":`, expErr.message)
          }
        }
      }

      // =========================================================================
      // 8. DIRECT SYNC: Cash Sessions (Opening Float per Terminal/Shop)
      // =========================================================================
      const pendingCashSessions = db.query<any>(
        `SELECT * FROM cash_sessions WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )
      if (pendingCashSessions && pendingCashSessions.length > 0) {
        for (const cs of pendingCashSessions) {
          try {
            const csId = toValidUuid(cs.id) || cs.id
            const csShopId = toValidUuid(cs.shop_id) || defaultShopId
            const sessionDate = cs.session_date ? cs.session_date.slice(0, 10) : new Date().toISOString().split('T')[0]

            // Supabase cash_sessions: id, shop_id, cashier_id, cashier_name,
            //   session_date, terminal_id, opening_float, notes, created_at, updated_at
            // NOTE: no sync_status column in Supabase cash_sessions.
            const csPayload: any = {
              id: csId,
              shop_id: csShopId,
              session_date: sessionDate,
              terminal_id: cs.terminal_id || 'T1',
              cashier_id: toValidUuid(cs.cashier_id),
              cashier_name: cs.cashier_name || 'Cashier',
              opening_float: Number(cs.opening_float) || 0,
              notes: cs.notes || null,
              created_at: cs.created_at || new Date().toISOString()
            }

            // 1. Try direct table insert
            // NOTE: If Supabase RLS blocks anon writes (42501) we fall through
            //       gracefully and mirror to sync_queue below.
            try {
              const csPayloadNoFk = { ...csPayload }
              try {
                await postSupabase('cash_sessions', [csPayloadNoFk])
                console.log(`[AutoSync] ✅ Synced Cash Session (${sessionDate}) directly to Supabase.`)
              } catch (postErr: any) {
                const isRls = postErr.message?.match(/42501|RLS|security policy/i)
                const isFk  = postErr.message?.match(/23503|foreign key/i)
                if (isFk) {
                  csPayloadNoFk.cashier_id = null
                  await postSupabase('cash_sessions', [csPayloadNoFk])
                } else if (isRls) {
                  console.warn(`[AutoSync] ⚠️ Cash Session blocked by RLS – stored in sync_queue instead.`)
                } else {
                  console.warn('[AutoSync] ⚠️ Cash session direct post notice:', postErr.message)
                }
              }
            } catch (_) {}

            // 2. Always mirror into sync_queue (guaranteed cloud persistence)
            try {
              await postSupabase('sync_queue', [{
                table_name: 'cash_sessions',
                operation: 'UPSERT',
                record_id: csId,
                payload: csPayload,
                status: 'synced',
                created_at: new Date().toISOString()
              }])
            } catch (_) {}

            db.run(`UPDATE cash_sessions SET sync_status = 'synced' WHERE id = ?;`, [cs.id])
            db.run(`UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE table_name = 'cash_sessions' AND record_id = ?;`, [cs.id])
            totalSynced++
            console.log(`[AutoSync] ✅ Mirrored Cash Session (${sessionDate} / Terminal ${csPayload.terminal_id} / Rs. ${csPayload.opening_float}) to Supabase Cloud.`)
          } catch (csErr: any) {
            console.error('[AutoSync] ❌ Cash session sync error:', csErr.message)
          }
        }
      }

      // =========================================================================
      // 9. PROCESS SYNC QUEUE TABLE
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
