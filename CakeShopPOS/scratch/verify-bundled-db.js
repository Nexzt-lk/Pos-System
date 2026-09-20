const initSqlJs = require('S:/Projects/Nexzt Pos/CakeShopPOS/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');

async function test() {
  const SQL = await initSqlJs();
  const p = 'S:/Projects/Nexzt Pos/CakeShopPOS/dist/win-unpacked/resources/cakeshop_local.db';
  const buf = fs.readFileSync(p);
  const db = new SQL.Database(buf);
  const prod = db.exec('SELECT COUNT(*) FROM products');
  const cat = db.exec('SELECT COUNT(*) FROM categories');
  const ver = db.exec("SELECT value FROM settings WHERE key='db_version'");
  const users = db.exec('SELECT name, role FROM users');

  console.log('✅ Bundled DB in Installer:');
  console.log('  Products count:', prod[0]?.values[0][0]);
  console.log('  Categories count:', cat[0]?.values[0][0]);
  console.log('  db_version:', ver[0]?.values[0][0]);
  console.log('  Users:');
  users[0]?.values.forEach(u => console.log('   -', u[1], ':', u[0]));
}

test().catch(console.error);
