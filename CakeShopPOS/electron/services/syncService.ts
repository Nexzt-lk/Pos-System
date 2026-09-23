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
        try {
          const itemCode = p.item_code || p.barcode || 'ITEM'
          // Clean up any stale record with same item_code under a different id
          db.run(
            `DELETE FROM products WHERE (item_code = ? AND item_code != '') AND id != ?;`,
            [itemCode, p.id]
          )
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
              itemCode,
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
            VALUES (?, ?, 0, 5.0);
          `,
            ['inv-' + p.id, p.id]
          )
        } catch (itemErr: any) {
          console.warn(`[AutoSync] Could not pull product ${p.name}:`, itemErr.message)
        }
      }
    }

    // 3. Fetch Real Inventory Stock Levels from Supabase Cloud
    try {
      const invRes = await axios.get(`${url}/rest/v1/inventory?select=*`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        },
        timeout: 5000
      })

      if (invRes.data && Array.isArray(invRes.data) && invRes.data.length > 0) {
        for (const inv of invRes.data) {
          const invId = inv.id || ('inv-' + inv.product_id)
          db.run(
            `
            INSERT INTO inventory (id, product_id, quantity, min_quantity, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              quantity = excluded.quantity,
              min_quantity = excluded.min_quantity,
              updated_at = datetime('now');
          `,
            [
              invId,
              inv.product_id,
              Number(inv.quantity) || 0,
              Number(inv.min_quantity) || 5
            ]
          )
        }
      }
    } catch (_) {}

    // 4. Fetch Users / Operator Profiles from Supabase Cloud
    try {
      const userRes = await axios.get(`${url}/rest/v1/users?select=*`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        },
        timeout: 5000
      })

      if (userRes.data && Array.isArray(userRes.data) && userRes.data.length > 0) {
        for (const u of userRes.data) {
          db.run(
            `
            INSERT INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              email = excluded.email,
              pin_hash = excluded.pin_hash,
              password_hash = excluded.password_hash,
              role = excluded.role,
              is_active = excluded.is_active;
          `,
            [
              u.id,
              u.shop_id || defaultShopId,
              u.name,
              u.email || null,
              u.pin_hash || '123456',
              u.password_hash || null,
              u.role || 'cashier',
              u.is_active !== false ? 1 : 0
            ]
          )
        }
      }
    } catch (_) {}    // 5. Sync recent cloud orders & order items so multiple terminals stay synchronized
    try {
      const cloudOrders = await axios.get(`${url}/rest/v1/orders?select=*&order=created_at.desc&limit=100`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        timeout: 6000
      })
      if (cloudOrders.data && Array.isArray(cloudOrders.data)) {
        for (const ord of cloudOrders.data) {
          db.run(
            `
            INSERT OR IGNORE INTO orders (
              id, shop_id, order_no, terminal_id, cashier_id, cashier_name,
              subtotal, discount_type, discount_amount, tax_amount, total_amount,
              status, note, local_id, sync_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?);
          `,
            [
              ord.id,
              ord.shop_id || defaultShopId,
              ord.order_no,
              ord.terminal_id || 'T1',
              ord.cashier_id || null,
              ord.cashier_name || 'Cashier',
              Number(ord.subtotal) || 0,
              ord.discount_type || 'fixed',
              Number(ord.discount_amount) || 0,
              Number(ord.tax_amount) || 0,
              Number(ord.total_amount) || 0,
              ord.status || 'completed',
              ord.note || null,
              ord.local_id || ord.id,
              ord.created_at || new Date().toISOString()
            ]
          )
        }
      }

      const cloudItems = await axios.get(`${url}/rest/v1/order_items?select=*&limit=500`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        timeout: 6000
      })
      if (cloudItems.data && Array.isArray(cloudItems.data)) {
        for (const item of cloudItems.data) {
          db.run(
            `
            INSERT OR IGNORE INTO order_items (
              id, order_id, product_id, product_name, item_code,
              unit_price, cost_price, quantity, discount, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
            [
              item.id,
              item.order_id,
              item.product_id || null,
              item.product_name || 'Item',
              item.item_code || null,
              Number(item.unit_price) || 0,
              item.cost_price ? Number(item.cost_price) : null,
              Number(item.quantity) || 1,
              Number(item.discount) || 0,
              Number(item.subtotal) || 0
            ]
          )
        }
      }
    } catch (_) {}{}

    db.save()
    console.log(`[AutoSync] 📥 Synchronized catalog & inventory from Supabase Cloud: ${prodRes.data?.length || 0} products verified.`)
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
      // 1. DIRECT SYNC: Any pending or all categories in SQLite (Sync FIRST for FKs)
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
      // 2. DIRECT SYNC: Any pending products in SQLite
      // =========================================================================
      const pendingProducts = db.query<any>(
        `SELECT * FROM products WHERE sync_status = 'pending' OR sync_status IS NULL LIMIT 50;`
      )

      if (pendingProducts && pendingProducts.length > 0) {
        for (const p of pendingProducts) {
          try {
            const validId = toValidUuid(p.id)!
            const row: any = {
              id: validId,
              tenant_id: defaultTenantId,
              shop_id: defaultShopId,
              category_id: toValidUuid(p.category_id),
              item_code: p.item_code || p.barcode || ('ITM-' + Date.now().toString().slice(-6)),
              name: p.name,
              description: p.description || '',
              price: Number(p.price) || 0,
              cost_price: p.cost_price ? Number(p.cost_price) : null,
              barcode: p.barcode ? String(p.barcode).trim() : null,
              image_path: p.image_path || null,
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
                console.warn(`[AutoSync] Category FK mismatch for product "${row.name}". Retrying with null category...`)
                row.category_id = null
                try {
                  await postSupabase('products', [row])
                } catch (retryErr2: any) {
                  const retryMsg2 = retryErr2.message || ''
                  if (retryMsg2.includes('barcode')) {
                    row.barcode = null
                    await postSupabase('products', [row])
                  } else if (retryMsg2.includes('item_code') || retryMsg2.includes('23505')) {
                    row.item_code = `${row.item_code}-${Math.floor(100 + Math.random() * 900)}`
                    await postSupabase('products', [row])
                    db.run(`UPDATE products SET item_code = ? WHERE id = ?;`, [row.item_code, p.id])
                  } else {
                    throw retryErr2
                  }
                }
              } else if (errMsg.includes('barcode')) {
                console.warn(`[AutoSync] Barcode collision for product "${row.name}". Retrying without barcode...`)
                row.barcode = null
                try {
                  await postSupabase('products', [row])
                } catch (retryErr2: any) {
                  if (retryErr2.message?.includes('item_code') || retryErr2.message?.includes('23505')) {
                    row.item_code = `${row.item_code}-${Math.floor(100 + Math.random() * 900)}`
                    await postSupabase('products', [row])
                    db.run(`UPDATE products SET item_code = ? WHERE id = ?;`, [row.item_code, p.id])
                  } else {
                    throw retryErr2
                  }
                }
              } else if (errMsg.includes('item_code') || errMsg.includes('23505')) {
                console.warn(`[AutoSync] Item code collision for "${row.name}". Adjusting item code...`)
                row.item_code = `${row.item_code}-${Math.floor(100 + Math.random() * 900)}`
                await postSupabase('products', [row])
                db.run(`UPDATE products SET item_code = ? WHERE id = ?;`, [row.item_code, p.id])
              } else {
                throw postErr
              }
            }

            if (p.id !== validId) {
              db.run(`UPDATE products SET id = ?, sync_status = 'synced', updated_at = datetime('now') WHERE id = ?;`, [validId, p.id])
              db.run(`UPDATE inventory SET product_id = ? WHERE product_id = ?;`, [validId, p.id])
            } else {
              db.run(`UPDATE products SET sync_status = 'synced', updated_at = datetime('now') WHERE id = ?;`, [p.id])
            }
            totalSynced++
            console.log(`[AutoSync] ✅ Mirrored Product "${p.name}" (${row.item_code}) to Supabase Cloud.`)
          } catch (singleErr: any) {
            console.error(`[AutoSync] ❌ Could not mirror Product "${p.name}":`, singleErr.message)
          }
        }
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

            // 1. Post Order to Supabase Cloud with collision auto-resolution
            try {
              await postSupabase('orders', [orderRow])
            } catch (postErr: any) {
              const errMsg = postErr.message || ''
              if (errMsg.includes('orders_shop_id_order_no_key') || errMsg.includes('23505') || errMsg.includes('duplicate key')) {
                // Multi-device collision: another device already placed an order with this order_no.
                // Disambiguate with unique suffix so the order is safely preserved in Supabase!
                const disambiguatedOrderNo = `${orderRow.order_no}-${Math.floor(100 + Math.random() * 900)}`
                console.warn(`[AutoSync] Order number collision for "${orderRow.order_no}". Renaming to "${disambiguatedOrderNo}" and retrying...`)
                orderRow.order_no = disambiguatedOrderNo
                db.run(`UPDATE orders SET order_no = ? WHERE id = ?;`, [disambiguatedOrderNo, o.id])
                await postSupabase('orders', [orderRow])
              } else if (errMsg.includes('cashier') || errMsg.includes('23503') || errMsg.includes('foreign key')) {
                console.warn(`[AutoSync] Cashier FK mismatch for order "${orderRow.order_no}". Retrying with null cashier_id...`)
                orderRow.cashier_id = null
                await postSupabase('orders', [orderRow])
              } else {
                throw postErr
              }
            }

            // 2. Sync items for this order with product FK fallback
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

              try {
                await postSupabase('order_items', itemPayload)
              } catch (itemErr: any) {
                if (itemErr.message?.includes('23503') || itemErr.message?.includes('foreign key')) {
                  console.warn(`[AutoSync] Product FK notice in order_items. Retrying with null product_id...`)
                  const fallbackItems = itemPayload.map((it) => ({ ...it, product_id: null }))
                  await postSupabase('order_items', fallbackItems)
                } else {
                  console.warn('[AutoSync] Notice on order_items sync:', itemErr.message)
                }
              }
            }

            // 3. Sync payments for this order
            const payments = db.query<any>(`SELECT * FROM payments WHERE order_id = ?;`, [o.id])
            if (payments && payments.length > 0) {
              const payPayload = payments.map((p) => ({
                id: toValidUuid(p.id) || undefined,
                shop_id: defaultShopId,
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
              } catch (payErr: any) {
                console.warn('[AutoSync] Notice on payments sync:', payErr.message)
              }
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
      // 5. DIRECT SYNC: Inventory Stock Levels (Only for synced products to prevent FK violations)
      // =========================================================================
      const invRecords = db.query<any>(`
        SELECT i.* FROM inventory i
        INNER JOIN products p ON p.id = i.product_id
        WHERE p.sync_status = 'synced';
      `)
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
            await postSupabase('inventory?on_conflict=shop_id,product_id', invPayload)
          } catch (invErr: any) {
            console.warn('[AutoSync] Inventory sync notice:', invErr.message)
          }
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
