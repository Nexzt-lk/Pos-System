-- ============================================================================
-- 🎂 Cake Shop POS — Production Master Database Schema
-- Multi-Tenant | Multi-Branch | Offline-First | Drift-Proof | RLS Protected
-- ============================================================================

-- Enable UUID extension if on PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS (SaaS Anchor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    plan        VARCHAR(20)  DEFAULT 'basic', -- basic | pro | enterprise
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================================
-- 2. SHOPS / BRANCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS shops (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,        -- "Rasa Cake Shop - Kandy Branch"
    branch_code VARCHAR(10)  NOT NULL,        -- "B1", "B2"
    address     TEXT,
    phone       VARCHAR(20),
    email       VARCHAR(100),
    logo_url    TEXT,
    currency    VARCHAR(10)  DEFAULT 'LKR',
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now(),

    UNIQUE(tenant_id, branch_code)
);

-- ============================================================================
-- 3. USERS (Cashiers, Managers, Owners)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id     UUID         NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100),
    pin_hash    VARCHAR(255) NOT NULL,        -- 🔒 BCrypt salted hash of 6-digit PIN
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
    is_active   BOOLEAN      DEFAULT true,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now(),

    UNIQUE(tenant_id, email)
);

-- ============================================================================
-- 4. CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     UUID         NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name        VARCHAR(50)  NOT NULL,        -- "Signature Cakes", "Pastries", "Beverages"
    color       VARCHAR(7)   DEFAULT '#6366f1',-- UI button/pill hex color
    icon        VARCHAR(50)  DEFAULT 'cake',  -- Icon identifier
    sort_order  INTEGER      DEFAULT 0,
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================================
-- 5. PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID           NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category_id     UUID           REFERENCES categories(id) ON DELETE SET NULL,
    name            VARCHAR(150)   NOT NULL,  -- "Black Forest Cake 1kg"
    description     TEXT,
    price           DECIMAL(10,2)  NOT NULL,  -- Current Selling price (LKR)
    cost_price      DECIMAL(10,2),            -- Estimated cost price for margins
    barcode         VARCHAR(50),              -- EAN / UPC / Custom barcode
    image_path      TEXT,                     -- Local relative path: "products/cake_1.jpg"
    unit            VARCHAR(20)    DEFAULT 'pcs', -- pcs | kg | slice | box
    track_inventory BOOLEAN        DEFAULT true,
    is_active       BOOLEAN        DEFAULT true,
    created_at      TIMESTAMPTZ    DEFAULT now(),
    updated_at      TIMESTAMPTZ    DEFAULT now()
);

-- ============================================================================
-- 6. INVENTORY (Per-Branch Stock Level)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id    UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity      DECIMAL(10,2) NOT NULL DEFAULT 0, -- Current on-hand stock
    min_quantity  DECIMAL(10,2)          DEFAULT 5, -- Low stock alert threshold
    updated_at    TIMESTAMPTZ            DEFAULT now(),

    UNIQUE(shop_id, product_id)
);

-- ============================================================================
-- 7. STOCK MOVEMENTS (Delta-Based Audit Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id      UUID          NOT NULL REFERENCES products(id),
    type            VARCHAR(20)   NOT NULL CHECK (type IN ('IN', 'OUT', 'SALE', 'ADJUST', 'RETURN', 'DAMAGE')),
    quantity        DECIMAL(10,2) NOT NULL,    -- Movement delta amount (always positive)
    quantity_before DECIMAL(10,2) NOT NULL,    -- Stock before
    quantity_after  DECIMAL(10,2) NOT NULL,    -- Stock after
    reference_id    UUID,                      -- Linked order_id when type='SALE'
    note            TEXT,                      -- Free text description e.g. "Morning Bake Batch #4"
    cost_per_unit   DECIMAL(10,2),             -- For 'IN' purchases
    done_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ   DEFAULT now(),

    -- Offline Sync Tracking
    local_id        VARCHAR(36)   NOT NULL,
    sync_status     VARCHAR(20)   DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),

    UNIQUE(shop_id, local_id)
);

-- ============================================================================
-- 8. ORDERS (Collision-Proof & Time-Drift Safe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_no        VARCHAR(35)   NOT NULL,    -- Format: {BRANCH_CODE}-{TERMINAL_ID}-{YYYYMMDD}-{SEQ:0000}
    cashier_id      UUID          REFERENCES users(id) ON DELETE SET NULL,
    subtotal        DECIMAL(10,2) NOT NULL,
    discount_type   VARCHAR(10)   CHECK (discount_type IN ('percent', 'fixed')),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount      DECIMAL(10,2) DEFAULT 0,
    total_amount    DECIMAL(10,2) NOT NULL,
    status          VARCHAR(20)   DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'voided')),
    note            TEXT,
    created_at      TIMESTAMPTZ   DEFAULT now(),
    time_drift_flag BOOLEAN       DEFAULT false, -- Audit flag if client clock drifted > 24h

    -- Offline Sync Tracking
    local_id        VARCHAR(36)   NOT NULL,
    sync_status     VARCHAR(20)   DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    synced_at       TIMESTAMPTZ,

    UNIQUE(shop_id, local_id),
    UNIQUE(shop_id, order_no)
);

-- ============================================================================
-- 9. ORDER ITEMS (📸 Immutable Historical Price Snapshot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    UUID          NOT NULL REFERENCES products(id),
    product_name  VARCHAR(150)  NOT NULL,   -- 📸 Fixed snapshot of name at sale
    unit_price    DECIMAL(10,2) NOT NULL,   -- 📸 Fixed snapshot of selling price
    cost_price    DECIMAL(10,2),            -- 📸 Fixed snapshot of unit cost price for margin reports
    quantity      DECIMAL(10,2) NOT NULL,
    discount      DECIMAL(10,2) DEFAULT 0,
    subtotal      DECIMAL(10,2) NOT NULL    -- (quantity * unit_price) - discount
);

-- ============================================================================
-- 10. PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method        VARCHAR(20)   NOT NULL CHECK (method IN ('CASH', 'CARD', 'TRANSFER', 'MIXED')),
    amount        DECIMAL(10,2) NOT NULL,
    cash_given    DECIMAL(10,2),            -- Tendered cash amount
    change_given  DECIMAL(10,2),            -- Customer change returned
    reference_no  VARCHAR(50),              -- Card auth code or bank transfer reference
    created_at    TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================================
-- 11. EXPENSES (Petty Cash & Daily Overhead)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category      VARCHAR(50),              -- "Ingredients", "Utilities", "Fuel", "Staff Meals"
    description   TEXT          NOT NULL,
    amount        DECIMAL(10,2) NOT NULL,
    expense_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
    added_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================================
-- 12. SYNC QUEUE (Local SQLite Only — Not in Supabase)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT    NOT NULL,           -- 'orders', 'stock_movements'
    operation   TEXT    NOT NULL,           -- 'INSERT' | 'UPDATE' | 'DELETE'
    record_id   TEXT    NOT NULL,           -- local_id of the record
    payload     TEXT    NOT NULL,           -- Full JSON string of record
    retry_count INTEGER DEFAULT 0,
    status      TEXT    DEFAULT 'pending',  -- pending | synced | failed
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at   DATETIME
);

-- ============================================================================
-- HIGH-PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shops_tenant         ON shops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_shop           ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shop        ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_shop       ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_date     ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sync          ON orders(shop_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_shop_product   ON stock_movements(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_created        ON stock_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_date   ON expenses(shop_id, expense_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_data_isolation" ON orders
    FOR ALL USING (
        shop_id = (SELECT shop_id FROM users WHERE id = auth.uid())
    );
