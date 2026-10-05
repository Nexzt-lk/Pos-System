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
-- SHOPS (Branch Info & Receipt Settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shops (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,              -- "Rasa Cake House - Kandy Branch"
    branch_code    TEXT NOT NULL,              -- "B1", "B2"
    address        TEXT,
    phone          TEXT,
    email          TEXT,
    currency       TEXT DEFAULT 'LKR',
    receipt_footer TEXT DEFAULT 'Thank you for visiting Rasa Cake House! 🎂',
    created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    UNIQUE(branch_code)
);

-- ============================================================================
-- USERS (Cashiers, Managers, Owners)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    shop_id        TEXT REFERENCES shops(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,              -- "Amara Silva"
    email          TEXT,
    pin_hash       TEXT NOT NULL,              -- Hash / plain of 6-digit PIN
    password_hash  TEXT,                       -- Hash for password login
    role           TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
    is_active      INTEGER DEFAULT 1,
    last_login     TEXT,
    created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    UNIQUE(email)
);

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
    shop_id         TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_barcode ON products(shop_id, barcode) WHERE barcode IS NOT NULL AND barcode != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_item_code ON products(shop_id, item_code) WHERE item_code IS NOT NULL AND item_code != '';

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
-- STOCK MOVEMENTS (audit trail of every change in stock)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES products(id),
    type            TEXT NOT NULL CHECK (type IN ('IN','OUT','SALE','ADJUST','RETURN','DAMAGE')),
    quantity        REAL NOT NULL,          -- Always positive delta
    quantity_before REAL NOT NULL,
    quantity_after  REAL NOT NULL,
    reference_id    TEXT,                   -- order_id if type = 'SALE'
    note            TEXT,
    cost_per_unit   REAL,                   -- for 'IN' / restock movements
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Sync tracking
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict'))
);

-- ============================================================================
-- ORDERS (completed sales transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    order_no        TEXT NOT NULL,          -- Human-friendly: "ORD-20260818-001"
    terminal_id     TEXT DEFAULT 'T1',
    subtotal        REAL NOT NULL,
    discount_type   TEXT,                   -- "percent" | "fixed"
    discount_amount REAL DEFAULT 0,
    tax_amount      REAL DEFAULT 0,
    total_amount    REAL NOT NULL,
    status          TEXT DEFAULT 'completed' CHECK (status IN ('completed','cancelled','refunded')),
    note            TEXT,
    cashier_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    cashier_name    TEXT,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Offline / Sync tracking
    local_id        TEXT NOT NULL,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),

    UNIQUE(order_no),
    UNIQUE(local_id)
);

-- ============================================================================
-- ORDER ITEMS (line items in an order)
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
    method        TEXT NOT NULL CHECK (method IN ('CASH','CARD','TRANSFER')),
    amount        REAL NOT NULL,
    cash_given    REAL,
    change_given  REAL,
    reference_no  TEXT,                     -- card auth code, if applicable
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- EXPENSES (petty cash and store costs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id              TEXT PRIMARY KEY,
    category        TEXT,                   -- "Ingredients","Utilities","Restock","Staff"
    description     TEXT NOT NULL,
    amount          REAL NOT NULL,
    expense_date    TEXT NOT NULL,           -- date only, YYYY-MM-DD
    linked_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    linked_stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
    added_by        TEXT,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    -- Sync tracking
    local_id        TEXT NOT NULL,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),

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
CREATE INDEX IF NOT EXISTS idx_users_shop            ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role);
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode      ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_item_code    ON products(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_product     ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_product         ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_created         ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created        ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_sync           ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order        ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date         ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status     ON sync_queue(status);

-- ============================================================================
-- SEED DATA (Shop, Users, Categories, Initial Products & Inventory)
-- ============================================================================

-- 1. Shop
INSERT OR IGNORE INTO shops (id, name, branch_code, address, phone, email, currency, receipt_footer)
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

-- 2. Users (PIN: 843522)
INSERT OR REPLACE INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active)
VALUES
    ('u0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Janaka Ariyarathna (Owner)', 'owner@wasanabakes.lk', '843522', 'JanakaW@2024!', 'owner', 1),
    ('u0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Sunil Jayasinghe (Manager)', 'manager@wasanabakes.lk', '843522', 'manager123', 'manager', 1),
    ('u0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Cashier 01', 'cashier1@wasanabakes.lk', '843522', 'WB_Cash1#2024', 'cashier', 1),
    ('u0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Cashier 02', 'cashier2@wasanabakes.lk', '843522', 'WB_Cash2#2024', 'cashier', 1);

-- 3. Categories
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

-- 4. Products (Ritzbury)
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

-- 5. Inventory
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
