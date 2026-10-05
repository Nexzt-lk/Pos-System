const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

initSqlJs().then(SQL => {
  const dbPath = path.resolve(__dirname, '../database/cakeshop_local.db');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  console.log("Checking current table structure...");
  const oldTable = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'");
  console.log("Old table sql:", oldTable[0].values[0][0]);

  // Run migration
  db.run("PRAGMA foreign_keys=OFF;");

  db.run(`
    CREATE TABLE products_new (
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
      shop_id         TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001'
    );
  `);

  db.run(`
    INSERT INTO products_new (
      id, category_id, item_code, name, description, price, cost_price,
      barcode, image_path, unit, track_inventory, is_active, created_at,
      updated_at, sync_status, shop_id
    )
    SELECT 
      id, category_id, item_code, name, description, price, cost_price,
      barcode, image_path, unit, track_inventory, is_active, created_at,
      updated_at, sync_status, COALESCE(shop_id, 'b0000000-0000-0000-0000-000000000001')
    FROM products;
  `);

  db.run("DROP TABLE products;");
  db.run("ALTER TABLE products_new RENAME TO products;");

  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_barcode ON products(shop_id, barcode) WHERE barcode IS NOT NULL AND barcode != '';");
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_item_code ON products(shop_id, item_code) WHERE item_code IS NOT NULL AND item_code != '';");
  db.run("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);");

  db.run("PRAGMA foreign_keys=ON;");

  console.log("Migration executed successfully!");
  const newTable = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'");
  console.log("New table sql:", newTable[0].values[0][0]);

  // Test inserting same barcode in two branches
  try {
    db.run(`
      INSERT INTO products (id, item_code, name, price, barcode, shop_id)
      VALUES ('test-b1-prod', 'TEST-001', 'Test Cake B1', 500, 'SHARED-BARCODE-999', 'b0000000-0000-0000-0000-000000000001');
    `);
    db.run(`
      INSERT INTO products (id, item_code, name, price, barcode, shop_id)
      VALUES ('test-b2-prod', 'TEST-001', 'Test Cake B2', 500, 'SHARED-BARCODE-999', 'b0000000-0000-0000-0000-000000000002');
    `);
    console.log("SUCCESS: Both branches can now have products with the SAME barcode without any constraint violation!");

    // Clean up test rows
    db.run("DELETE FROM products WHERE id IN ('test-b1-prod', 'test-b2-prod');");
  } catch (err) {
    console.error("Test failed:", err.message);
    process.exit(1);
  }

  const exported = db.export();
  fs.writeFileSync(dbPath, Buffer.from(exported));
  console.log("Database file updated successfully on disk.");
});
