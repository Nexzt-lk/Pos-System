const fs = require('fs');
const initSqlJs = require('sql.js');

async function test() {
  const SQL = await initSqlJs();
  const dbPath = process.env.APPDATA + '/cake-shop-pos/database/cakeshop_local.db';
  if (!fs.existsSync(dbPath)) {
    console.log('No local db found at', dbPath);
    return;
  }
  const db = new SQL.Database(fs.readFileSync(dbPath));

  console.log('=== REAL-TIME LOCAL DATABASE RECORD COUNTS ===');
  const tables = [
    'shops',
    'categories',
    'users',
    'suppliers',
    'products',
    'inventory',
    'orders',
    'order_items',
    'payments',
    'stock_movements',
    'expenses',
    'cash_sessions'
  ];

  for (const t of tables) {
    try {
      const res = db.exec(`SELECT count(*) as total FROM ${t};`);
      console.log(`✅ Table [${t.toUpperCase()}]: ${res[0]?.values[0][0]} total records`);
    } catch (e) {
      console.log(`⚠️ Table [${t}]: ${e.message}`);
    }
  }

  // Also sync copy to project root database folder
  try {
    const devDbPath = 's:/Projects/Nexzt Pos/database/cakeshop_local.db';
    fs.copyFileSync(dbPath, devDbPath);
    console.log('\n📁 Dev folder DB synced to: s:/Projects/Nexzt Pos/database/cakeshop_local.db');
  } catch (_) {}
}

test().catch(console.error);


