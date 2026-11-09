-- ============================================================================
-- NEXZT POS — Supabase RLS Patch
-- Run once in the Supabase SQL Editor to unblock sync for
-- suppliers, cash_sessions and settings tables.
-- ============================================================================

-- 1. Create missing tables (idempotent)
CREATE TABLE IF NOT EXISTS suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    contact_person  VARCHAR(100),
    email           VARCHAR(150),
    address         TEXT,
    notes           TEXT,
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMPTZ  DEFAULT now(),
    updated_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID REFERENCES shops(id) ON DELETE CASCADE,
    cashier_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    cashier_name    VARCHAR(100),
    session_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
    terminal_id     VARCHAR(20)  DEFAULT 'T1',
    opening_float   DECIMAL(12,2) DEFAULT 0,
    closing_float   DECIMAL(12,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ  DEFAULT now(),
    updated_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     UUID REFERENCES shops(id) ON DELETE CASCADE,
    key         VARCHAR(100) NOT NULL,
    value       TEXT,
    updated_at  TIMESTAMPTZ  DEFAULT now(),
    UNIQUE(shop_id, key)
);

-- 2. Enable RLS
ALTER TABLE suppliers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;

-- 3. Drop stale policies
DROP POLICY IF EXISTS "Allow public access for POS operations" ON suppliers;
DROP POLICY IF EXISTS "Allow public access for POS operations" ON cash_sessions;
DROP POLICY IF EXISTS "Allow public access for POS operations" ON settings;

-- 4. Create permissive policies (anon key can read & write)
CREATE POLICY "Allow public access for POS operations" ON suppliers     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON cash_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for POS operations" ON settings      FOR ALL USING (true) WITH CHECK (true);

-- 5. Auto-update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at     ON suppliers;
DROP TRIGGER IF EXISTS trg_cash_sessions_updated_at ON cash_sessions;
DROP TRIGGER IF EXISTS trg_settings_updated_at      ON settings;

CREATE TRIGGER trg_suppliers_updated_at     BEFORE UPDATE ON suppliers     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cash_sessions_updated_at BEFORE UPDATE ON cash_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_settings_updated_at      BEFORE UPDATE ON settings      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Realtime publication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE suppliers, cash_sessions, settings;
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'RLS patch applied — suppliers, cash_sessions, settings are now writable.' AS result;
