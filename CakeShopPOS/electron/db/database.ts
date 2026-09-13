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
        if (stats.size > 50000 && cp !== dbPath) {
          masterTemplatePath = cp
          console.log(`[Database] Found master template database (${stats.size} bytes) at: ${cp}`)
          break
        }
      }
    } catch (_) {}
  }

  // Check if destination db needs deployment or replacement
  let needsMasterSeed = false
  if (!fs.existsSync(dbPath)) {
    needsMasterSeed = true
  } else {
    try {
      const stats = fs.statSync(dbPath)
      if (stats.size < 50000) {
        console.warn(`[Database] Existing database is too small (${stats.size} bytes). Resetting from master template...`)
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
      'Katugastota, Kandy',
      '+94 81 223 4567',
      'wasana@cakes.lk',
      'LKR',
      'Thank you for visiting Wasana Cake - Katugastota! 🎂'
    );
  `)

  // 2. Seed Default Operators (PIN: 123456)
  db.run(`
    INSERT OR REPLACE INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active)
    VALUES 
      ('u0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nimal Perera (Owner)', 'owner@rasacakes.lk', '123456', 'owner123', 'owner', 1),
      ('u0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Sunil Jayasinghe (Manager)', 'manager@rasacakes.lk', '123456', 'manager123', 'manager', 1),
      ('u0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Kasun Bandara (Cashier 1)', 'cashier1@rasacakes.lk', '123456', 'cashier123', 'cashier', 1),
      ('u0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Dilani Silva (Cashier 2)', 'cashier2@rasacakes.lk', '123456', 'cashier123', 'cashier', 1);
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

  // 4. Seed Products
  db.run(`
    INSERT OR REPLACE INTO products (id, category_id, item_code, name, description, price, cost_price, barcode, image_path, unit, track_inventory, is_active, sync_status)
    VALUES 
      ('4e89a724-6f34-489c-964b-0d3544fbaa7c', '10eb67e2-985f-4ed6-9339-4504e9ada336', 'CAK-001', 'Chocolate Fudge Cake 1kg', 'Decadent chocolate sponge layered with ganache', 3800.00, 2400.00, '4790001001', 'products/chocolate_cake.jpg', 'pcs', 1, 1, 'synced'),
      ('79ce1b98-75ee-4b42-8760-6aed0be7b6dd', '10eb67e2-985f-4ed6-9339-4504e9ada336', 'CAK-002', 'Black Forest Gateau 1kg', 'Layered sponge with cherries and whipped cream', 4200.00, 2600.00, '4790001002', 'products/black_forest.jpg', 'pcs', 1, 1, 'synced'),
      ('b73855d3-0036-4ee4-b572-47aa9b5287bf', '10eb67e2-985f-4ed6-9339-4504e9ada336', 'CAK-003', 'Red Velvet Gateau', 'Classic red velvet sponge with cream cheese frosting', 4500.00, 2800.00, '4790001003', 'products/red_velvet.jpg', 'pcs', 1, 1, 'synced'),
      ('7fca8a47-10a2-4faf-8afa-32f6a9df0b2a', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-001', 'Choco Fudge Cupcake', 'Rich chocolate cupcake topped with swirl frosting', 300.00, 150.00, 'DS-001', 'products/choco_fudge_cupcake.jpg', 'pcs', 1, 1, 'synced'),
      ('2ca83b5e-4f82-48a3-a26c-98272a3d5f74', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-002', 'Strawberry Cheesecake Slice', 'Creamy New York cheesecake with strawberry glaze', 1050.00, 600.00, 'SWT-002', 'products/strawberry_cheesecake.jpg', 'pcs', 1, 1, 'synced'),
      ('f87603f1-3488-4824-8128-960eba992810', '6b9be91b-1297-425c-9395-27cf952c8358', 'PAS-001', 'Spicy Chicken Pastry', 'Flaky pastry stuffed with devilled chicken', 200.00, 100.00, 'PAS-001', 'products/spicy_chicken.jpg', 'pcs', 1, 1, 'synced'),
      ('79d47822-fe9a-459b-b45d-37be8f4e585e', '6b9be91b-1297-425c-9395-27cf952c8358', 'PAS-002', 'Savoury Puff Pastry Trio', 'Crisp puff pastry baked to golden perfection', 900.00, 450.00, 'PAS-002', 'products/savoury_pastries.jpg', 'pcs', 1, 1, 'synced'),
      ('4b90d909-c839-4689-af7f-df5e317c3551', '48685b8b-b44d-4caa-b9c1-490155e87ea3', 'BIS-001', 'Butter Cookies Assortment', 'Freshly baked artisanal butter cookies', 890.00, 480.00, 'BIS-001', 'products/cookies_biscuits.jpg', 'pcs', 1, 1, 'synced'),
      ('p0000000-0000-0000-0000-000000000009', '48685b8b-b44d-4caa-b9c1-490155e87ea3', 'CK-009', 'Chocolate Chip Cookies (Pack)', 'Crispy choco chip baked cookies', 450.00, 240.00, 'CK-009', 'products/cookies_biscuits.jpg', 'pcs', 1, 1, 'synced'),
      ('df15e093-a20a-4518-83f0-6271411bea2a', '0e801936-12bf-4872-a59d-e3ae989c2ce0', 'BDY-001', 'Birthday Candle & Topper Set', 'Celebration cake topper set with candles', 90.00, 40.00, 'BDY-001', 'products/party_deco.jpg', 'pcs', 1, 1, 'synced'),
      ('d9611f00-bcad-40d0-be4e-a2b5be850226', '0e801936-12bf-4872-a59d-e3ae989c2ce0', 'BDY-002', 'Party Balloons & Ribbon Pack', 'Metallic birthday party celebration set', 80.00, 35.00, 'BDY-002', 'products/party_deco.jpg', 'pcs', 1, 1, 'synced'),
      ('p0000000-0000-0000-0000-000000000011', '56187eec-97ca-41b4-9d11-171e664a79af', 'IC-011', 'Ice Cream Sundae Cup', 'Rich creamy ice cream cup', 380.00, 190.00, 'IC-011', 'products/ice_cream.jpg', 'pcs', 1, 1, 'synced'),
      ('p0000000-0000-0000-0000-000000000012', 'c40fc4e3-9a5b-477b-aa4d-b256f0a74267', 'BR-012', 'Bakery White Bread Loaf', 'Soft freshly baked sandwich bread', 180.00, 95.00, 'BR-012', 'products/fish_bun.jpg', 'pcs', 1, 1, 'synced'),
      ('55555555-5555-5555-5555-555555555555', '10eb67e2-985f-4ed6-9339-4504e9ada336', 'CAK-004', 'Ribbon Butter Cake 500g', 'Traditional Sri Lankan three-color butter cake', 1850.00, 1100.00, 'CAK-004', 'products/ribbon_butter.jpg', 'pcs', 1, 1, 'synced'),
      ('p0000000-0000-0000-0000-000000000008', '536a3768-5597-4c7c-ad09-c877796aff54', 'BEV-001', 'Iced Caramel Latte', 'Espresso with fresh chilled milk and salted caramel', 750.00, 320.00, 'BEV-001', 'products/iced_caramel_latte.jpg', 'pcs', 0, 1, 'synced');
  `)

  // 5. Seed Inventory
  db.run(`
    INSERT OR REPLACE INTO inventory (id, product_id, quantity, min_quantity)
    SELECT 'inv-' || id, id, 25.0, 5.0 FROM products;
  `)
}
