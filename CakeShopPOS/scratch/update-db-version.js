// Script to add db_version to the master template database
const initSqlJs = require('S:/Projects/Nexzt Pos/CakeShopPOS/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');

async function updateDb() {
  const SQL = await initSqlJs();
  const dbPath = 'S:/Projects/Nexzt Pos/database/cakeshop_local.db';
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  // Create settings table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Set db_version = 3
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('db_version', '3');`);

  // Verify
  const version = db.exec("SELECT value FROM settings WHERE key='db_version'");
  const products = db.exec("SELECT COUNT(*) FROM products");
  const users = db.exec("SELECT name, role FROM users");

  console.log('DB Version set to:', version[0].values[0][0]);
  console.log('Products:', products[0].values[0][0]);
  console.log('Users:');
  users[0].values.forEach(r => console.log(' ', r[1], '|', r[0]));

  // Save
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('\n✅ Master DB updated with db_version=2 and saved!');
  console.log('   Path:', dbPath);
  console.log('   Size:', fs.statSync(dbPath).size, 'bytes');
  db.close();
}

updateDb().catch(console.error);
