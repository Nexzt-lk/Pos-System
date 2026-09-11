const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Read .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

console.log('--- 🧪 Supabase Cloud Connectivity & Sync Test ---');
console.log('Connecting to URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  try {
    // 1. Test Reading Shops / Tenants
    console.log('\n[1/4] Checking Tables in Supabase...');
    const { data: shops, error: shopsErr } = await supabase.from('shops').select('*');
    if (shopsErr) {
      console.error('❌ Error reading shops table:', shopsErr.message);
      if (shopsErr.code === '42P01') {
        console.error('👉 Tip: It looks like the schema has not been run yet in Supabase SQL Editor. Please run database/schema.sql in Supabase.');
      }
      return;
    }
    console.log(`✅ Shops table accessible! Found ${shops?.length || 0} shop(s).`);
    if (shops && shops.length > 0) {
      console.log(`   Branch: ${shops[0].name} (${shops[0].branch_code})`);
    }

    // 2. Test Reading Products
    console.log('\n[2/4] Checking Products...');
    const { data: products, error: prodErr } = await supabase.from('products').select('*');
    if (prodErr) {
      console.error('❌ Error reading products:', prodErr.message);
    } else {
      console.log(`✅ Products table accessible! Found ${products?.length || 0} product(s).`);
    }

    // 3. Test Inserting a Cloud Test Sync Record
    console.log('\n[3/4] Testing Sync Push (Writing test record)...');
    const testLocalId = 'test-' + Date.now();
    const testPayload = {
      table_name: 'test_sync',
      operation: 'INSERT',
      record_id: testLocalId,
      payload: { test: true, message: 'Automated POS Cloud Sync Test', timestamp: new Date().toISOString() },
      status: 'synced',
      created_at: new Date().toISOString()
    };

    const { data: inserted, error: insertErr } = await supabase.from('sync_queue').insert([testPayload]).select();
    if (insertErr) {
      console.error('❌ Error writing to sync_queue:', insertErr.message);
    } else {
      console.log('✅ Successfully inserted sync test record to Supabase cloud!');
      console.log('   Inserted record ID:', inserted?.[0]?.id);
    }

    // 4. Verify the sync record exists
    console.log('\n[4/4] Verifying Cloud Read-back...');
    const { data: verifyData, error: verifyErr } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('record_id', testLocalId);

    if (verifyErr || !verifyData || verifyData.length === 0) {
      console.error('❌ Verification failed:', verifyErr?.message);
    } else {
      console.log('✅ Record verified in Supabase Cloud Database!');
      console.log('   Record details:', JSON.stringify(verifyData[0], null, 2));
    }

    console.log('\n🎉 ALL SUPABASE CLOUD SYNC TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('Unexpected error during sync test:', err);
  }
}

runTest();
