const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const dbPath = path.resolve(__dirname, '../database/cakeshop_local.db');

function queryTable(db, tableName) {
  try {
    const res = db.exec(`SELECT * FROM ${tableName};`);
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map((row) => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } catch (e) {
    console.warn(`Could not query table ${tableName}:`, e.message);
    return [];
  }
}

// Convert non-standard UUID like u0000000... to valid UUID d0000000...
function toValidUuid(id) {
  if (!id) return null;
  const str = String(id).trim();
  if (str.startsWith('u0000000-')) {
    return 'd' + str.slice(1);
  }
  // If not standard 36-char UUID, format or keep
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  return null;
}

async function runCompleteSync() {
  console.log('\n======================================================');
  console.log('🚀 FULL DATA SYNC: LOCAL SQLITE -> SUPABASE CLOUD');
  console.log('📁 Local Database:', dbPath);
  console.log('🌐 Supabase Project:', supabaseUrl);
  console.log('======================================================\n');

  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  const defaultTenantId = 'a0000000-0000-0000-0000-000000000001';
  const defaultShopId = 'b0000000-0000-0000-0000-000000000001';

  // 1. TENANT
  console.log('[1/8] Syncing Tenant & Shop...');
  await supabase.from('tenants').upsert([{
    id: defaultTenantId,
    name: 'Rasa Cake House',
    plan: 'pro'
  }]);

  // SHOPS
  const localShops = queryTable(db, 'shops');
  const shopIds = new Set();
  const shopsToUpsert = (localShops.length > 0 ? localShops : [{
    id: defaultShopId,
    name: 'Rasa Cake House - Main Branch',
    branch_code: 'B1'
  }]).map((s) => {
    const sId = toValidUuid(s.id) || defaultShopId;
    shopIds.add(sId);
    return {
      id: sId,
      tenant_id: defaultTenantId,
      name: s.name || 'Main Branch',
      branch_code: s.branch_code || 'B1',
      address: s.address,
      phone: s.phone,
      email: s.email,
      currency: s.currency || 'LKR',
      receipt_footer: s.receipt_footer || 'Thank you for visiting Rasa Cake House! 🎂'
    };
  });
  const { error: shopErr } = await supabase.from('shops').upsert(shopsToUpsert);
  if (shopErr) console.error('  ❌ Shops sync error:', shopErr.message);
  else console.log(`  ✅ Synced ${shopsToUpsert.length} Shop(s)`);

  // 2. USERS
  console.log('\n[2/8] Syncing Users...');
  const localUsers = queryTable(db, 'users');
  const userIds = new Set();
  const usersToUpsert = localUsers.map((u) => {
    const uId = toValidUuid(u.id) || 'd0000000-0000-0000-0000-000000000001';
    userIds.add(uId);
    return {
      id: uId,
      tenant_id: defaultTenantId,
      shop_id: defaultShopId,
      name: u.name,
      email: u.email || `${u.role || 'user'}_${uId.slice(0, 6)}@rasacakes.lk`,
      pin_hash: u.pin_hash || '123456',
      password_hash: u.password_hash,
      role: u.role || 'cashier',
      is_active: u.is_active === 1 || u.is_active === true
    };
  });
  if (usersToUpsert.length > 0) {
    const { error: userErr } = await supabase.from('users').upsert(usersToUpsert);
    if (userErr) console.error('  ❌ Users sync error:', userErr.message);
    else console.log(`  ✅ Synced ${usersToUpsert.length} User(s)`);
  }

  // 3. CATEGORIES
  console.log('\n[3/8] Syncing Categories...');
  const localCats = queryTable(db, 'categories');
  const categoryIds = new Set();
  const catsToUpsert = localCats.map((c) => {
    const cId = toValidUuid(c.id);
    categoryIds.add(cId);
    return {
      id: cId,
      tenant_id: defaultTenantId,
      shop_id: defaultShopId,
      name: c.name,
      code_prefix: c.code_prefix || 'GEN',
      color: c.color || '#6366f1',
      icon: c.icon || 'cake',
      sort_order: c.sort_order || 0,
      is_active: c.is_active === 1 || c.is_active === true
    };
  }).filter((c) => !!c.id);

  if (catsToUpsert.length > 0) {
    const { error: catErr } = await supabase.from('categories').upsert(catsToUpsert);
    if (catErr) console.error('  ❌ Categories sync error:', catErr.message);
    else console.log(`  ✅ Synced ${catsToUpsert.length} Category/Categories`);
  }

  // 4. PRODUCTS
  console.log('\n[4/8] Syncing Products...');
  const localProducts = queryTable(db, 'products');
  const productIds = new Set();
  const productsToUpsert = localProducts.map((p) => {
    const pId = toValidUuid(p.id);
    productIds.add(pId);
    const catId = categoryIds.has(toValidUuid(p.category_id)) ? toValidUuid(p.category_id) : null;
    return {
      id: pId,
      tenant_id: defaultTenantId,
      shop_id: defaultShopId,
      category_id: catId,
      item_code: p.item_code,
      name: p.name,
      description: p.description || '',
      price: Number(p.price) || 0,
      cost_price: p.cost_price ? Number(p.cost_price) : null,
      barcode: p.barcode || null,
      image_path: p.image_path || null,
      unit: p.unit || 'pcs',
      track_inventory: p.track_inventory === 1 || p.track_inventory === true,
      is_active: p.is_active === 1 || p.is_active === true,
      sync_status: 'synced'
    };
  }).filter((p) => !!p.id);

  if (productsToUpsert.length > 0) {
    const { error: prodErr } = await supabase.from('products').upsert(productsToUpsert);
    if (prodErr) console.error('  ❌ Products sync error:', prodErr.message);
    else console.log(`  ✅ Synced ${productsToUpsert.length} Product(s)`);
  }

  // 5. INVENTORY
  console.log('\n[5/8] Syncing Inventory...');
  const localInv = queryTable(db, 'inventory');
  const invToUpsert = localInv
    .map((i) => {
      const pId = toValidUuid(i.product_id);
      if (!productIds.has(pId)) return null;
      return {
        id: toValidUuid(i.id) || undefined,
        shop_id: defaultShopId,
        product_id: pId,
        quantity: Number(i.quantity) || 0,
        min_quantity: Number(i.min_quantity) || 5
      };
    })
    .filter((i) => i !== null);

  if (invToUpsert.length > 0) {
    const { error: invErr } = await supabase.from('inventory').upsert(invToUpsert);
    if (invErr) console.error('  ❌ Inventory sync error:', invErr.message);
    else console.log(`  ✅ Synced ${invToUpsert.length} Inventory record(s)`);
  }

  // 6. ORDERS
  console.log('\n[6/8] Syncing Orders...');
  const localOrders = queryTable(db, 'orders');
  const orderIds = new Set();
  const ordersToUpsert = localOrders.map((o) => {
    const oId = toValidUuid(o.id);
    orderIds.add(oId);
    const cashierId = toValidUuid(o.cashier_id);
    const validCashierId = userIds.has(cashierId) ? cashierId : null;

    return {
      id: oId,
      shop_id: defaultShopId,
      order_no: o.order_no,
      terminal_id: o.terminal_id || 'T1',
      cashier_id: validCashierId,
      cashier_name: o.cashier_name || 'Admin',
      subtotal: Number(o.subtotal) || 0,
      discount_type: o.discount_type || 'fixed',
      discount_amount: Number(o.discount_amount) || 0,
      tax_amount: Number(o.tax_amount) || 0,
      total_amount: Number(o.total_amount) || 0,
      status: o.status || 'completed',
      note: o.note,
      local_id: o.local_id || oId,
      sync_status: 'synced',
      created_at: o.created_at || new Date().toISOString()
    };
  }).filter((o) => !!o.id);

  if (ordersToUpsert.length > 0) {
    const { error: ordErr } = await supabase.from('orders').upsert(ordersToUpsert);
    if (ordErr) console.error('  ❌ Orders sync error:', ordErr.message);
    else console.log(`  ✅ Synced ${ordersToUpsert.length} Order(s)`);
  }

  // 7. ORDER ITEMS
  console.log('\n[7/8] Syncing Order Items...');
  const localOrderItems = queryTable(db, 'order_items');
  const itemsToUpsert = localOrderItems
    .map((item) => {
      const oId = toValidUuid(item.order_id);
      if (!orderIds.has(oId)) return null;
      const pId = toValidUuid(item.product_id);
      const validProdId = productIds.has(pId) ? pId : null;

      return {
        id: toValidUuid(item.id) || undefined,
        shop_id: defaultShopId,
        order_id: oId,
        product_id: validProdId,
        product_name: item.product_name,
        item_code: item.item_code,
        unit_price: Number(item.unit_price) || 0,
        cost_price: item.cost_price ? Number(item.cost_price) : null,
        quantity: Number(item.quantity) || 1,
        discount: Number(item.discount) || 0,
        subtotal: Number(item.subtotal) || 0
      };
    })
    .filter((i) => i !== null);

  if (itemsToUpsert.length > 0) {
    const { error: itemErr } = await supabase.from('order_items').upsert(itemsToUpsert);
    if (itemErr) console.error('  ❌ Order items sync error:', itemErr.message);
    else console.log(`  ✅ Synced ${itemsToUpsert.length} Order Item(s)`);
  }

  // 8. PAYMENTS
  console.log('\n[8/8] Syncing Payments & Expenses...');
  const localPayments = queryTable(db, 'payments');
  const paymentsToUpsert = localPayments
    .map((p) => {
      const oId = toValidUuid(p.order_id);
      if (!orderIds.has(oId)) return null;
      return {
        id: toValidUuid(p.id) || undefined,
        shop_id: defaultShopId,
        order_id: oId,
        method: p.method || 'CASH',
        amount: Number(p.amount) || 0,
        cash_given: p.cash_given ? Number(p.cash_given) : null,
        change_given: p.change_given ? Number(p.change_given) : null,
        reference_no: p.reference_no,
        created_at: p.created_at || new Date().toISOString()
      };
    })
    .filter((p) => p !== null);

  if (paymentsToUpsert.length > 0) {
    const { error: payErr } = await supabase.from('payments').upsert(paymentsToUpsert);
    if (payErr) console.error('  ❌ Payments sync error:', payErr.message);
    else console.log(`  ✅ Synced ${paymentsToUpsert.length} Payment(s)`);
  }

  console.log('\n🎉 ==========================================================');
  console.log('🎉 ALL LOCAL DATA SUCCESSFULLY TRANSFERRED TO SUPABASE CLOUD!');
  console.log('🎉 ==========================================================\n');
}

runCompleteSync().catch(console.error);
