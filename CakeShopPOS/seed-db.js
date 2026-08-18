const fs = require('fs');
const path = require('path');
const initSqlJs = require('./node_modules/sql.js');

const dbDir = path.resolve(__dirname, '../database');
const dbPath = path.join(dbDir, 'cakeshop_pos.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

initSqlJs().then((SQL) => {
  const db = new SQL.Database();

  const schema = `
    CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT DEFAULT 'basic',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        branch_code TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        email TEXT,
        logo_url TEXT,
        currency TEXT DEFAULT 'LKR',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(tenant_id, branch_code)
    );

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT,
        pin_hash TEXT,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(tenant_id, email)
    );

    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT 'cake',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        category_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        cost_price REAL DEFAULT 0,
        barcode TEXT,
        unit TEXT DEFAULT 'pcs',
        image_path TEXT,
        track_inventory INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        min_quantity REAL DEFAULT 5,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(shop_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'SALE', 'ADJUST', 'RETURN', 'DAMAGE')),
        quantity REAL NOT NULL,
        quantity_before REAL NOT NULL,
        quantity_after REAL NOT NULL,
        reference_id TEXT,
        note TEXT,
        cost_per_unit REAL,
        done_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        local_id TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
        UNIQUE(shop_id, local_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        order_no TEXT NOT NULL,
        cashier_id TEXT,
        subtotal REAL NOT NULL,
        discount_type TEXT CHECK (discount_type IN ('percent', 'fixed')),
        discount_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'voided')),
        note TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        time_drift_flag INTEGER DEFAULT 0,
        local_id TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
        synced_at TEXT,
        UNIQUE(shop_id, local_id),
        UNIQUE(shop_id, order_no)
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        cost_price REAL DEFAULT 0,
        quantity REAL NOT NULL,
        discount REAL DEFAULT 0,
        subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        method TEXT NOT NULL CHECK (method IN ('CASH', 'CARD', 'TRANSFER', 'MIXED')),
        amount REAL NOT NULL,
        cash_given REAL,
        change_given REAL,
        reference_no TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        category TEXT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT DEFAULT (date('now')),
        added_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        synced_at TEXT
    );
  `;

  db.run(schema);

  // Seed Tenants & Shops
  db.run(`
    INSERT OR IGNORE INTO tenants (id, name, plan, is_active)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Rasa Cake House & Bakers', 'pro', 1);

    INSERT OR IGNORE INTO shops (id, tenant_id, name, branch_code, address, phone, email, currency, is_active)
    VALUES 
      ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Kandy Branch', 'B1', 'No. 45, Peradeniya Road, Kandy', '+94 81 223 4567', 'kandy@rasacakes.lk', 'LKR', 1),
      ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Colombo Branch', 'B2', 'No. 120, Galle Road, Colombo 03', '+94 11 258 9101', 'colombo@rasacakes.lk', 'LKR', 1);

    INSERT OR IGNORE INTO users (id, tenant_id, shop_id, name, email, password_hash, pin_hash, role, is_active)
    VALUES 
      ('u0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nimal Perera (Owner)', 'owner@rasacakes.lk', '$2a$10$k5tEuZdIfab3xJDAXRI.O.IGtAEfdHbOEeTjYCQNLiQm61oC9oNJO', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'owner', 1),
      ('u0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Sunil Jayasinghe (Manager)', 'manager@rasacakes.lk', '$2a$10$kOeKecAZGpT2XZ2A4zGxBuoDNFfIoa6ScQzBTRq5zTrpGjpyu66CO', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'manager', 1),
      ('u0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Kasun Bandara (Cashier 1)', 'cashier1@rasacakes.lk', '$2a$10$yRmuA99RFei8tgcImTfkTORBn/4JynMUJWdkFi3nz6rn76o8gl3Ge', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'cashier', 1),
      ('u0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dilani Silva (Cashier 2)', 'cashier2@rasacakes.lk', '$2a$10$yRmuA99RFei8tgcImTfkTORBn/4JynMUJWdkFi3nz6rn76o8gl3Ge', '$2a$10$acjhZD4hrHLXYJMvawtXn.xvnkqEm3brhSGI30oN82ExnagFJTwFi', 'cashier', 1);

    INSERT OR IGNORE INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
    VALUES 
      ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Signature Cakes', '#ec4899', 'cake', 1, 1),
      ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Pastries & Savories', '#f59e0b', 'croissant', 2, 1),
      ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Desserts & Cupcakes', '#8b5cf6', 'cookie', 3, 1),
      ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Beverages & Coffee', '#06b6d4', 'coffee', 4, 1);

    INSERT OR IGNORE INTO products (id, shop_id, category_id, name, description, price, cost_price, barcode, unit, image_path, track_inventory, is_active)
    VALUES 
      ('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Black Forest Cake 1kg', 'Rich chocolate sponge with cherries', 3800.00, 2400.00, '4790001001', 'pcs', 'products/black_forest.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Red Velvet Gateau 1kg', 'Velvety crimson sponge with cream cheese', 4200.00, 2600.00, '4790001002', 'pcs', 'products/red_velvet.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Ribbon Butter Cake 500g', 'Traditional Sri Lankan ribbon cake', 1650.00, 950.00, '4790001003', 'pcs', 'products/ribbon_butter.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Spicy Chicken Pastry', 'Flaky puff pastry stuffed with spicy chicken', 220.00, 110.00, '4790001004', 'pcs', 'products/spicy_chicken.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Fish Bun (Seeni Sambol & Fish)', 'Soft baked bun filled with tuna', 150.00, 75.00, '4790001005', 'pcs', 'products/fish_bun.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Choco Fudge Cupcake', 'Decadent chocolate cupcake', 280.00, 130.00, '4790001006', 'pcs', 'products/choco_fudge_cupcake.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Vanilla Eclair', 'Choux pastry with diplomat cream', 260.00, 120.00, '4790001007', 'pcs', 'products/vanilla_eclair.jpg', 1, 1),
      ('p0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Iced Caramel Latte', 'Fresh milk and salted caramel espresso', 750.00, 320.00, '4790001008', 'pcs', 'products/iced_caramel_latte.jpg', 0, 1);

    INSERT OR IGNORE INTO inventory (id, shop_id, product_id, quantity, min_quantity)
    VALUES 
      ('i0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 12.00, 3.00),
      ('i0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 8.00, 2.00),
      ('i0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 20.00, 5.00),
      ('i0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000004', 35.00, 10.00),
      ('i0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000005', 40.00, 10.00),
      ('i0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000006', 25.00, 5.00),
      ('i0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000007', 30.00, 5.00);
  `);

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('✅ SQLite Database created and seeded at:', dbPath);
});
