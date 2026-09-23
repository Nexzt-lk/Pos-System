import { app } from 'electron'
import initSqlJs from 'sql.js'
import path from 'path'
import fs from 'fs'
import { LOCAL_SCHEMA_SQL } from './schema'

export interface POSDatabase {
  db: any
  dbPath: string
  save: () => void
  run: (sql: string, params?: any[]) => void
  exec: (sql: string) => void
  query: <T = any>(sql: string, params?: any[]) => T[]
  queryOne: <T = any>(sql: string, params?: any[]) => T | undefined
}

let dbInstance: POSDatabase | null = null

export const getDatabase = async (): Promise<POSDatabase> => {
  if (dbInstance) return dbInstance

  const SQL = await initSqlJs({
    locateFile: (file) => {
      const candidates = [
        path.join(process.resourcesPath || '', file),
        path.join(process.resourcesPath || '', 'sql-wasm.wasm'),
        path.join(__dirname, '../../node_modules/sql.js/dist', file),
        path.join(process.cwd(), 'node_modules/sql.js/dist', file)
      ]
      for (const p of candidates) {
        if (p && fs.existsSync(p)) return p
      }
      return file
    }
  })

  const isPackaged = app?.isPackaged ?? false
  const projectDbDir = isPackaged
    ? path.join(app.getPath('userData'), 'database')
    : fs.existsSync(path.resolve(__dirname, '../../../database'))
    ? path.resolve(__dirname, '../../../database')
    : fs.existsSync(path.resolve(process.cwd(), '../database'))
    ? path.resolve(process.cwd(), '../database')
    : path.resolve(process.cwd(), 'database')

  if (!fs.existsSync(projectDbDir)) {
    fs.mkdirSync(projectDbDir, { recursive: true })
  }

  const dbPath = path.join(projectDbDir, 'cakeshop_local.db')
  console.log(`[Database] Initializing SQLite database (packaged=${isPackaged}) at: ${dbPath}`)

  // DB version — bump this whenever seed data changes significantly
  const MASTER_DB_VERSION = 4 // v4: Updated shop address & phone number

  // Helper: read product count from a DB buffer
  const getProductCount = (buf: Buffer): number => {
    try {
      const tmpDb = new SQL.Database(buf)
      const res = tmpDb.exec('SELECT COUNT(*) FROM products')
      const count = (res?.[0]?.values?.[0]?.[0] as number) || 0
      tmpDb.close()
      return count
    } catch { return 0 }
  }

  // Helper: read db_version from settings table if it exists
  const getDbVersion = (buf: Buffer): number => {
    try {
      const tmpDb = new SQL.Database(buf)
      const res = tmpDb.exec("SELECT value FROM settings WHERE key='db_version'")
      const val = res?.[0]?.values?.[0]?.[0]
      tmpDb.close()
      return val ? parseInt(String(val), 10) : 0
    } catch { return 0 }
  }

  // Search candidate paths for the master bundled template
  const candidateBundledPaths = [
    path.join(process.resourcesPath || '', 'database', 'cakeshop_local.db'),
    path.join(process.resourcesPath || '', 'cakeshop_local.db'),
    path.join(path.dirname(process.execPath || ''), 'resources', 'database', 'cakeshop_local.db'),
    path.join(path.dirname(process.execPath || ''), 'resources', 'cakeshop_local.db'),
    path.join(path.dirname(process.execPath || ''), 'database', 'cakeshop_local.db'),
    path.join(app?.getAppPath ? app.getAppPath() : '', 'resources', 'database', 'cakeshop_local.db'),
    path.join(app?.getAppPath ? app.getAppPath() : '', 'database', 'cakeshop_local.db'),
    path.resolve(__dirname, '../../../database/cakeshop_local.db'),
    path.resolve(process.cwd(), '../database/cakeshop_local.db'),
    path.resolve(process.cwd(), 'database/cakeshop_local.db')
  ]

  let masterTemplatePath: string | null = null
  for (const cp of candidateBundledPaths) {
    try {
      if (cp && fs.existsSync(cp)) {
        const stats = fs.statSync(cp)
        if (stats.size > 50000 && path.resolve(cp) !== path.resolve(dbPath)) {
          masterTemplatePath = cp
          console.log(`[Database] Found master template database (${stats.size} bytes) at: ${cp}`)
          break
        }
      }
    } catch (_) {}
  }

  // Check if destination db needs deployment or replacement (version-based)
  let needsMasterSeed = false
  if (!fs.existsSync(dbPath)) {
    console.log('[Database] No existing DB found. Will deploy master template.')
    needsMasterSeed = true
  } else {
    try {
      const existingBuf = fs.readFileSync(dbPath)
      const existingProductCount = getProductCount(existingBuf)
      const existingVersion = getDbVersion(existingBuf)

      console.log(`[Database] Existing DB: ${existingProductCount} products, version=${existingVersion}`)

      if (existingProductCount < 18) {
        console.warn(`[Database] Existing DB has ${existingProductCount} products (< 18). Force replacing from master template.`)
        needsMasterSeed = true
      } else if (existingVersion < MASTER_DB_VERSION) {
        console.warn(`[Database] DB version (${existingVersion}) < master (${MASTER_DB_VERSION}). Replacing with updated DB...`)
        needsMasterSeed = true
      }
    } catch (_) {
      needsMasterSeed = true
    }
  }

  if (needsMasterSeed && masterTemplatePath) {
    try {
      fs.copyFileSync(masterTemplatePath, dbPath)
      console.log(`[Database] Successfully copied master template (${fs.statSync(dbPath).size} bytes) to ${dbPath}`)
    } catch (copyErr) {
      console.error('[Database] Failed to copy master template:', copyErr)
    }
  }

  let rawDb: any
  let lastMtime = 0

  const openDbFromDisk = (): boolean => {
    try {
      if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
        const filebuffer = fs.readFileSync(dbPath)
        rawDb = new SQL.Database(filebuffer)
        lastMtime = fs.statSync(dbPath).mtimeMs

        // Validate table content
        const check = rawDb.exec("SELECT count(*) as cnt FROM products")
        const count = check?.[0]?.values?.[0]?.[0] || 0
        if (count > 0) {
          console.log(`[Database] Database verified with ${count} active products.`)
          return true
        } else {
          console.warn('[Database] Database file has 0 products.')
          return false
        }
      }
    } catch (e) {
      console.warn('[Database] Failed opening database from disk:', e)
    }
    return false
  }

  const isHealthy = openDbFromDisk()

  if (!isHealthy) {
    console.log('[Database] Database missing or empty. Force-restoring from master template or seeding...')
    if (masterTemplatePath && fs.existsSync(masterTemplatePath)) {
      try {
        fs.copyFileSync(masterTemplatePath, dbPath)
        const filebuffer = fs.readFileSync(dbPath)
        rawDb = new SQL.Database(filebuffer)
        lastMtime = fs.statSync(dbPath).mtimeMs
        console.log(`[Database] Master database restored from ${masterTemplatePath}`)
      } catch (err) {
        console.warn('[Database] Restoring from master template failed, falling back to script seeding:', err)
        rawDb = new SQL.Database()
        rawDb.run(LOCAL_SCHEMA_SQL)
        seedInitialLocalData(rawDb)
        const data = rawDb.export()
        fs.writeFileSync(dbPath, Buffer.from(data))
        lastMtime = fs.statSync(dbPath).mtimeMs
      }
    } else {
      rawDb = new SQL.Database()
      rawDb.run(LOCAL_SCHEMA_SQL)
      seedInitialLocalData(rawDb)
      const data = rawDb.export()
      fs.writeFileSync(dbPath, Buffer.from(data))
      lastMtime = fs.statSync(dbPath).mtimeMs
    }
  }

  // Ensure shop address and phone are always updated to official details
  try {
    rawDb.run(`
      UPDATE shops 
      SET address = 'Horana Wasana Bakers Galagedara Road Katugastota',
          phone = '071-1172201'
      WHERE id = 'b0000000-0000-0000-0000-000000000001';
    `)
    const data = rawDb.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
    lastMtime = fs.statSync(dbPath).mtimeMs
  } catch (shopErr) {
    console.warn('[Database] Notice on shop details update:', shopErr)
  }

  const reloadFromDiskIfNeeded = () => {
    try {
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath)
        if (stats.mtimeMs > lastMtime) {
          const filebuffer = fs.readFileSync(dbPath)
          rawDb = new SQL.Database(filebuffer)
          lastMtime = stats.mtimeMs
        }
      }
    } catch (e) {
      console.warn('[Database] Failed to reload DB from disk:', e)
    }
  }

  const saveToDisk = () => {
    const data = rawDb.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
    try {
      lastMtime = fs.statSync(dbPath).mtimeMs
    } catch {}
  }

  dbInstance = {
    db: rawDb,
    dbPath,
    save: saveToDisk,
    run: (sql: string, params: any[] = []) => {
      reloadFromDiskIfNeeded()
      rawDb.run(sql, params)
      saveToDisk()
    },
    exec: (sql: string) => {
      reloadFromDiskIfNeeded()
      rawDb.exec(sql)
      saveToDisk()
    },
    query: <T = any>(sql: string, params: any[] = []): T[] => {
      reloadFromDiskIfNeeded()
      const stmt = rawDb.prepare(sql)
      stmt.bind(params)
      const results: T[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T)
      }
      stmt.free()
      return results
    },
    queryOne: <T = any>(sql: string, params: any[] = []): T | undefined => {
      reloadFromDiskIfNeeded()
      const stmt = rawDb.prepare(sql)
      stmt.bind(params)
      let result: T | undefined = undefined
      if (stmt.step()) {
        result = stmt.getAsObject() as T
      }
      stmt.free()
      return result
    }
  }

  return dbInstance
}

export const seedInitialLocalData = (db: any) => {
  console.log('[Database] Seeding complete default branch, categories, products and operators...')

  // 1. Seed Shop
  db.run(`
    INSERT OR REPLACE INTO shops (id, name, branch_code, address, phone, email, currency, receipt_footer)
    VALUES (
      'b0000000-0000-0000-0000-000000000001',
      'Wasana Cake - Katugastota',
      'B1',
      'Horana Wasana Bakers Galagedara Road Katugastota',
      '071-1172201',
      'wasana@cakes.lk',
      'LKR',
      'Thank you for visiting Wasana Cake - Katugastota! 🎂'
    );
  `)

  // 2. Seed Default Operators (PIN: 123456)
  db.run(`
    INSERT OR REPLACE INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active)
    VALUES 
      ('u0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Janaka Ariyarathna (Owner)', 'owner@wasanabakes.lk', '843522', 'JanakaW@2024!', 'owner', 1),
      ('u0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Sunil Jayasinghe (Manager)', 'manager@wasanabakes.lk', '843522', 'manager123', 'manager', 1),
      ('u0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Cashier 01', 'cashier1@wasanabakes.lk', '843522', 'WB_Cash1#2024', 'cashier', 1),
      ('u0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Cashier 02', 'cashier2@wasanabakes.lk', '843522', 'WB_Cash2#2024', 'cashier', 1);
  `)

  // 3. Seed 8 Main Categories
  db.run(`
    INSERT OR REPLACE INTO categories (id, name, code_prefix, color, icon, sort_order, is_active)
    VALUES 
      ('10eb67e2-985f-4ed6-9339-4504e9ada336', 'Cakes & Gateaux', 'CAK', '#ec4899', 'cake', 1, 1),
      ('50990b73-4919-460f-85f1-848b8f0838f7', 'Sweet Items & Desserts', 'SWT', '#a855f7', 'cookie', 2, 1),
      ('48685b8b-b44d-4caa-b9c1-490155e87ea3', 'Biscuits & Cookies', 'BIS', '#f59e0b', 'cookie', 3, 1),
      ('0e801936-12bf-4872-a59d-e3ae989c2ce0', 'Birthday Deco & Party Items', 'BDY', '#3b82f6', 'party-popper', 4, 1),
      ('56187eec-97ca-41b4-9d11-171e664a79af', 'Ice Cream & Frozen Treats', 'ICE', '#06b6d4', 'ice-cream', 5, 1),
      ('6b9be91b-1297-425c-9395-27cf952c8358', 'Pastries & Savories', 'PAS', '#e11d48', 'croissant', 6, 1),
      ('c40fc4e3-9a5b-477b-aa4d-b256f0a74267', 'Breads & Buns', 'BRD', '#d97706', 'package', 7, 1),
      ('536a3768-5597-4c7c-ad09-c877796aff54', 'Beverages & Coffee', 'BEV', '#10b981', 'coffee', 8, 1);
  `)

  // 4. Seed Products (Ritzbury) & Inventory
  db.run(`
    INSERT OR REPLACE INTO products (id, category_id, item_code, name, description, price, cost_price, barcode, unit, track_inventory, is_active, sync_status)
    VALUES
      ('e21d1c04-aafd-4f21-8913-1a01662dff22', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-001', 'Choco-La Kiddies Milk 20g', 'Ritzbury Choco-La Kiddies Milk 20g', 50.00, 0, 'SWT-001', 'pcs', 1, 1, 'synced'),
      ('d56678ff-22b0-48c9-921f-949fea55b7b0', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-002', 'Choco-La Milk Sweet 20g', 'Ritzbury Choco-La Milk Sweet 20g', 50.00, 0, 'SWT-002', 'pcs', 1, 1, 'synced'),
      ('2f4e7115-75b5-4d93-85e5-c7fab78e7b31', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-003', 'Choco-La Milk 45g', 'Ritzbury Choco-La Milk 45g', 100.00, 0, 'SWT-003', 'pcs', 1, 1, 'synced'),
      ('36fa3d50-2557-4a5b-9a64-66327817545c', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-004', 'Choco-La Peanut 45g', 'Ritzbury Choco-La Peanut 45g', 120.00, 0, 'SWT-004', 'pcs', 1, 1, 'synced'),
      ('94d1daa7-54a5-47dc-9193-300a7343ef46', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-005', 'Choco-La Milk 90g', 'Ritzbury Choco-La Milk 90g', 200.00, 0, 'SWT-005', 'pcs', 1, 1, 'synced'),
      ('1da3b3c5-3358-485e-a366-8e3409364358', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-006', 'Roccoa Milk IBB 25g', 'Ritzbury Roccoa Milk IBB 25g', 170.00, 0, 'SWT-006', 'pcs', 1, 1, 'synced'),
      ('b6ac1022-21bb-443e-9d5d-5fbaa74a252b', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-007', 'Roccoa Milk IBB 45g', 'Ritzbury Roccoa Milk IBB 45g', 280.00, 0, 'SWT-007', 'pcs', 1, 1, 'synced'),
      ('6ce55cf9-77db-4d51-9191-b854a79ccf3f', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-008', 'Roccoa Milk IBB 90g', 'Ritzbury Roccoa Milk IBB 90g', 570.00, 0, 'SWT-008', 'pcs', 1, 1, 'synced'),
      ('02578d5b-3cc9-4f43-8ccb-c634d3f39ad2', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-009', 'Ritzbury Milk 45g', 'Ritzbury Ritzbury Milk 45g', 140.00, 0, 'SWT-009', 'pcs', 1, 1, 'synced'),
      ('778f1a0a-da41-4aec-b6ef-c4e81745c356', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-010', 'Ritzbury Milk Sweet 93g', 'Ritzbury Ritzbury Milk Sweet 93g', 230.00, 0, 'SWT-010', 'pcs', 1, 1, 'synced'),
      ('3382985e-25a2-4dd4-9476-b31c5505d3f3', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-011', 'Ritzbury Cashew 93g', 'Ritzbury Ritzbury Cashew 93g', 380.00, 0, 'SWT-011', 'pcs', 1, 1, 'synced'),
      ('f93696b5-e2cf-40f2-aba9-41e1afb606e9', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-012', 'Ritzbury Milk 170g', 'Ritzbury Ritzbury Milk 170g', 530.00, 0, 'SWT-012', 'pcs', 1, 1, 'synced'),
      ('94618602-0332-4c5e-a72f-f27e23c4bed7', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-013', 'Bubbles 30g', 'Ritzbury Bubbles 30g', 100.00, 0, 'SWT-013', 'pcs', 1, 1, 'synced'),
      ('5f0622ba-a560-47b6-82f3-775eca57cdf3', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-014', 'Bubbles 100g', 'Ritzbury Bubbles 100g', 250.00, 0, 'SWT-014', 'pcs', 1, 1, 'synced'),
      ('776aedc9-6766-437a-974f-7b0f5658f8ba', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-015', 'Bubbles 170g', 'Ritzbury Bubbles 170g', 450.00, 0, 'SWT-015', 'pcs', 1, 1, 'synced'),
      ('163de812-8386-4eff-8bf8-f859846e59a4', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-016', 'Revello Milk 50g', 'Ritzbury Revello Milk 50g', 350.00, 0, 'SWT-016', 'pcs', 1, 1, 'synced'),
      ('64f3ae02-f174-41b4-b40a-50c8de4ac6eb', '48685b8b-b44d-4caa-b9c1-490155e87ea3', 'BIS-001', 'Chocolate Fingers 18g', 'Ritzbury Chocolate Fingers 18g', 40.00, 0, 'BIS-001', 'pcs', 1, 1, 'synced'),
      ('343a4b16-bfb2-44f0-ac4c-b2ab1ea5d4b4', '48685b8b-b44d-4caa-b9c1-490155e87ea3', 'BIS-002', 'Chocolate Fingers 40g', 'Ritzbury Chocolate Fingers 40g', 100.00, 0, 'BIS-002', 'pcs', 1, 1, 'synced');
  `)

  db.run(`
    INSERT OR REPLACE INTO inventory (id, product_id, quantity, min_quantity, updated_at)
    VALUES
      ('6afd7a0e-fa59-4dbb-809c-ab07ae70b1be', 'e21d1c04-aafd-4f21-8913-1a01662dff22', 50, 5, datetime('now')),
      ('be3928d9-39ad-424a-b1c3-8fce54e1a65e', 'd56678ff-22b0-48c9-921f-949fea55b7b0', 50, 5, datetime('now')),
      ('34840227-9dd4-4e88-a3d0-f56dc5cdc718', '2f4e7115-75b5-4d93-85e5-c7fab78e7b31', 50, 5, datetime('now')),
      ('ca0d438c-ac8d-4067-b3ec-7223a16825b5', '36fa3d50-2557-4a5b-9a64-66327817545c', 50, 5, datetime('now')),
      ('a896837d-9d74-407f-99ad-11c1ecd1c27e', '94d1daa7-54a5-47dc-9193-300a7343ef46', 50, 5, datetime('now')),
      ('d96ca519-2962-4af2-9961-5647dcd8d012', '1da3b3c5-3358-485e-a366-8e3409364358', 50, 5, datetime('now')),
      ('b444aaf0-fd78-4f6b-86f5-1799b7b7adb0', 'b6ac1022-21bb-443e-9d5d-5fbaa74a252b', 50, 5, datetime('now')),
      ('ffe5af74-32e4-4469-87c8-7916adf68c57', '6ce55cf9-77db-4d51-9191-b854a79ccf3f', 50, 5, datetime('now')),
      ('24dbbfc3-84e2-4a6e-a196-d93ee0764a02', '02578d5b-3cc9-4f43-8ccb-c634d3f39ad2', 50, 5, datetime('now')),
      ('5db79c47-bfcb-40e7-a823-866534892729', '778f1a0a-da41-4aec-b6ef-c4e81745c356', 50, 5, datetime('now')),
      ('fb7fecb0-1957-4f7a-bdc0-ef9d4c567171', '3382985e-25a2-4dd4-9476-b31c5505d3f3', 50, 5, datetime('now')),
      ('cd6e8731-8bae-432b-aba2-8dab7fca88df', 'f93696b5-e2cf-40f2-aba9-41e1afb606e9', 50, 5, datetime('now')),
      ('8099bc9a-fb29-41d1-b08b-b270f071fd7a', '94618602-0332-4c5e-a72f-f27e23c4bed7', 50, 5, datetime('now')),
      ('49fd5159-ca4b-4380-bac4-1410af4d3cd7', '5f0622ba-a560-47b6-82f3-775eca57cdf3', 50, 5, datetime('now')),
      ('4dab1960-4596-4a6c-979a-1b96f061f66b', '776aedc9-6766-437a-974f-7b0f5658f8ba', 50, 5, datetime('now')),
      ('adaf0eea-13e3-4596-b025-236580890e5f', '163de812-8386-4eff-8bf8-f859846e59a4', 50, 5, datetime('now')),
      ('2ee8a2bd-e3fe-456e-9687-1612b051f636', '64f3ae02-f174-41b4-b40a-50c8de4ac6eb', 50, 5, datetime('now')),
      ('b3a18b55-f93a-417f-a396-141569029047', '343a4b16-bfb2-44f0-ac4c-b2ab1ea5d4b4', 50, 5, datetime('now'));
  `)

  // 5. Seed App Settings (db_version)
  db.run(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES ('db_version', '3');
  `)
}
