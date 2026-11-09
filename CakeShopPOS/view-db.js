const fs = require('fs');
const path = require('path');
const initSqlJs = require('./node_modules/sql.js');

const dbPath = path.resolve(__dirname, '../database/cakeshop_pos.db');

if (!fs.existsSync(dbPath)) {
  console.log('Database file not created yet. Run the app once with `npm run dev`.');
  process.exit();
}

initSqlJs().then((SQL) => {
  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  console.log('\n=============================================');
  console.log('🎂 POS LOCAL DATABASE INSPECTOR');
  console.log('📁 File: ' + dbPath);
  console.log('=============================================\n');

  // List all tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  console.log('📊 TABLES FOUND:');
  tables[0]?.values.forEach(([name]) => console.log(`   - ${name}`));

  // Users
  console.log('\n👤 1. USERS:');
  const users = db.exec('SELECT name, email, role, is_active FROM users;');
  if (users[0]) {
    console.table(
      users[0].values.map((row) => ({
        Name: row[0],
        Email: row[1],
        Role: row[2],
        Active: row[3] ? 'Yes' : 'No'
      }))
    );
  }

  // Categories
  console.log('\n🏷️ 2. CATEGORIES:');
  const cats = db.exec('SELECT name, color FROM categories;');
  if (cats[0]) {
    console.table(cats[0].values.map((r) => ({ Category: r[0], Color: r[1] })));
  }

  // Products
  console.log('\n🍰 3. PRODUCTS:');
  const prods = db.exec('SELECT name, price, cost_price, barcode, unit FROM products;');
  if (prods[0]) {
    console.table(
      prods[0].values.map((r) => ({
        Product: r[0],
        SellingPrice: `Rs. ${r[1]}`,
        CostPrice: `Rs. ${r[2]}`,
        Barcode: r[3],
        Unit: r[4]
      }))
    );
  }

  // Shops
  console.log('\n🏪 4. BRANCHES / SHOPS:');
  const shops = db.exec('SELECT name, branch_code, address, phone FROM shops;');
  if (shops[0]) {
    console.table(
      shops[0].values.map((r) => ({
        Branch: r[0],
        Code: r[1],
        Address: r[2],
        Phone: r[3]
      }))
    );
  }
});
