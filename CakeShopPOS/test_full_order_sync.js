const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testFullPOSOrderSync() {
  console.log('--- 🛒 Testing POS Order Cloud Sync ---');

  const shopId = env['VITE_DEFAULT_SHOP_ID'];
  const testOrderNo = `B1-T1-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-9999`;

  const orderData = {
    shop_id: shopId,
    order_no: testOrderNo,
    terminal_id: 'T1',
    subtotal: 2500.00,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 2500.00,
    status: 'completed',
    note: 'Cloud Sync Live Verification Test',
    local_id: 'loc-' + Date.now(),
    sync_status: 'synced'
  };

  const { data: order, error: orderErr } = await supabase.from('orders').insert([orderData]).select();
  if (orderErr) {
    console.error('❌ Order insert failed:', orderErr.message);
    return;
  }
  console.log(`✅ Test Order Synced to Supabase Cloud: ${order[0].order_no} (ID: ${order[0].id})`);

  // Insert Order Item
  const itemData = {
    shop_id: shopId,
    order_id: order[0].id,
    product_name: 'Chocolate Fudge Cake 1kg',
    item_code: 'CAK-001',
    unit_price: 2500.00,
    cost_price: 1800.00,
    quantity: 1,
    subtotal: 2500.00
  };

  const { error: itemErr } = await supabase.from('order_items').insert([itemData]);
  if (itemErr) {
    console.error('❌ Order item insert failed:', itemErr.message);
    return;
  }
  console.log(`✅ Test Order Item Synced: ${itemData.product_name}`);

  // Insert Payment
  const paymentData = {
    shop_id: shopId,
    order_id: order[0].id,
    method: 'CASH',
    amount: 2500.00,
    cash_given: 3000.00,
    change_given: 500.00
  };

  const { error: payErr } = await supabase.from('payments').insert([paymentData]);
  if (payErr) {
    console.error('❌ Payment insert failed:', payErr.message);
    return;
  }
  console.log(`✅ Test Payment Synced: LKR ${paymentData.amount} (${paymentData.method})`);

  console.log('\n✨ Complete Multi-Table POS Order Transaction Successfully Synced to Supabase! ✨\n');
}

testFullPOSOrderSync();
