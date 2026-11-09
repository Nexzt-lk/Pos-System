const initSqlJs = require('./CakeShopPOS/node_modules/sql.js');
const fs = require('fs');

initSqlJs().then(SQL => {
  const buf = fs.readFileSync('database/cakeshop_local.db');
  const db = new SQL.Database(buf);
  const tbl = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'");
  console.log("TABLE SQL:\n", tbl[0].values[0][0]);
  const idx = db.exec("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='products'");
  if (idx.length > 0) {
    console.log("INDEXES:\n", JSON.stringify(idx[0].values, null, 2));
  }
});
