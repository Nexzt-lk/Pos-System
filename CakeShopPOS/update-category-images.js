const initSqlJs = require('sql.js')
const fs = require('fs')

const catImageMap = {
  'birthday deco & party items': 'products/party_deco.jpg',
  'sweet items & desserts': 'products/choco_fudge_cupcake.jpg',
  'cakes & gateaux': 'products/chocolate_cake.jpg',
  'biscuits & cookies': 'products/cookies_biscuits.jpg',
  'ice cream & frozen treats': 'products/ice_cream.jpg',
  'pastries & savories': 'products/savoury_pastries.jpg',
  'breads & buns': 'products/fish_bun.jpg',
  'beverages & coffee': 'products/iced_caramel_latte.jpg'
}

initSqlJs().then((SQL) => {
  const dbPath = 's:/Projects/Nexzt Pos/database/cakeshop_local.db'
  const db = new SQL.Database(fs.readFileSync(dbPath))

  const cats = db.exec('SELECT id, name FROM categories')
  const catRows = cats[0] ? cats[0].values : []
  const catMap = {}
  for (const [id, name] of catRows) {
    catMap[String(name).toLowerCase().trim()] = id
  }

  // Update existing products by category
  for (const [catId, catName] of catRows) {
    const cLower = String(catName).toLowerCase()
    let matchedImg = 'products/chocolate_cake.jpg'
    for (const [k, img] of Object.entries(catImageMap)) {
      if (cLower.includes(k) || k.includes(cLower)) {
        matchedImg = img
        break
      }
    }
    db.run(
      'UPDATE products SET image_path = ? WHERE category_id = ? AND (image_path IS NULL OR image_path = "" OR image_path = "null")',
      [matchedImg, catId]
    )
  }

  // Ensure products exist for each category with proper images
  const sampleProducts = [
    {
      id: 'p0000000-0000-0000-0000-000000000009',
      cat: catMap['biscuits & cookies'],
      name: 'Chocolate Chip Cookies (Pack)',
      desc: 'Crispy butter and chocolate chip cookies',
      price: 450,
      cost: 250,
      code: 'CK-009',
      unit: 'pack',
      img: 'products/cookies_biscuits.jpg'
    },
    {
      id: 'p0000000-0000-0000-0000-000000000010',
      cat: catMap['birthday deco & party items'],
      name: 'Birthday Candle & Topper Set',
      desc: 'Golden celebration candles and Happy Birthday topper',
      price: 350,
      cost: 180,
      code: 'DC-010',
      unit: 'set',
      img: 'products/party_deco.jpg'
    },
    {
      id: 'p0000000-0000-0000-0000-000000000011',
      cat: catMap['ice cream & frozen treats'],
      name: 'Ice Cream Sundae Cup',
      desc: 'Tri-flavor ice cream with chocolate syrup and wafer',
      price: 380,
      cost: 200,
      code: 'IC-011',
      unit: 'cup',
      img: 'products/ice_cream.jpg'
    },
    {
      id: 'p0000000-0000-0000-0000-000000000012',
      cat: catMap['breads & buns'],
      name: 'Bakery White Bread Loaf',
      desc: 'Freshly baked soft white sandwich bread',
      price: 180,
      cost: 110,
      code: 'BR-012',
      unit: 'loaf',
      img: 'products/fish_bun.jpg'
    }
  ]

  for (const p of sampleProducts) {
    if (p.cat) {
      db.run(
        `INSERT OR REPLACE INTO products (id, category_id, item_code, name, description, price, cost_price, barcode, unit, image_path, track_inventory, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [p.id, p.cat, p.code, p.name, p.desc, p.price, p.cost, p.code, p.unit, p.img]
      )
    }
  }

  fs.writeFileSync(dbPath, Buffer.from(db.export()))
  console.log('✅ Successfully updated database with categorized products and images!')
})
