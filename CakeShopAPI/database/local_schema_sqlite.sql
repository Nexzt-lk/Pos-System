-- ============================================================================
-- Cake Shop POS — LOCAL SQLite Schema (offline-first, single shop per install)
-- Mirrors the Supabase (PostgreSQL) schema, adapted for SQLite data types.
-- Differences from the cloud schema:
--   * UUID          -> TEXT            (GUID strings, generated in C#)
--   * TIMESTAMPTZ   -> TEXT            (ISO 8601 strings, e.g. 2026-08-18T10:30:00Z)
--   * BOOLEAN       -> INTEGER         (0 = false, 1 = true)
--   * gen_random_uuid() -> generated in application code, not the database
--   * No Row Level Security (single shop's data only — enforced by API layer)
--   * item_code and code_prefix added (auto-generated per-category item codes)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,             -- "Birthday Items", "Yogurt", "Sweet Items"
    code_prefix TEXT NOT NULL,              -- "BDY", "YOG", "SWT" — used for item_code generation
    color       TEXT DEFAULT '#6366f1',
    icon        TEXT DEFAULT 'cake',
    sort_order  INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    UNIQUE(code_prefix)
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id              TEXT PRIMARY KEY,
    category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
    item_code       TEXT NOT NULL,          -- Auto-generated: "BDY-001", "YOG-001"
    name            TEXT NOT NULL,
    description     TEXT,
    price           REAL NOT NULL,
    cost_price      REAL,
    barcode         TEXT,                   -- NULL if manually-entered item with no barcode
    image_path      TEXT,
    unit            TEXT DEFAULT 'pcs',
    track_inventory INTEGER DEFAULT 1,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Sync tracking
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),

    UNIQUE(item_code),
    UNIQUE(barcode)
);

-- ============================================================================
-- INVENTORY (current stock level per product)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id            TEXT PRIMARY KEY,
    product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity      REAL NOT NULL DEFAULT 0,
    min_quantity  REAL DEFAULT 5,
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    UNIQUE(product_id)
);

-- ============================================================================
-- STOCK MOVEMENTS (audit ledger — every stock change)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES products(id),
    type            TEXT NOT NULL CHECK (type IN ('IN','OUT','SALE','ADJUST','RETURN','DAMAGE')),
    quantity        REAL NOT NULL,
    quantity_before REAL NOT NULL,
    quantity_after  REAL NOT NULL,
    reference_id    TEXT,                   -- order_id when type = 'SALE'
    note            TEXT,
    cost_per_unit   REAL,
    done_by         TEXT,                   -- user id (nullable for single-user v1)
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Sync tracking
    local_id        TEXT NOT NULL,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),

    UNIQUE(local_id)
);

-- ============================================================================
-- ORDERS (sales transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    order_no        TEXT NOT NULL UNIQUE,   -- Format: {TERMINAL}-{YYYYMMDD}-{SEQ:0000}
    cashier_id      TEXT,                   -- nullable for single-user v1
    subtotal        REAL NOT NULL,
    discount_type   TEXT CHECK (discount_type IN ('percent','fixed')),
    discount_amount REAL DEFAULT 0,
    tax_amount      REAL DEFAULT 0,
    total_amount    REAL NOT NULL,
    status          TEXT DEFAULT 'completed' CHECK (status IN ('completed','refunded','voided')),
    note            TEXT,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Sync tracking
    local_id        TEXT NOT NULL,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
    synced_at       TEXT,

    UNIQUE(local_id)
);

-- ============================================================================
-- ORDER ITEMS (immutable price snapshot at time of sale)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id            TEXT PRIMARY KEY,
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    TEXT NOT NULL REFERENCES products(id),
    product_name  TEXT NOT NULL,            -- snapshot
    item_code     TEXT,                     -- snapshot
    unit_price    REAL NOT NULL,            -- snapshot
    cost_price    REAL,                     -- snapshot, for margin reports
    quantity      REAL NOT NULL,
    discount      REAL DEFAULT 0,
    subtotal      REAL NOT NULL
);

-- ============================================================================
-- PAYMENTS (cash / card)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id            TEXT PRIMARY KEY,
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method        TEXT NOT NULL CHECK (method IN ('CASH','CARD')),
    amount        REAL NOT NULL,
    cash_given    REAL,
    change_given  REAL,
    reference_no  TEXT,                     -- card auth code, if applicable
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- EXPENSES (petty cash & overhead, incl. cost-of-goods restocking entries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id              TEXT PRIMARY KEY,
    category        TEXT,                   -- "Ingredients","Utilities","Restock","Staff"
    description     TEXT NOT NULL,
    amount          REAL NOT NULL,
    expense_date    TEXT NOT NULL,           -- date only, YYYY-MM-DD
    linked_product_id TEXT REFERENCES products(id) ON DELETE SET NULL, -- set when this expense IS a restock cost
    linked_stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
    added_by       TEXT,
    created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Sync tracking
    local_id       TEXT NOT NULL,
    sync_status    TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),

    UNIQUE(local_id)
);

-- ============================================================================
-- SYNC QUEUE (local only — drives what gets pushed to Supabase)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT NOT NULL,
    operation   TEXT NOT NULL,               -- INSERT | UPDATE | DELETE
    record_id   TEXT NOT NULL,               -- local_id of the record
    payload     TEXT NOT NULL,               -- full JSON of the record
    retry_count INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'pending',      -- pending | synced | failed
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    synced_at   TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode       ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_item_code     ON products(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_product      ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_product          ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_created          ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created         ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_sync            ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order         ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status      ON sync_queue(status);
