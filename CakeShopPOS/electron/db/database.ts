import initSqlJs from 'sql.js'
import path from 'path'
import { app } from 'electron'
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

  const SQL = await initSqlJs()
  
  // Save DB directly in the project's database directory: s:\WEDDING\database\cakeshop_pos.db
  const projectDbDir = fs.existsSync(path.resolve(__dirname, '../../../database'))
    ? path.resolve(__dirname, '../../../database')
    : fs.existsSync(path.resolve(process.cwd(), '../database'))
    ? path.resolve(process.cwd(), '../database')
    : path.resolve(process.cwd(), 'database')

  if (!fs.existsSync(projectDbDir)) {
    fs.mkdirSync(projectDbDir, { recursive: true })
  }

  const dbPath = path.join(projectDbDir, 'cakeshop_pos.db')
  console.log(`[Database] Initializing Project SQLite (WASM) at: ${dbPath}`)

  let rawDb: any
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath)
    rawDb = new SQL.Database(filebuffer)
  } else {
    rawDb = new SQL.Database()
    rawDb.run(LOCAL_SCHEMA_SQL)
    seedInitialLocalData(rawDb)
    const data = rawDb.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }

  const saveToDisk = () => {
    const data = rawDb.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }

  dbInstance = {
    db: rawDb,
    dbPath,
    save: saveToDisk,
    run: (sql: string, params: any[] = []) => {
      rawDb.run(sql, params)
      saveToDisk()
    },
    exec: (sql: string) => {
      rawDb.exec(sql)
      saveToDisk()
    },
    query: <T = any>(sql: string, params: any[] = []): T[] => {
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

const seedInitialLocalData = (db: any) => {
  console.log('[Database] Seeding initial branch and default products...')

  // Seed default tenant & branches
  db.run(`
    INSERT OR IGNORE INTO tenants (id, name, plan, is_active)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Rasa Cake House & Bakers', 'pro', 1);
  `)

  db.run(`
    INSERT OR IGNORE INTO shops (id, tenant_id, name, branch_code, address, phone, email, currency, is_active)
    VALUES 
      ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Kandy Branch', 'B1', 'No. 45, Peradeniya Road, Kandy', '+94 81 223 4567', 'kandy@rasacakes.lk', 'LKR', 1),
      ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Colombo Branch', 'B2', 'No. 120, Galle Road, Colombo 03', '+94 11 258 9101', 'colombo@rasacakes.lk', 'LKR', 1);
  `)

  // Default users with roles (Owner, Manager, Cashier 1, Cashier 2)
  // Owner:    owner@rasacakes.lk    / Pass: owner123    / PIN: 123456
  // Manager:  manager@rasacakes.lk  / Pass: manager123  / PIN: 123456
  // Cashier:  cashier1@rasacakes.lk / Pass: cashier123  / PIN: 123456
  // Cashier:  cashier2@rasacakes.lk / Pass: cashier123  / PIN: 123456
  db.run(`
    INSERT OR IGNORE INTO users (id, tenant_id, shop_id, name, email, password_hash, pin_hash, role, is_active)
    VALUES 
      ('u0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nimal Perera (Owner)', 'owner@rasacakes.lk', '$2a$10$k5tEuZdIfab3xJDAXRI.O.IGtAEfdHbOEeTjYCQNLiQm61oC9oNJO', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'owner', 1),
      ('u0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Sunil Jayasinghe (Manager)', 'manager@rasacakes.lk', '$2a$10$kOeKecAZGpT2XZ2A4zGxBuoDNFfIoa6ScQzBTRq5zTrpGjpyu66CO', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'manager', 1),
      ('u0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Kasun Bandara (Cashier 1)', 'cashier1@rasacakes.lk', '$2a$10$yRmuA99RFei8tgcImTfkTORBn/4JynMUJWdkFi3nz6rn76o8gl3Ge', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'cashier', 1),
      ('u0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dilani Silva (Cashier 2)', 'cashier2@rasacakes.lk', '$2a$10$yRmuA99RFei8tgcImTfkTORBn/4JynMUJWdkFi3nz6rn76o8gl3Ge', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'cashier', 1);
  `)

  // Default categories
  db.run(`
    INSERT OR IGNORE INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
    VALUES 
      ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Signature Cakes', '#ec4899', 'cake', 1, 1),
      ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Pastries & Savories', '#f59e0b', 'croissant', 2, 1),
      ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Desserts & Cupcakes', '#8b5cf6', 'cookie', 3, 1),
      ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Beverages & Coffee', '#06b6d4', 'coffee', 4, 1);
  `)

  // Default products
  db.run(`
    INSERT OR IGNORE INTO products (id, shop_id, category_id, name, description, price, cost_price, barcode, unit, track_inventory, is_active)
    VALUES 
      ('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Black Forest Cake 1kg', 'Rich chocolate sponge layered with cherries and whipped cream', 3800.00, 2400.00, '4790001001', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Red Velvet Gateau 1kg', 'Velvety crimson sponge with cream cheese frosting', 4200.00, 2600.00, '4790001002', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Ribbon Butter Cake 500g', 'Traditional Sri Lankan three-color butter cake', 1650.00, 950.00, '4790001003', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Spicy Chicken Pastry', 'Flaky puff pastry stuffed with spicy devilled chicken', 220.00, 110.00, '4790001004', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Fish Bun (Seeni Sambol & Fish)', 'Soft baked bun filled with spiced tuna fish and caramelized onions', 150.00, 75.00, '4790001005', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Choco Fudge Cupcake', 'Decadent chocolate cupcake with fudge swirl', 280.00, 130.00, '4790001006', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Vanilla Eclair', 'Choux pastry filled with diplomat cream and chocolate ganache', 260.00, 120.00, '4790001007', 'pcs', 1, 1),
      ('p0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Iced Caramel Latte', 'Espresso with fresh steamed milk and salted caramel', 750.00, 320.00, '4790001008', 'pcs', 0, 1);
  `)

  // Default stock
  db.run(`
    INSERT OR IGNORE INTO inventory (id, shop_id, product_id, quantity, min_quantity)
    VALUES 
      ('i0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 12.00, 3.00),
      ('i0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 8.00, 2.00),
      ('i0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 20.00, 5.00),
      ('i0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000004', 35.00, 10.00),
      ('i0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000005', 40.00, 10.00),
      ('i0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000006', 25.00, 5.00),
      ('i0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000007', 30.00, 5.00);
  `)
}
