import { getDatabase } from '../database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export interface StockMovementInput {
  shopId?: string
  productId: string
  type: 'IN' | 'OUT' | 'SALE' | 'ADJUST' | 'RETURN' | 'DAMAGE'
  quantity: number
  note?: string
  costPerUnit?: number
  doneBy?: string
  supplierId?: string
  supplierName?: string
  totalCost?: number
  invoiceNo?: string
  paymentMethod?: string
  recordExpense?: boolean
}

export interface StockPurchaseFilter {
  shopId?: string
  from?: string
  to?: string
  productId?: string
  supplierId?: string
  search?: string
}

export const inventoryRepo = {
  getLowStock: async (shopId?: string) => {
    const db = await getDatabase()
    let query = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.unit,
        COALESCE(i.quantity, 0) as current_stock,
        COALESCE(i.min_quantity, 5) as min_quantity
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND (i.shop_id = p.shop_id OR i.shop_id IS NULL)
      WHERE p.track_inventory = 1 AND p.is_active = 1
        AND COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 5)
    `
    const sqlParams: any[] = []
    if (shopId) {
      query += ` AND p.shop_id = ?`
      sqlParams.push(shopId)
    }
    query += ` ORDER BY current_stock ASC`
    return db.query(query, sqlParams)
  },

  recordMovement: async (movement: StockMovementInput) => {
    const db = await getDatabase()
    const movementId = uuidv4()
    const localId = uuidv4()

    const inv = db.queryOne<{ quantity: number }>(
      `SELECT quantity FROM inventory WHERE product_id = ?`,
      [movement.productId]
    )

    const product = db.queryOne<{ name: string; unit: string; cost_price: number; shop_id?: string }>(
      `SELECT name, unit, cost_price, shop_id FROM products WHERE id = ?`,
      [movement.productId]
    )

    const shopId = movement.shopId || product?.shop_id || 'b0000000-0000-0000-0000-000000000001'

    const qtyBefore = inv?.quantity || 0
    let qtyAfter = qtyBefore

    const mType = (movement.type || 'IN').toUpperCase()
    if (mType === 'IN' || mType === 'RETURN') {
      qtyAfter = qtyBefore + movement.quantity
    } else if (mType === 'OUT' || mType === 'SALE' || mType === 'DAMAGE') {
      qtyAfter = Math.max(0, qtyBefore - movement.quantity)
    } else if (mType === 'ADJUST') {
      qtyAfter = movement.quantity
    }

    // 1. Update Inventory Table
    db.run(
      `
      INSERT INTO inventory (id, product_id, shop_id, quantity, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(product_id) DO UPDATE SET
        quantity = excluded.quantity,
        shop_id = excluded.shop_id,
        updated_at = datetime('now')
    `,
      [uuidv4(), movement.productId, shopId, qtyAfter]
    )

    // Calculate final total cost
    const effectiveCostPerUnit = movement.costPerUnit !== undefined && movement.costPerUnit !== null
      ? Number(movement.costPerUnit)
      : (product?.cost_price || 0)

    const effectiveTotalCost = movement.totalCost !== undefined && movement.totalCost !== null && Number(movement.totalCost) > 0
      ? Number(movement.totalCost)
      : Math.round(movement.quantity * effectiveCostPerUnit * 100) / 100

    // 2. Insert Stock Movement
    db.run(
      `
      INSERT INTO stock_movements (
        id, shop_id, product_id, type, quantity, quantity_before,
        quantity_after, note, cost_per_unit, supplier_id,
        supplier_name, total_cost, invoice_no, payment_method,
        done_by, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'pending')
    `,
      [
        movementId,
        shopId,
        movement.productId,
        movement.type,
        movement.quantity,
        qtyBefore,
        qtyAfter,
        movement.note || null,
        effectiveCostPerUnit || null,
        movement.supplierId || null,
        movement.supplierName || null,
        effectiveTotalCost || null,
        movement.invoiceNo || null,
        movement.paymentMethod || 'CASH',
        movement.doneBy || null
      ]
    )

    // 3. Auto-record store expense for stock purchase when 'IN' type and has cost
    if (mType === 'IN' && movement.recordExpense !== false && effectiveTotalCost > 0) {
      const expId = uuidv4()
      const expLocalId = 'exp-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900)
      const expDate = dayjs().format('YYYY-MM-DD')
      const prodName = product?.name || 'Cake Item'
      const supDesc = movement.supplierName ? ` from ${movement.supplierName}` : ''
      const invDesc = movement.invoiceNo ? ` [Inv: ${movement.invoiceNo}]` : ''
      const expDescription = `Stock Purchase: ${prodName} (${movement.quantity} ${product?.unit || 'pcs'})${supDesc}${invDesc}`

      db.run(
        `
        INSERT INTO expenses (
          id, shop_id, category, description, amount, expense_date,
          linked_product_id, linked_stock_movement_id, supplier_id,
          supplier_name, invoice_no, payment_method, added_by,
          created_at, local_id, sync_status
        ) VALUES (?, ?, 'Stock Purchase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'pending')
      `,
        [
          expId,
          shopId,
          expDescription,
          effectiveTotalCost,
          expDate,
          movement.productId,
          movementId,
          movement.supplierId || null,
          movement.supplierName || null,
          movement.invoiceNo || null,
          movement.paymentMethod || 'CASH',
          movement.doneBy || 'Owner',
          expLocalId
        ]
      )

      // Sync queue for expense
      db.run(
        `
        INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
        VALUES ('expenses', 'INSERT', ?, ?, 'pending', datetime('now'))
      `,
        [
          expId,
          JSON.stringify({
            id: expId,
            shop_id: shopId,
            local_id: expLocalId,
            category: 'Stock Purchase',
            description: expDescription,
            amount: effectiveTotalCost,
            expense_date: expDate,
            linked_product_id: movement.productId,
            linked_stock_movement_id: movementId,
            supplier_id: movement.supplierId || null,
            supplier_name: movement.supplierName || null,
            invoice_no: movement.invoiceNo || null,
            payment_method: movement.paymentMethod || 'CASH',
            added_by: movement.doneBy || 'Owner'
          })
        ]
      )
    }

    // 4. Sync queue for stock_movement
    db.run(
      `
      INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
      VALUES ('stock_movements', 'INSERT', ?, ?, 'pending', datetime('now'))
    `,
      [
        localId,
        JSON.stringify({
          shop_id: movement.shopId || 'b0000000-0000-0000-0000-000000000001',
          product_id: movement.productId,
          type: movement.type,
          quantity: movement.quantity,
          quantity_before: qtyBefore,
          quantity_after: qtyAfter,
          note: movement.note || null,
          cost_per_unit: effectiveCostPerUnit || null,
          supplier_id: movement.supplierId || null,
          supplier_name: movement.supplierName || null,
          total_cost: effectiveTotalCost || null,
          invoice_no: movement.invoiceNo || null,
          payment_method: movement.paymentMethod || 'CASH',
          done_by: movement.doneBy || null,
          local_id: localId
        })
      ]
    )

    db.save()
    return {
      success: true,
      movementId,
      productId: movement.productId,
      quantity: movement.quantity,
      costPerUnit: effectiveCostPerUnit,
      totalCost: effectiveTotalCost,
      supplierName: movement.supplierName
    }
  },

  getStockPurchases: async (params?: StockPurchaseFilter): Promise<any[]> => {
    const db = await getDatabase()
    let query = `
      SELECT 
        sm.id,
        sm.product_id,
        p.name as product_name,
        p.barcode as item_code,
        p.unit,
        sm.type,
        sm.quantity,
        sm.quantity_before,
        sm.quantity_after,
        COALESCE(sm.cost_per_unit, p.cost_price, 0) as cost_per_unit,
        COALESCE(sm.total_cost, sm.quantity * COALESCE(sm.cost_per_unit, p.cost_price, 0)) as total_cost,
        sm.supplier_id,
        COALESCE(sm.supplier_name, s.name, 'Direct Purchase') as supplier_name,
        sm.invoice_no,
        COALESCE(sm.payment_method, 'CASH') as payment_method,
        sm.note,
        sm.done_by,
        sm.created_at
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN suppliers s ON sm.supplier_id = s.id
      WHERE UPPER(sm.type) = 'IN'
    `
    const sqlParams: any[] = []

    if (params?.shopId && params.shopId !== 'all') {
      query += ` AND (sm.shop_id = ? OR p.shop_id = ?)`
      sqlParams.push(params.shopId, params.shopId)
    }

    if (params?.from) {
      query += ` AND substr(sm.created_at, 1, 10) >= ?`
      sqlParams.push(params.from)
    }

    if (params?.to) {
      query += ` AND substr(sm.created_at, 1, 10) <= ?`
      sqlParams.push(params.to)
    }

    if (params?.productId && params.productId !== 'all') {
      query += ` AND sm.product_id = ?`
      sqlParams.push(params.productId)
    }

    if (params?.supplierId && params.supplierId !== 'all') {
      query += ` AND (sm.supplier_id = ? OR LOWER(sm.supplier_name) = LOWER(?))`
      sqlParams.push(params.supplierId, params.supplierId)
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`
      query += ` AND (p.name LIKE ? OR sm.supplier_name LIKE ? OR sm.invoice_no LIKE ? OR sm.note LIKE ?)`
      sqlParams.push(term, term, term, term)
    }

    query += ` ORDER BY sm.created_at DESC`

    const rows = db.query<any>(query, sqlParams)
    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name || 'Unknown Product',
      itemCode: r.item_code || '',
      unit: r.unit || 'pcs',
      type: r.type,
      quantity: Number(r.quantity) || 0,
      quantityBefore: Number(r.quantity_before) || 0,
      quantityAfter: Number(r.quantity_after) || 0,
      costPerUnit: Number(r.cost_per_unit) || 0,
      totalCost: Number(r.total_cost) || 0,
      supplierId: r.supplier_id || '',
      supplierName: r.supplier_name || 'Direct Purchase',
      invoiceNo: r.invoice_no || '',
      paymentMethod: r.payment_method || 'CASH',
      note: r.note || '',
      doneBy: r.done_by || 'Owner',
      createdAt: r.created_at
    }))
  }
}
