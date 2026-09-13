export const LOCAL_SCHEMA_SQL = `
-- 1. Shops / Branches
CREATE TABLE IF NOT EXISTS shops (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    branch_code    TEXT NOT NULL,
    address        TEXT,
    phone          TEXT,
    email          TEXT,
    currency       TEXT DEFAULT 'LKR',
    receipt_footer TEXT DEFAULT 'Thank you for visiting Wasana Cake - Katugastota! 🎂',
    created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(branch_code)
);

-- 2. Users (Owners / Managers / Cashiers)
CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    shop_id        TEXT REFERENCES shops(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,
    email          TEXT,
    pin_hash       TEXT NOT NULL,
    password_hash  TEXT,
    role           TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
    is_active      INTEGER DEFAULT 1,
    last_login     TEXT,
    created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(email)
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    code_prefix TEXT NOT NULL,
    color       TEXT DEFAULT '#6366f1',
    icon        TEXT DEFAULT 'cake',
    sort_order  INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(code_prefix)
);

-- 4. Products
CREATE TABLE IF NOT EXISTS products (
    id              TEXT PRIMARY KEY,
    category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
    item_code       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    price           REAL NOT NULL,
    cost_price      REAL,
    barcode         TEXT,
    image_path      TEXT,
    unit            TEXT DEFAULT 'pcs',
    track_inventory INTEGER DEFAULT 1,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
    UNIQUE(item_code),
    UNIQUE(barcode)
);

-- 5. Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id            TEXT PRIMARY KEY,
    product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity      REAL NOT NULL DEFAULT 0,
    min_quantity  REAL DEFAULT 5,
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(product_id)
);

-- 6. Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES products(id),
    type            TEXT NOT NULL CHECK (type IN ('IN','OUT','SALE','ADJUST','RETURN','DAMAGE')),
    quantity        REAL NOT NULL,
    quantity_before REAL NOT NULL,
    quantity_after  REAL NOT NULL,
    reference_id    TEXT,
    note            TEXT,
    cost_per_unit   REAL,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict'))
);

-- 7. Orders
CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    order_no        TEXT NOT NULL,
    terminal_id     TEXT DEFAULT 'T1',
    subtotal        REAL NOT NULL,
    discount_type   TEXT,
    discount_amount REAL DEFAULT 0,
    tax_amount      REAL DEFAULT 0,
    total_amount    REAL NOT NULL,
    status          TEXT DEFAULT 'completed' CHECK (status IN ('completed','cancelled','refunded')),
    note            TEXT,
    cashier_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    cashier_name    TEXT,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    local_id        TEXT NOT NULL,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
    UNIQUE(order_no),
    UNIQUE(local_id)
);

-- 8. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id            TEXT PRIMARY KEY,
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    TEXT NOT NULL REFERENCES products(id),
    product_name  TEXT NOT NULL,
    item_code     TEXT,
    unit_price    REAL NOT NULL,
    cost_price    REAL,
    quantity      REAL NOT NULL,
    discount      REAL DEFAULT 0,
    subtotal      REAL NOT NULL
);

-- 9. Payments
CREATE TABLE IF NOT EXISTS payments (
    id            TEXT PRIMARY KEY,
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method        TEXT NOT NULL CHECK (method IN ('CASH','CARD','TRANSFER')),
    amount        REAL NOT NULL,
    cash_given    REAL,
    change_given  REAL,
    reference_no  TEXT,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 10. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id              TEXT PRIMARY KEY,
    category        TEXT,
    description     TEXT NOT NULL,
    amount          REAL NOT NULL,
    expense_date    TEXT NOT NULL,
    linked_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    linked_stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
    added_by        TEXT,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    local_id        TEXT NOT NULL,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
    UNIQUE(local_id)
);

-- 11. Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT NOT NULL,
    operation   TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    payload     TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'pending',
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    synced_at   TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
`
