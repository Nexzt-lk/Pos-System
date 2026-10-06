const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const tables = [
  'tenants',
  'shops',
  'users',
  'categories',
  'products',
  'inventory',
  'suppliers',
  'stock_movements',
  'orders',
  'order_items',
  'payments',
  'expenses',
  'cash_sessions',
  'sync_queue',
  'settings'
];

async function inspect() {
  console.log('--- Inspecting Supabase Tables ---');
  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ Table "${t}": Error -> ${error.message} (code: ${error.code})`);
    } else {
      console.log(`✅ Table "${t}": Exists! Row count: ${count}`);
    }
  }
}

inspect().catch(console.error);
