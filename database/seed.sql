-- ============================================================================
-- 🎂 Cake Shop POS — Production Master Seed Data
-- Branch 1 (Kandy) & Branch 2 (Colombo) | Realistic Menu | Initial Stock
-- ============================================================================

-- 1. Default Tenant
INSERT INTO tenants (id, name, plan, is_active)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Rasa Cake House & Bakers', 'pro', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Two Branches (Branch 1 - Kandy, Branch 2 - Colombo)
INSERT INTO shops (id, tenant_id, name, branch_code, address, phone, email, currency, is_active)
VALUES 
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Kandy Branch', 'B1', 'No. 45, Peradeniya Road, Kandy', '+94 81 223 4567', 'kandy@rasacakes.lk', 'LKR', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Colombo Branch', 'B2', 'No. 120, Galle Road, Colombo 03', '+94 11 258 9101', 'colombo@rasacakes.lk', 'LKR', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Users (Owner, Managers & Cashiers)
-- Note: Default PIN is '123456' for Cashier 1, '654321' for Cashier 2
INSERT INTO users (id, tenant_id, shop_id, name, email, pin_hash, role, is_active)
VALUES 
  -- Super Owner / Admin
  ('u0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nimal Perera (Owner)', 'owner@rasacakes.lk', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'owner', true),
  
  -- Branch 1 (Kandy) Cashier (PIN: 123456)
  ('u0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Kasun Bandara (Cashier 1)', 'kasun@rasacakes.lk', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'cashier', true),
  
  -- Branch 2 (Colombo) Cashier (PIN: 123456)
  ('u0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Sanduni Fernando (Cashier 2)', 'sanduni@rasacakes.lk', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'cashier', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Categories (Branch 1 - Kandy)
INSERT INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Signature Cakes', '#ec4899', 'cake', 1, true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Pastries & Savories', '#f59e0b', 'croissant', 2, true),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Desserts & Cupcakes', '#8b5cf6', 'cookie', 3, true),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Beverages & Coffee', '#06b6d4', 'coffee', 4, true)
ON CONFLICT (id) DO NOTHING;

-- Categories (Branch 2 - Colombo)
INSERT INTO categories (id, shop_id, name, color, icon, sort_order, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Signature Cakes', '#ec4899', 'cake', 1, true),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Pastries & Savories', '#f59e0b', 'croissant', 2, true),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 'Desserts & Cupcakes', '#8b5cf6', 'cookie', 3, true),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002', 'Beverages & Coffee', '#06b6d4', 'coffee', 4, true)
ON CONFLICT (id) DO NOTHING;

-- 5. Products (Branch 1 - Kandy)
INSERT INTO products (id, shop_id, category_id, name, description, price, cost_price, barcode, image_path, unit, track_inventory, is_active)
VALUES
  ('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Black Forest Cake 1kg', 'Rich chocolate sponge layered with cherries and whipped cream', 3800.00, 2400.00, '4790001001', 'products/black_forest.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Red Velvet Gateau 1kg', 'Velvety crimson sponge with cream cheese frosting', 4200.00, 2600.00, '4790001002', 'products/red_velvet.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Ribbon Butter Cake 500g', 'Traditional Sri Lankan three-color butter cake', 1650.00, 950.00, '4790001003', 'products/ribbon_cake.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Spicy Chicken Pastry', 'Flaky puff pastry stuffed with spicy devilled chicken', 220.00, 110.00, '4790001004', 'products/chicken_pastry.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Fish Bun (Seeni Sambol & Fish)', 'Soft baked bun filled with spiced tuna fish and caramelized onions', 150.00, 75.00, '4790001005', 'products/fish_bun.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Choco Fudge Cupcake', 'Decadent chocolate cupcake with fudge swirl', 280.00, 130.00, '4790001006', 'products/fudge_cupcake.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Vanilla Eclair', 'Choux pastry filled with diplomat cream and chocolate ganache', 260.00, 120.00, '4790001007', 'products/eclair.jpg', 'pcs', true, true),
  ('p0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Iced Caramel Latte', 'Espresso with fresh steamed milk and salted caramel', 750.00, 320.00, '4790001008', 'products/caramel_latte.jpg', 'pcs', false, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Initial Inventory (Branch 1 - Kandy)
INSERT INTO inventory (id, shop_id, product_id, quantity, min_quantity)
VALUES
  ('i0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 12.00, 3.00),
  ('i0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 8.00, 2.00),
  ('i0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 20.00, 5.00),
  ('i0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000004', 35.00, 10.00),
  ('i0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000005', 40.00, 10.00),
  ('i0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000006', 25.00, 5.00),
  ('i0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000007', 30.00, 5.00)
ON CONFLICT (shop_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;
