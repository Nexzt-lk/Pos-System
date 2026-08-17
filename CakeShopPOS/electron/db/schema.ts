export const LOCAL_SCHEMA_SQL = `
-- 1. Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'basic',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Shops / Branches
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

-- 3. Users (Owners / Managers / Cashiers)
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

-- 4. Categories
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

-- 5. Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    cost_price REAL,
    barcode TEXT,
    image_path TEXT,
    unit TEXT DEFAULT 'pcs',
    track_inventory INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 6. Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    min_quantity REAL DEFAULT 5,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(shop_id, product_id)
);

-- 7. Stock Movements
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

-- 8. Orders
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

-- 9. Order Items (📸 Fixed Snapshots)
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    cost_price REAL,
    quantity REAL NOT NULL,
    discount REAL DEFAULT 0,
    subtotal REAL NOT NULL
);

-- 10. Payments
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

-- 11. Expenses
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

-- 12. Sync Queue (Offline local sync storage)
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

-- High Performance Local Indexes
CREATE INDEX IF NOT EXISTS idx_local_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_local_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_local_inventory_shop ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_local_orders_date ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_local_orders_sync ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_local_sync_pending ON sync_queue(status);
`
