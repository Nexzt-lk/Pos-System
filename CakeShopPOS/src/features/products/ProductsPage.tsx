import React, { useState, useEffect } from 'react'
import { Plus, Search, Cake, Edit, Package2 } from 'lucide-react'
import { Modal, Form, Input, InputNumber, Select, Switch, message } from 'antd'
import { Product, Category } from '../../types/product'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'
import { v4 as uuidv4 } from 'uuid'

export const ProductsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
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
        ])
        setProducts([
          { id: 'p1', shop_id: currentShop.id, category_id: 'c1', name: 'Black Forest Cake 1kg', price: 3800, cost_price: 2200, barcode: '4790001001', unit: 'pcs', current_stock: 12, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p2', shop_id: currentShop.id, category_id: 'c1', name: 'Red Velvet Gateau 1kg', price: 4200, cost_price: 2600, barcode: '4790001002', unit: 'pcs', current_stock: 3, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p3', shop_id: currentShop.id, category_id: 'c2', name: 'Spicy Chicken Pastry', price: 220, cost_price: 100, barcode: '4790001004', unit: 'pcs', current_stock: 35, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', category_color: '#f59e0b' },
        ])
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  useEffect(() => { loadData() }, [currentShop?.id])

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      form.setFieldsValue({ ...product, track_inventory: product.track_inventory })
    } else {
      setEditingProduct(null)
      form.resetFields()
      form.setFieldsValue({ track_inventory: true, unit: 'pcs', price: 0 })
    }
    setIsModalOpen(true)
  }

  const handleSaveProduct = async (values: any) => {
    if (!currentShop) return
    try {
      const payload = {
        id: editingProduct?.id || uuidv4(),
        shop_id: currentShop.id,
        category_id: values.category_id,
        name: values.name,
        description: values.description || '',
        price: values.price,
        cost_price: values.cost_price || 0,
        barcode: values.barcode || '',
        unit: values.unit || 'pcs',
        track_inventory: values.track_inventory ? 1 : 0,
        is_active: 1
      }
      if (window.electronAPI) await window.electronAPI.dbQuery('db:upsert-product', payload)
      message.success(editingProduct ? 'Product updated!' : 'Product added!')
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.message || 'Failed to save product')
    }
  }

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  )

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <div className="page-title-icon"><Cake size={18} /></div>
            Product Catalog & Pricing
          </div>
          <div className="page-subtitle">
            Manage cake items, prices, barcodes and margins · {currentShop?.name}
          </div>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={15} /> Add New Product
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flexShrink: 0 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Products</div>
          <div className="kpi-value blue">{products.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Low Stock Items</div>
          <div className="kpi-value amber">
            {products.filter(p => p.track_inventory && (p.current_stock ?? 0) <= 5).length}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Categories</div>
          <div className="kpi-value green">{categories.length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="search-box" style={{ width: '100%', maxWidth: 360, flexShrink: 0 }}>
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name or barcode..."
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
                const isLow = product.track_inventory && (product.current_stock ?? 0) <= 5 && (product.current_stock ?? 0) > 0
                const isOut = product.track_inventory && (product.current_stock ?? 0) <= 0
                return (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {product.name}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span className="badge badge-cat"
                        style={{ backgroundColor: product.category_color || '#16a34a' }}>
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
                      {product.track_inventory ? (
                        <span className={`badge ${isOut ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'}`}>
                          {isOut ? 'Out of Stock' : `${product.current_stock} ${product.unit}`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>Service</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenModal(product)}
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
                          background: 'transparent', cursor: 'pointer', display: 'inline-flex',
                          alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-bg)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <Edit size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <Package2 size={32} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title={editingProduct ? '✏️ Edit Product' : '➕ Add New Cake Product'}
        okText="Save Product"
        okButtonProps={{ style: { background: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 700 } }}
        centered
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveProduct} style={{ paddingTop: 8 }}>
          <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Please enter product name' }]}>
            <Input placeholder="e.g. Chocolate Fudge Cake 1kg" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="category_id" label="Category" rules={[{ required: true, message: 'Select category' }]}>
              <Select placeholder="Select category">
                {categories.map((c) => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="barcode" label="Barcode">
              <Input placeholder="Scan or leave blank" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="price" label="Selling Price (Rs.)" rules={[{ required: true, message: 'Enter price' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cost_price" label="Cost Price (Rs.)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" initialValue="pcs">
              <Select>
                <Select.Option value="pcs">pcs</Select.Option>
                <Select.Option value="kg">kg</Select.Option>
                <Select.Option value="slice">slice</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="track_inventory" valuePropName="checked" label="Track Stock / Inventory?">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
