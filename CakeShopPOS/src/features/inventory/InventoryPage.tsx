import React, { useState, useEffect } from 'react'
import { Plus, Search, Package, Package2, Sparkles, Boxes, PlusCircle } from 'lucide-react'
import { Modal, Form, Select, InputNumber, Input, Segmented, message } from 'antd'
import { Product, Category } from '../../types/product'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'
import { v4 as uuidv4 } from 'uuid'

export const InventoryPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<'EXISTING' | 'NEW'>('EXISTING')
  const [form] = Form.useForm()

  const loadData = async () => {
    if (!currentShop) return
    try {
      if (window.electronAPI) {
        const [prods, cats] = await Promise.all([
          window.electronAPI.dbQuery('db:get-products', currentShop.id),
          window.electronAPI.dbQuery('db:get-categories', currentShop.id)
        ])
        setProducts(prods || [])
        setCategories(cats || [])
      } else {
        setCategories([
          { id: 'c1', shop_id: currentShop.id, name: 'Signature Cakes', color: '#ec4899', sort_order: 1, is_active: true },
          { id: 'c2', shop_id: currentShop.id, name: 'Pastries & Savories', color: '#f59e0b', sort_order: 2, is_active: true },
          { id: 'c3', shop_id: currentShop.id, name: 'Desserts & Sweets', color: '#8b5cf6', sort_order: 3, is_active: true }
        ])
        setProducts([
          { id: 'p1', shop_id: currentShop.id, category_id: 'c1', name: 'Black Forest Cake 1kg', price: 3800, cost_price: 2200, barcode: '4790001001', unit: 'pcs', current_stock: 12, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p2', shop_id: currentShop.id, category_id: 'c1', name: 'Red Velvet Gateau 1kg', price: 4200, cost_price: 2600, barcode: '4790001002', unit: 'pcs', current_stock: 3, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p3', shop_id: currentShop.id, category_id: 'c2', name: 'Spicy Chicken Pastry', price: 220, cost_price: 110, barcode: '4790001004', unit: 'pcs', current_stock: 0, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', category_color: '#f59e0b' },
          { id: 'p4', shop_id: currentShop.id, category_id: 'c2', name: 'Fish Bun', price: 120, cost_price: 60, barcode: '4790001005', unit: 'pcs', current_stock: 45, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', category_color: '#f59e0b' }
        ])
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentShop?.id])

  const handleOpenMovementModal = (product?: Product) => {
    form.resetFields()
    if (product) {
      setEntryMode('EXISTING')
      form.setFieldsValue({
        product_id: product.id,
        type: 'IN',
        quantity: 1,
        note: ''
      })
    } else {
      setEntryMode('EXISTING')
      form.setFieldsValue({
        product_id: products[0]?.id || undefined,
        type: 'IN',
        quantity: 1,
        note: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSaveMovement = async (values: any) => {
    if (!currentShop) return

    try {
      if (entryMode === 'EXISTING') {
        if (!values.product_id) {
          message.error('Please select a product')
          return
        }

        if (window.electronAPI) {
          await window.electronAPI.dbQuery('db:record-stock-movement', {
            shopId: currentShop.id,
            productId: values.product_id,
            type: values.type,
            quantity: Number(values.quantity),
            note: values.note || '',
            costPerUnit: values.cost_price ? Number(values.cost_price) : undefined,
            doneBy: currentUser?.id
          })
        } else {
          // In-memory demo fallback
          setProducts((prev) =>
            prev.map((p) => {
              if (p.id === values.product_id) {
                const cur = p.current_stock ?? 0
                const delta = values.type === 'IN' || values.type === 'RETURN'
                  ? Number(values.quantity)
                  : values.type === 'ADJUST'
                  ? Number(values.quantity) - cur
                  : -Number(values.quantity)
                return { ...p, current_stock: Math.max(0, cur + delta) }
              }
              return p
            })
          )
        }

        message.success('Stock movement recorded!')
      } else {
        // NEW ITEM MODE
        const newProductId = uuidv4()
        const selectedCat = categories.find(c => c.id === values.new_category_id)

        const productPayload = {
          id: newProductId,
          shop_id: currentShop.id,
          category_id: values.new_category_id || null,
          name: values.new_name.trim(),
          description: values.new_description || '',
          price: Number(values.new_price) || 0,
          cost_price: Number(values.new_cost_price) || 0,
          barcode: values.new_barcode ? values.new_barcode.trim() : null,
          unit: values.new_unit || 'pcs',
          track_inventory: 1,
          is_active: 1
        }

        if (window.electronAPI) {
          // 1. Create the new product
          await window.electronAPI.dbQuery('db:upsert-product', productPayload)

          // 2. Record initial stock movement
          const initQty = Number(values.new_quantity) || 0
          if (initQty > 0) {
            await window.electronAPI.dbQuery('db:record-stock-movement', {
              shopId: currentShop.id,
              productId: newProductId,
              type: 'IN',
              quantity: initQty,
              note: values.new_note || 'New item initial stock arrival',
              costPerUnit: Number(values.new_cost_price) || undefined,
              doneBy: currentUser?.id
            })
          }
        } else {
          const newDemoProduct: Product = {
            ...productPayload,
            track_inventory: true,
            is_active: true,
            current_stock: Number(values.new_quantity) || 0,
            category_name: selectedCat?.name || 'General',
            category_color: selectedCat?.color || '#ec4899'
          }
          setProducts((prev) => [newDemoProduct, ...prev])
        }

        message.success(`New product "${values.new_name}" created & stock added!`)
      }

      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Failed to save stock movement:', err)
      message.error(err.message || 'Failed to record stock movement')
    }
  }

  const tracked = products.filter((p) => p.track_inventory)
  const lowCount = tracked.filter(p => (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0).length
  const outCount = tracked.filter(p => (p.current_stock ?? 0) <= 0).length

  const filtered = tracked.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  )

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <div className="page-title-icon"><Package size={18} /></div>
            Stock & Inventory Ledger
          </div>
          <div className="page-subtitle">
            Manage on-hand quantities, stock levels and movements · {currentShop?.name}
          </div>
        </div>
        <button className="btn-primary" onClick={() => handleOpenMovementModal()}>
          <Plus size={15} /> Record Stock Movement
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flexShrink: 0 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Tracked Products</div>
          <div className="kpi-value blue">{tracked.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Low Stock Items</div>
          <div className="kpi-value amber">{lowCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Out of Stock Items</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{outCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="search-box" style={{ width: '100%', maxWidth: 360, flexShrink: 0 }}>
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search inventory by product name or barcode..."
        />
      </div>

      {/* Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Barcode</th>
              <th>Selling Price</th>
              <th>Cost Price</th>
              <th>Stock</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
        </table>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {filtered.map((product) => {
                const isLow = (product.current_stock ?? 0) <= 5 && (product.current_stock ?? 0) > 0
                const isOut = (product.current_stock ?? 0) <= 0
                return (
                  <tr
                    key={product.id}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {product.name}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span
                        className="badge badge-cat"
                        style={{ backgroundColor: product.category_color || '#16a34a' }}
                      >
                        {product.category_name || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>
                      {product.barcode || '-'}
                    </td>
                    <td style={{ padding: '11px 16px', fontWeight: 800, color: 'var(--primary-dark)' }}>
                      {formatCurrency(product.price)}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {product.cost_price ? formatCurrency(product.cost_price) : '-'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span className={`badge ${isOut ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'}`}>
                        {isOut ? 'Out of Stock' : `${product.current_stock ?? 0} ${product.unit}`}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenMovementModal(product)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--primary-bg)'
                          e.currentTarget.style.color = 'var(--primary)'
                          e.currentTarget.style.borderColor = 'var(--primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }}
                      >
                        <PlusCircle size={13} /> Stock Movement
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <Package2 size={32} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                    No inventory products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title={entryMode === 'NEW' ? 'Receive & Add New Cake Item' : 'Record Stock Movement'}
        okText={entryMode === 'NEW' ? 'Save Product & Stock' : 'Record Movement'}
        okButtonProps={{
          style: {
            background: 'var(--primary)',
            borderColor: 'var(--primary)',
            fontWeight: 700
          }
        }}
        centered
        width={520}
      >
        {/* Mode Switcher */}
        <div style={{ margin: '14px 0 16px 0' }}>
          <Segmented
            block
            value={entryMode}
            onChange={(val) => {
              const mode = val as 'EXISTING' | 'NEW'
              setEntryMode(mode)
              if (mode === 'NEW') {
                form.setFieldsValue({
                  new_unit: 'pcs',
                  new_category_id: categories[0]?.id || undefined,
                  new_quantity: 10,
                  new_price: 0,
                  new_cost_price: 0,
                  new_note: 'Initial stock receipt'
                })
              } else {
                form.setFieldsValue({
                  type: 'IN',
                  quantity: 1
                })
              }
            }}
            options={[
              {
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0', fontWeight: 600 }}>
                    <Boxes size={14} />
                    <span>Existing Item (දැනට ඇති Item)</span>
                  </div>
                ),
                value: 'EXISTING'
              },
              {
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0', fontWeight: 700 }}>
                    <Sparkles size={14} />
                    <span>+ New Item (අලුත්ම Item එකක්)</span>
                  </div>
                ),
                value: 'NEW'
              }
            ]}
          />
        </div>

        <Form form={form} layout="vertical" onFinish={handleSaveMovement} style={{ paddingTop: 4 }}>
          {entryMode === 'EXISTING' ? (
            <>
              <Form.Item
                name="product_id"
                label="Select Product"
                rules={[{ required: true, message: 'Please select a product' }]}
              >
                <Select
                  placeholder="Choose or search product..."
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={tracked.map((p) => ({
                    value: p.id,
                    label: `${p.name} (Current: ${p.current_stock ?? 0} ${p.unit})`
                  }))}
                />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item name="type" label="Movement Type" initialValue="IN" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="IN">Stock In / Received (+)</Select.Option>
                    <Select.Option value="DAMAGE">Damage / Wastage (-)</Select.Option>
                    <Select.Option value="RETURN">Customer Return (+)</Select.Option>
                    <Select.Option value="ADJUST">Stock Count Adjustment</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="quantity"
                  label="Quantity"
                  rules={[{ required: true, message: 'Enter quantity' }]}
                  initialValue={1}
                >
                  <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item name="cost_price" label="Cost Price (Rs. - Optional)">
                  <InputNumber min={0} placeholder="e.g. 2500" style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="note" label="Note / Batch Reference">
                  <Input placeholder="e.g. Morning bake batch" />
                </Form.Item>
              </div>
            </>
          ) : (
            <>
              {/* NEW ITEM FORM */}
              <Form.Item
                name="new_name"
                label="Product Name"
                rules={[{ required: true, message: 'Please enter product name' }]}
              >
                <Input placeholder="e.g. Blueberry Cheesecake 1kg" />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item
                  name="new_category_id"
                  label="Category"
                  rules={[{ required: true, message: 'Select category' }]}
                >
                  <Select placeholder="Select category">
                    {categories.map((c) => (
                      <Select.Option key={c.id} value={c.id}>
                        {c.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="new_barcode" label="Barcode (Optional)">
                  <Input placeholder="Scan or leave blank" />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Form.Item
                  name="new_price"
                  label="Selling Price (Rs.)"
                  rules={[{ required: true, message: 'Enter price' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="new_cost_price" label="Cost Price (Rs.)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="new_unit" label="Unit" initialValue="pcs">
                  <Select>
                    <Select.Option value="pcs">pcs</Select.Option>
                    <Select.Option value="kg">kg</Select.Option>
                    <Select.Option value="slice">slice</Select.Option>
                  </Select>
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item
                  name="new_quantity"
                  label="Initial Stock Received"
                  rules={[{ required: true, message: 'Enter initial stock quantity' }]}
                  initialValue={10}
                >
                  <InputNumber min={0} step={1} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="new_note" label="Note / Supplier Info">
                  <Input placeholder="e.g. Initial supplier batch" />
                </Form.Item>
              </div>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
