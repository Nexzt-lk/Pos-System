-- ============================================================================
-- 🎂 NEXZT POS — Supabase (PostgreSQL) Master Cloud Database Schema
-- Multi-Tenant | Multi-Branch | Offline-First Sync Ready | Realtime Enabled
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. AUTO-UPDATE TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TENANTS (SaaS Anchor)
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
-- 4. SHOPS / BRANCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS shops (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID         REFERENCES tenants(id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,        -- "Rasa Cake House - Kandy Branch"
    branch_code    VARCHAR(10)  NOT NULL,        -- "B1", "B2"
    address        TEXT,
    phone          VARCHAR(20),
    email          VARCHAR(100),
    logo_url       TEXT,
    currency       VARCHAR(10)  DEFAULT 'LKR',
    receipt_footer TEXT         DEFAULT 'Thank you for visiting Rasa Cake House! 🎂',
    is_active      BOOLEAN      DEFAULT true,
    created_at     TIMESTAMPTZ  DEFAULT now(),
    updated_at     TIMESTAMPTZ  DEFAULT now(),

    UNIQUE(tenant_id, branch_code)
);

-- ============================================================================
-- 5. USERS (Cashiers, Managers, Owners)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID         REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id        UUID         REFERENCES shops(id) ON DELETE SET NULL,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100),
    pin_hash       VARCHAR(255) NOT NULL,        -- BCrypt hash or secure PIN representation
    password_hash  VARCHAR(255),               -- Optional web/admin password
    role           VARCHAR(20)  NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
    is_active      BOOLEAN      DEFAULT true,
    last_login     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  DEFAULT now(),
    updated_at     TIMESTAMPTZ  DEFAULT now(),

    UNIQUE(tenant_id, email)
);

-- ============================================================================
-- 6. CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID         REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id     UUID         REFERENCES shops(id) ON DELETE SET NULL,
    name        VARCHAR(50)  NOT NULL,        -- "Signature Cakes", "Pastries", "Beverages"
    code_prefix VARCHAR(10)  NOT NULL DEFAULT 'GEN', -- "BDY", "YOG", "SWT"
    color       VARCHAR(7)   DEFAULT '#6366f1',-- UI hex color
    icon        VARCHAR(50)  DEFAULT 'cake',  -- Lucide icon identifier
    sort_order  INTEGER      DEFAULT 0,
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================================
-- 7. PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID           REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id         UUID           REFERENCES shops(id) ON DELETE CASCADE,
    category_id     UUID           REFERENCES categories(id) ON DELETE SET NULL,
    item_code       VARCHAR(50),              -- Auto-generated: "BDY-001", "YOG-001"
    name            VARCHAR(150)   NOT NULL,  -- "Black Forest Cake 1kg"
    description     TEXT,
    price           DECIMAL(10,2)  NOT NULL,  -- Current Selling price (LKR)
    cost_price      DECIMAL(10,2),            -- Estimated cost price for margins
    barcode         VARCHAR(50),              -- EAN / UPC / Custom barcode
    image_path      TEXT,                     -- URL or relative path: "products/cake_1.jpg"
    unit            VARCHAR(20)    DEFAULT 'pcs', -- pcs | kg | slice | box
    track_inventory BOOLEAN        DEFAULT true,
    is_active       BOOLEAN        DEFAULT true,
    sync_status     VARCHAR(20)    DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    created_at      TIMESTAMPTZ    DEFAULT now(),
    updated_at      TIMESTAMPTZ    DEFAULT now(),

    UNIQUE(shop_id, item_code),
    UNIQUE(shop_id, barcode)
);

-- ============================================================================
-- 8. INVENTORY (Per-Branch Stock Level)
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
-- 9. STOCK MOVEMENTS (Audit Trail Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id      UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type            VARCHAR(20)   NOT NULL CHECK (type IN ('IN', 'OUT', 'SALE', 'ADJUST', 'RETURN', 'DAMAGE')),
    quantity        DECIMAL(10,2) NOT NULL,    -- Movement delta amount
    quantity_before DECIMAL(10,2) NOT NULL,    -- Stock before
    quantity_after  DECIMAL(10,2) NOT NULL,    -- Stock after
    reference_id    UUID,                      -- Linked order_id when type='SALE'
    note            TEXT,                      -- e.g. "Morning Bake Batch #4"
    cost_per_unit   DECIMAL(10,2),             -- For 'IN' purchases
    done_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
    local_id        VARCHAR(50),               -- Offline sync identifier
    sync_status     VARCHAR(20)   DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    created_at      TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================================
-- 10. ORDERS (Completed Sales Transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_no        VARCHAR(50)   NOT NULL,    -- Format: {BRANCH_CODE}-{YYYYMMDD}-{SEQ}
    terminal_id     VARCHAR(20)   DEFAULT 'T1',
    cashier_id      UUID          REFERENCES users(id) ON DELETE SET NULL,
    cashier_name    VARCHAR(100),
    subtotal        DECIMAL(10,2) NOT NULL,
    discount_type   VARCHAR(10)   CHECK (discount_type IN ('percent', 'fixed')),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount      DECIMAL(10,2) DEFAULT 0,
    total_amount    DECIMAL(10,2) NOT NULL,
    status          VARCHAR(20)   DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded', 'voided')),
    note            TEXT,
    time_drift_flag BOOLEAN       DEFAULT false,
    local_id        VARCHAR(50),               -- Offline sync identifier
    sync_status     VARCHAR(20)   DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    synced_at       TIMESTAMPTZ   DEFAULT now(),
    created_at      TIMESTAMPTZ   DEFAULT now(),
    updated_at      TIMESTAMPTZ   DEFAULT now(),

    UNIQUE(shop_id, order_no)
);

-- ============================================================================
-- 11. ORDER ITEMS (Line Items Snapshot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID          REFERENCES shops(id) ON DELETE CASCADE,
    order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    UUID          REFERENCES products(id) ON DELETE SET NULL,
    product_name  VARCHAR(150)  NOT NULL,   -- Snapshot of name at sale
    item_code     VARCHAR(50),              -- Snapshot of item code
    unit_price    DECIMAL(10,2) NOT NULL,   -- Snapshot of selling price
    cost_price    DECIMAL(10,2),            -- Snapshot of unit cost for margins
    quantity      DECIMAL(10,2) NOT NULL,
    discount      DECIMAL(10,2) DEFAULT 0,
    subtotal      DECIMAL(10,2) NOT NULL    -- (quantity * unit_price) - discount
);

-- ============================================================================
-- 12. PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID          REFERENCES shops(id) ON DELETE CASCADE,
    order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method        VARCHAR(20)   NOT NULL CHECK (method IN ('CASH', 'CARD', 'TRANSFER', 'MIXED')),
    amount        DECIMAL(10,2) NOT NULL,
    cash_given    DECIMAL(10,2),
    change_given  DECIMAL(10,2),
    reference_no  VARCHAR(100),             -- Card auth code or transaction ref
    created_at    TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================================
-- 13. EXPENSES (Petty Cash & Store Costs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id                  UUID          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category                 VARCHAR(50),              -- "Ingredients", "Utilities", "Fuel", "Staff"
    description              TEXT          NOT NULL,
    amount                   DECIMAL(10,2) NOT NULL,
    expense_date             DATE          NOT NULL DEFAULT CURRENT_DATE,
    linked_product_id        UUID          REFERENCES products(id) ON DELETE SET NULL,
    linked_stock_movement_id UUID          REFERENCES stock_movements(id) ON DELETE SET NULL,
    added_by                 UUID          REFERENCES users(id) ON DELETE SET NULL,
    local_id                 VARCHAR(50),
    sync_status              VARCHAR(20)   DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    created_at               TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================================
-- 14. SYNC QUEUE (Cloud-side Sync Audit & Retry Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    table_name  VARCHAR(50) NOT NULL,       -- 'orders', 'products', etc.
    operation   VARCHAR(20) NOT NULL,       -- 'INSERT' | 'UPDATE' | 'DELETE'
    record_id   VARCHAR(50) NOT NULL,       -- ID of the record
    payload     JSONB       NOT NULL,       -- Full JSON data of record
    retry_count INTEGER     DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    synced_at   TIMESTAMPTZ
);

-- ============================================================================
-- 15. AUTOMATED UPDATED_AT TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_shops_updated_at ON shops;
CREATE TRIGGER trg_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 16. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shops_tenant         ON shops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_shop           ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_role           ON users(role);
CREATE INDEX IF NOT EXISTS idx_products_shop        ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_item_code   ON products(item_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode     ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_shop_prod  ON inventory(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_date     ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sync          ON orders(shop_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_shop_product   ON stock_movements(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_created        ON stock_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_date   ON expenses(shop_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order       ON payments(order_id);

-- ============================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
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
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Allow read/write access via API Service Role or authenticated POS client
CREATE POLICY "Allow public access for POS operations" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON sync_queue FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 18. SUPABASE REALTIME REPLICATION (For instant live sync across terminals)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE products, inventory, orders, order_items, stock_movements, categories, expenses;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 19. INITIAL SEED / DEMO DATA (Optional default starter records)
-- ============================================================================
INSERT INTO tenants (id, name, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Wasana Cake', 'pro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO shops (id, tenant_id, name, branch_code, address, phone, currency, receipt_footer)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Wasana Cake - Katugastota',
    'B1',
    'Horana Wasana Bakers Galagedara Road Katugastota',
    '071-1172201',
    'LKR',
    'Thank you for visiting Wasana Cake - Katugastota! 🎂'
)
ON CONFLICT (id) DO NOTHING;

-- 8 Core Categories
INSERT INTO categories (id, tenant_id, shop_id, name, code_prefix, color, icon, sort_order)
VALUES 
    ('10eb67e2-985f-4ed6-9339-4504e9ada336', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Cakes & Gateaux', 'CAK', '#ec4899', 'cake', 1),
    ('50990b73-4919-460f-85f1-848b8f0838f7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Sweet Items & Desserts', 'SWT', '#a855f7', 'cookie', 2),
    ('48685b8b-b44d-4caa-b9c1-490155e87ea3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Biscuits & Cookies', 'BIS', '#f59e0b', 'cookie', 3),
    ('0e801936-12bf-4872-a59d-e3ae989c2ce0', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Birthday Deco & Party Items', 'BDY', '#3b82f6', 'party-popper', 4),
    ('56187eec-97ca-41b4-9d11-171e664a79af', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Ice Cream & Frozen Treats', 'ICE', '#06b6d4', 'ice-cream', 5),
    ('6b9be91b-1297-425c-9395-27cf952c8358', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Pastries & Savories', 'PAS', '#e11d48', 'croissant', 6),
    ('c40fc4e3-9a5b-477b-aa4d-b256f0a74267', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Breads & Buns', 'BRD', '#d97706', 'package', 7),
    ('536a3768-5597-4c7c-ad09-c877796aff54', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Beverages & Coffee', 'BEV', '#10b981', 'coffee', 8)
ON CONFLICT (id) DO NOTHING;

-- Staff Users (PIN: 843522)
INSERT INTO users (id, tenant_id, shop_id, name, email, pin_hash, password_hash, role)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Janaka Ariyarathna (Owner)', 'owner@wasanabakes.lk', '843522', 'JanakaW@2024!', 'owner'),
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Sunil Jayasinghe (Manager)', 'manager@wasanabakes.lk', '843522', 'manager123', 'manager'),
    ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Cashier 01', 'cashier1@wasanabakes.lk', '843522', 'WB_Cash1#2024', 'cashier'),
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Cashier 02', 'cashier2@wasanabakes.lk', '843522', 'WB_Cash2#2024', 'cashier')
ON CONFLICT (id) DO NOTHING;

-- Initial Products (Ritzbury)
INSERT INTO products (id, tenant_id, shop_id, category_id, item_code, name, description, price, cost_price, barcode, unit, track_inventory, is_active, sync_status)
VALUES
    ('e21d1c04-aafd-4f21-8913-1a01662dff22', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-001', 'Choco-La Kiddies Milk 20g', 'Ritzbury Choco-La Kiddies Milk 20g', 50.00, 0, 'SWT-001', 'pcs', true, true, 'synced'),
    ('d56678ff-22b0-48c9-921f-949fea55b7b0', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-002', 'Choco-La Milk Sweet 20g', 'Ritzbury Choco-La Milk Sweet 20g', 50.00, 0, 'SWT-002', 'pcs', true, true, 'synced'),
    ('2f4e7115-75b5-4d93-85e5-c7fab78e7b31', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-003', 'Choco-La Milk 45g', 'Ritzbury Choco-La Milk 45g', 100.00, 0, 'SWT-003', 'pcs', true, true, 'synced'),
    ('36fa3d50-2557-4a5b-9a64-66327817545c', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-004', 'Choco-La Peanut 45g', 'Ritzbury Choco-La Peanut 45g', 120.00, 0, 'SWT-004', 'pcs', true, true, 'synced'),
    ('94d1daa7-54a5-47dc-9193-300a7343ef46', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-005', 'Choco-La Milk 90g', 'Ritzbury Choco-La Milk 90g', 200.00, 0, 'SWT-005', 'pcs', true, true, 'synced'),
    ('1da3b3c5-3358-485e-a366-8e3409364358', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-006', 'Roccoa Milk IBB 25g', 'Ritzbury Roccoa Milk IBB 25g', 170.00, 0, 'SWT-006', 'pcs', true, true, 'synced'),
    ('b6ac1022-21bb-443e-9d5d-5fbaa74a252b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-007', 'Roccoa Milk IBB 45g', 'Ritzbury Roccoa Milk IBB 45g', 280.00, 0, 'SWT-007', 'pcs', true, true, 'synced'),
    ('6ce55cf9-77db-4d51-9191-b854a79ccf3f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-008', 'Roccoa Milk IBB 90g', 'Ritzbury Roccoa Milk IBB 90g', 570.00, 0, 'SWT-008', 'pcs', true, true, 'synced'),
    ('02578d5b-3cc9-4f43-8ccb-c634d3f39ad2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-009', 'Ritzbury Milk 45g', 'Ritzbury Ritzbury Milk 45g', 140.00, 0, 'SWT-009', 'pcs', true, true, 'synced'),
    ('778f1a0a-da41-4aec-b6ef-c4e81745c356', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-010', 'Ritzbury Milk Sweet 93g', 'Ritzbury Ritzbury Milk Sweet 93g', 230.00, 0, 'SWT-010', 'pcs', true, true, 'synced'),
    ('3382985e-25a2-4dd4-9476-b31c5505d3f3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-011', 'Ritzbury Cashew 93g', 'Ritzbury Ritzbury Cashew 93g', 380.00, 0, 'SWT-011', 'pcs', true, true, 'synced'),
    ('f93696b5-e2cf-40f2-aba9-41e1afb606e9', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-012', 'Ritzbury Milk 170g', 'Ritzbury Ritzbury Milk 170g', 530.00, 0, 'SWT-012', 'pcs', true, true, 'synced'),
    ('94618602-0332-4c5e-a72f-f27e23c4bed7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-013', 'Bubbles 30g', 'Ritzbury Bubbles 30g', 100.00, 0, 'SWT-013', 'pcs', true, true, 'synced'),
    ('5f0622ba-a560-47b6-82f3-775eca57cdf3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-014', 'Bubbles 100g', 'Ritzbury Bubbles 100g', 250.00, 0, 'SWT-014', 'pcs', true, true, 'synced'),
    ('776aedc9-6766-437a-974f-7b0f5658f8ba', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-015', 'Bubbles 170g', 'Ritzbury Bubbles 170g', 450.00, 0, 'SWT-015', 'pcs', true, true, 'synced'),
    ('163de812-8386-4eff-8bf8-f859846e59a4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50990b73-4919-460f-85f1-848b8f0838f7', 'SWT-016', 'Revello Milk 50g', 'Ritzbury Revello Milk 50g', 350.00, 0, 'SWT-016', 'pcs', true, true, 'synced'),
    ('64f3ae02-f174-41b4-b40a-50c8de4ac6eb', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '48685b8b-b44d-4caa-b9c1-490155e87ea3', 'BIS-001', 'Chocolate Fingers 18g', 'Ritzbury Chocolate Fingers 18g', 40.00, 0, 'BIS-001', 'pcs', true, true, 'synced'),
    ('343a4b16-bfb2-44f0-ac4c-b2ab1ea5d4b4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '48685b8b-b44d-4caa-b9c1-490155e87ea3', 'BIS-002', 'Chocolate Fingers 40g', 'Ritzbury Chocolate Fingers 40g', 100.00, 0, 'BIS-002', 'pcs', true, true, 'synced')
ON CONFLICT (id) DO NOTHING;

-- Initial Inventory (Stock: 50 each)
INSERT INTO inventory (shop_id, product_id, quantity, min_quantity)
SELECT 'b0000000-0000-0000-0000-000000000001', p.id, 50, 5
FROM products p
WHERE p.shop_id = 'b0000000-0000-0000-0000-000000000001'
ON CONFLICT (shop_id, product_id) DO NOTHING;
