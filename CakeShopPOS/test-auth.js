const fs = require('fs');
const path = require('path');
const initSqlJs = require('./node_modules/sql.js');
const bcrypt = require('./node_modules/bcryptjs');

const dbPath = path.resolve(__dirname, '../database/cakeshop_pos.db');

initSqlJs().then((SQL) => {
  const filebuffer = fs.readFileSync(dbPath);
  const rawDb = new SQL.Database(filebuffer);

  const testLogin = (email, password) => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const stmt = rawDb.prepare(`SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1`);
    stmt.bind([normalizedEmail]);
    const users = [];
    while (stmt.step()) {
      users.push(stmt.getAsObject());
    }
    stmt.free();

    console.log(`\nTesting login for: [${email}] with pass: [${password}]`);
    if (users.length === 0) {
      console.log('❌ User not found!');
      return;
    }

    const user = users[0];
    console.log('Found user in DB:', user.name, '| Role:', user.role);
    console.log('Password hash in DB:', user.password_hash);
    
    const passMatch = user.password_hash ? bcrypt.compareSync(password, user.password_hash) : false;
    console.log('bcrypt.compareSync result:', passMatch);

    if (passMatch) {
      console.log('✅ LOGIN SUCCESSFUL for', user.name, `(Role: ${user.role})`);
    } else {
      console.log('❌ PASSWORD MISMATCH!');
    }
  };

  testLogin('owner@rasacakes.lk', 'owner123');
  testLogin('manager@rasacakes.lk', 'manager123');
  testLogin('cashier1@rasacakes.lk', 'cashier123');
  testLogin('cashier2@rasacakes.lk', 'cashier123');
});
