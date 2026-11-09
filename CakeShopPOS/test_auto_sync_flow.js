const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const initSqlJs = require('sql.js');

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

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);
const dbPath = path.resolve(__dirname, '../database/cakeshop_local.db');

async function testAutoSyncFlow() {
  console.log('--- 🧪 Testing End-to-End Automatic Sync Flow ---');

  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  // 1. Create a new test product in local SQLite
  const testProductId = '55555555-5555-5555-5555-555555555555';
  const testProductName = 'Auto Sync Verified Cake';
  const testItemCode = 'TEST-AUTO-01';

  console.log('\n[1/3] Adding new product into Local SQLite...');
  db.run(
    `INSERT INTO products (id, name, item_code, price, cost_price, unit, is_active, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET name = excluded.name;`,
    [testProductId, testProductName, testItemCode, 1850, 1200, 'pcs']
  );

  // Enqueue to sync_queue
  db.run(
    `INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
     VALUES ('products', 'UPSERT', ?, ?, 'pending', datetime('now'));`,
    [testProductId, JSON.stringify({
      id: testProductId,
      name: testProductName,
      item_code: testItemCode,
      price: 1850,
      cost_price: 1200,
      unit: 'pcs',
      is_active: true
    })]
  );

  // Save back to file
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('✅ Product saved in Local SQLite & Enqueued to sync_queue!');

  // 2. Run the sync service process
  console.log('\n[2/3] Triggering Sync Service...');
  const { execSync } = require('child_process');
  execSync('node sync_all_local_to_supabase.js', { stdio: 'inherit' });

  // 3. Verify on Supabase Cloud
  console.log('\n[3/3] Verifying product exists on Supabase Cloud...');
  const { data: cloudProd, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', testProductId);

  if (error || !cloudProd || cloudProd.length === 0) {
    console.error('❌ Cloud verification failed:', error?.message);
  } else {
    console.log('🎉 SUCCESS! Newly added local product is now LIVE in Supabase Cloud:');
    console.log('   ID:', cloudProd[0].id);
    console.log('   Name:', cloudProd[0].name);
    console.log('   Price: LKR', cloudProd[0].price);
  }
}

testAutoSyncFlow().catch(console.error);
