const initSqlJs = require('S:/Projects/Nexzt Pos/CakeShopPOS/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');
const path = require('path');

async function check() {
  const SQL = await initSqlJs();
  const dbPath = 'S:/Projects/Nexzt Pos/database/cakeshop_local.db';
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0];
  console.log('=== TABLES ===');
  console.log(tables.values.map(r => r[0]).join(', '));

  const userSchema = db.exec('PRAGMA table_info(users)')[0];
  console.log('\n=== USERS COLUMNS ===');
  userSchema.values.forEach(r => console.log(' ', r[1], '(' + r[2] + ')'));

  const products = db.exec('SELECT COUNT(*) FROM products')[0];
  console.log('\n=== COUNTS ===');
  console.log('Products:', products.values[0][0]);

  const categories = db.exec('SELECT COUNT(*) FROM categories')[0];
  console.log('Categories:', categories.values[0][0]);

  const inventory = db.exec('SELECT COUNT(*) FROM inventory')[0];
  console.log('Inventory:', inventory.values[0][0]);

  const usersList = db.exec('SELECT name, role, email FROM users')[0];
  console.log('\n=== USERS ===');
  usersList.values.forEach(r => console.log(' Role:', r[1], '| Name:', r[0], '| Email:', r[2]));

  db.close();
}
check().catch(console.error);
