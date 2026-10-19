const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const KATUGASTOTA_ID = 'b0000000-0000-0000-0000-000000000001';
const POOJAPITIYA_ID = 'b0000000-0000-0000-0000-000000000002';
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const p = l.split('=');
  if (p.length >= 2 && !l.startsWith('#')) env[p[0].trim()] = p.slice(1).join('=').trim();
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function cloneProductsToPoojapitiya() {
  console.log('🚀 Starting cloning of products to Poojapitiya branch in Supabase Cloud...');

  // 1. Fetch all products from Katugastota
  let allKatugastotaProducts = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', KATUGASTOTA_ID)
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Error fetching Katugastota products:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allKatugastotaProducts = allKatugastotaProducts.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`📦 Found ${allKatugastotaProducts.length} products in Katugastota branch.`);

  // 2. Fetch existing products in Poojapitiya to prevent duplicates
  let existingPoojapitiyaProducts = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, item_code, barcode')
      .eq('shop_id', POOJAPITIYA_ID)
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Error fetching existing Poojapitiya products:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    existingPoojapitiyaProducts = existingPoojapitiyaProducts.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`🔍 Existing Poojapitiya products: ${existingPoojapitiyaProducts.length}`);

  const existingCodes = new Set(existingPoojapitiyaProducts.map(p => p.item_code).filter(Boolean));

  // 3. Prepare new products and inventory for Poojapitiya
  const productsToInsert = [];
  const inventoryToInsert = [];
  const now = new Date().toISOString();

  for (const kp of allKatugastotaProducts) {
    if (existingCodes.has(kp.item_code)) {
      continue; // already exists
    }

    const newProductId = uuidv4();
    const newInvId = uuidv4();

    productsToInsert.push({
      id: newProductId,
      tenant_id: TENANT_ID,
      shop_id: POOJAPITIYA_ID,
      category_id: kp.category_id || null,
      item_code: kp.item_code,
      name: kp.name,
      description: kp.description || null,
      price: kp.price,
      cost_price: kp.cost_price || null,
      barcode: kp.barcode || null,
      image_path: kp.image_path || null,
      unit: kp.unit || 'pcs',
      track_inventory: kp.track_inventory !== false,
      is_active: kp.is_active !== false,
      sync_status: 'synced',
      created_at: now,
      updated_at: now
    });

    inventoryToInsert.push({
      id: newInvId,
      shop_id: POOJAPITIYA_ID,
      product_id: newProductId,
      quantity: 0,
      min_quantity: 5,
      updated_at: now
    });
  }

  console.log(`✨ Preparing to insert ${productsToInsert.length} new products and ${inventoryToInsert.length} inventory records for Poojapitiya...`);

  // 4. Batch insert into Supabase in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < productsToInsert.length; i += CHUNK_SIZE) {
    const pChunk = productsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: pErr } = await supabase.from('products').insert(pChunk);
    if (pErr) {
      console.error(`Error inserting products chunk [${i}..${i + pChunk.length}]:`, pErr);
      process.exit(1);
    }

    const iChunk = inventoryToInsert.slice(i, i + CHUNK_SIZE);
    const { error: iErr } = await supabase.from('inventory').insert(iChunk);
    if (iErr) {
      console.error(`Error inserting inventory chunk [${i}..${i + iChunk.length}]:`, iErr);
      process.exit(1);
    }

    console.log(`  ✓ Inserted ${Math.min(i + CHUNK_SIZE, productsToInsert.length)} / ${productsToInsert.length} products & inventory`);
  }

  console.log('🎉 Successfully added all products and inventory to Poojapitiya branch in Supabase Cloud!');
}

cloneProductsToPoojapitiya().catch(console.error);
