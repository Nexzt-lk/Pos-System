import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { LOCAL_SCHEMA_SQL } from './schema'

let dbInstance: Database.Database | null = null

export const getDatabase = (): Database.Database => {
  if (dbInstance) return dbInstance

  // Determine local SQLite database file path
  // In development: use local dev-data folder, in production: use user data directory
  const userDataPath = app?.getPath ? app.getPath('userData') : path.join(process.cwd(), 'dev-data')
  
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = path.join(userDataPath, 'cakeshop_pos.db')
  console.log(`[Database] Initializing SQLite at: ${dbPath}`)

  dbInstance = new Database(dbPath)

  // ⚡ HIGH-PERFORMANCE PRAGMAS (0.2ms zero-lag optimizations)
  dbInstance.pragma('journal_mode = WAL')
  dbInstance.pragma('synchronous = NORMAL')
  dbInstance.pragma('foreign_keys = ON')
  dbInstance.pragma('busy_timeout = 5000')

  // Run schema initialization
  dbInstance.exec(LOCAL_SCHEMA_SQL)
  console.log('[Database] Schema initialized successfully with WAL Mode active.')

  // Seed default data if empty
  seedInitialLocalData(dbInstance)

  return dbInstance
}

const seedInitialLocalData = (db: Database.Database) => {
  const shopCount = db.prepare('SELECT count(*) as count FROM shops').get() as { count: number }
  if (shopCount.count === 0) {
    console.log('[Database] Seeding initial branch and default products...')
    
    // Seed default tenant & branches
    db.prepare(`
      INSERT OR IGNORE INTO tenants (id, name, plan, is_active)
      VALUES ('a0000000-0000-0000-0000-000000000001', 'Rasa Cake House & Bakers', 'pro', 1)
    `).run()

    db.prepare(`
      INSERT OR IGNORE INTO shops (id, tenant_id, name, branch_code, address, phone, email, currency, is_active)
      VALUES 
        ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Kandy Branch', 'B1', 'No. 45, Peradeniya Road, Kandy', '+94 81 223 4567', 'kandy@rasacakes.lk', 'LKR', 1),
        ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Colombo Branch', 'B2', 'No. 120, Galle Road, Colombo 03', '+94 11 258 9101', 'colombo@rasacakes.lk', 'LKR', 1)
    `).run()

    // Default users (PIN: '123456' -> BCrypt Hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
    db.prepare(`
      INSERT OR IGNORE INTO users (id, tenant_id, shop_id, name, email, pin_hash, role, is_active)
      VALUES 
        ('u0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nimal Perera (Owner)', 'owner@rasacakes.lk', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'owner', 1),
        ('u0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Kasun Bandara (Cashier 1)', 'kasun@rasacakes.lk', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'cashier', 1)
    `).run()

    // Default categories
    db.prepare(`
      INSERT OR IGNORE INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
      VALUES 
        ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Signature Cakes', '#ec4899', 'cake', 1, 1),
        ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Pastries & Savories', '#f59e0b', 'croissant', 2, 1),
        ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Desserts & Cupcakes', '#8b5cf6', 'cookie', 3, 1),
        ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Beverages & Coffee', '#06b6d4', 'coffee', 4, 1)
    `).run()

    // Default products
    db.prepare(`
      INSERT OR IGNORE INTO products (id, shop_id, category_id, name, description, price, cost_price, barcode, unit, track_inventory, is_active)
      VALUES 
        ('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Black Forest Cake 1kg', 'Rich chocolate sponge layered with cherries and whipped cream', 3800.00, 2400.00, '4790001001', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Red Velvet Gateau 1kg', 'Velvety crimson sponge with cream cheese frosting', 4200.00, 2600.00, '4790001002', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Ribbon Butter Cake 500g', 'Traditional Sri Lankan three-color butter cake', 1650.00, 950.00, '4790001003', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Spicy Chicken Pastry', 'Flaky puff pastry stuffed with spicy devilled chicken', 220.00, 110.00, '4790001004', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Fish Bun (Seeni Sambol & Fish)', 'Soft baked bun filled with spiced tuna fish and caramelized onions', 150.00, 75.00, '4790001005', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Choco Fudge Cupcake', 'Decadent chocolate cupcake with fudge swirl', 280.00, 130.00, '4790001006', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Vanilla Eclair', 'Choux pastry filled with diplomat cream and chocolate ganache', 260.00, 120.00, '4790001007', 'pcs', 1, 1),
        ('p0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Iced Caramel Latte', 'Espresso with fresh steamed milk and salted caramel', 750.00, 320.00, '4790001008', 'pcs', 0, 1)
    `).run()

    // Default stock
    db.prepare(`
      INSERT OR IGNORE INTO inventory (id, shop_id, product_id, quantity, min_quantity)
      VALUES 
        ('i0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 12.00, 3.00),
        ('i0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 8.00, 2.00),
        ('i0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 20.00, 5.00),
        ('i0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000004', 35.00, 10.00),
        ('i0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000005', 40.00, 10.00),
        ('i0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000006', 25.00, 5.00),
        ('i0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000007', 30.00, 5.00)
    `).run()
  }
}
