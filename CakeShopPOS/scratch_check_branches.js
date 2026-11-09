const fs = require('fs');
const initSqlJs = require('sql.js');

async function test() {
  const SQL = await initSqlJs();
  const paths = [
    's:/Projects/Nexzt Pos/database/cakeshop_local.db',
    's:/Projects/Nexzt Pos/CakeShopPOS/dist/win-unpacked/resources/cakeshop_local.db'
  ];

  for (const p of paths) {
    console.log('=== Checking:', p);
    const buf = fs.readFileSync(p);
    const db = new SQL.Database(buf);
    const b1 = db.exec("SELECT count(id) FROM products WHERE shop_id = 'b0000000-0000-0000-0000-000000000001'");
    const b2 = db.exec("SELECT count(id) FROM products WHERE shop_id = 'b0000000-0000-0000-0000-000000000002'");
    const i1 = db.exec("SELECT count(id) FROM inventory WHERE shop_id = 'b0000000-0000-0000-0000-000000000001'");
    const i2 = db.exec("SELECT count(id) FROM inventory WHERE shop_id = 'b0000000-0000-0000-0000-000000000002'");
    console.log('  Katugastota products:  ', b1[0].values[0][0]);
    console.log('  Poojapitiya products:  ', b2[0].values[0][0]);
    console.log('  Katugastota inventory: ', i1[0].values[0][0]);
    console.log('  Poojapitiya inventory: ', i2[0].values[0][0]);
  }
}
test();
