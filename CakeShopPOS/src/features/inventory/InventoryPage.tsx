import React, { useState, useEffect } from 'react'
import { Package, AlertTriangle, PlusCircle, RefreshCw } from 'lucide-react'
import { Modal, Form, Select, InputNumber, Input, message } from 'antd'
import { useAppStore } from '../../store/appStore'
import { Product } from '../../types/product'

export const InventoryPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  const [products, setProducts] = useState<Product[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const loadInventory = async () => {
    if (!currentShop) return
    try {
      if (window.electronAPI) {
        const [prods, lowStock] = await Promise.all([
          window.electronAPI.dbQuery('db:get-products', currentShop.id),
          window.electronAPI.dbQuery('db:get-low-stock', currentShop.id)
        ])
        setProducts(prods || [])
        setLowStockItems(lowStock || [])
      } else {
        // Demo fallback
        const demo: Product[] = [
          { id: 'p1', shop_id: currentShop.id, category_id: 'c1', name: 'Black Forest Cake 1kg', price: 3800, barcode: '001', unit: 'pcs', current_stock: 12, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p2', shop_id: currentShop.id, category_id: 'c1', name: 'Red Velvet Gateau 1kg', price: 4200, barcode: '002', unit: 'pcs', current_stock: 3, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p3', shop_id: currentShop.id, category_id: 'c2', name: 'Spicy Chicken Pastry', price: 220, barcode: '004', unit: 'pcs', current_stock: 0, track_inventory: true, is_active: true, category_name: 'Pastries', category_color: '#f59e0b' },
        ]
        setProducts(demo)
        setLowStockItems(demo.filter(p => (p.current_stock ?? 0) <= 5).map(p => ({ product_name: p.name })))
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
    }
  }

  useEffect(() => { loadInventory() }, [currentShop?.id])

  const handleRecordMovement = async (values: any) => {
    if (!currentShop) return
    try {
      if (window.electronAPI) {
        await window.electronAPI.dbQuery('db:record-stock-movement', {
          shopId: currentShop.id,
          productId: values.product_id,
          type: values.type,
          quantity: values.quantity,
          note: values.note || '',
          doneBy: currentUser?.id
        })
      }
      message.success('Stock movement recorded!')
      setIsModalOpen(false)
      form.resetFields()
      loadInventory()
    } catch (err: any) {
      message.error(err.message || 'Failed to record stock movement')
    }
  }

  const tracked = products.filter((p) => p.track_inventory)
  const outCount = tracked.filter(p => (p.current_stock ?? 0) <= 0).length
  const lowCount = tracked.filter(p => (p.current_stock ?? 0) > 0 && (p.current_stock ?? 0) <= 5).length
  const okCount = tracked.filter(p => (p.current_stock ?? 0) > 5).length

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
            Real-time on-hand stock and movement auditing · {currentShop?.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1.5px solid var(--primary)', boxShadow: 'none' }}
            onClick={loadInventory}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <PlusCircle size={15} /> Record Stock Movement
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Tracked Items</div>
          <div className="kpi-value">{tracked.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">In Stock</div>
          <div className="kpi-value green">{okCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Low Stock</div>
          <div className="kpi-value amber">{lowCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Out of Stock</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{outCount}</div>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="alert-banner warning" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            <strong>{lowStockItems.length} items running low on stock!</strong>
          </div>
          <span style={{ fontSize: 11, opacity: 0.8 }}>
            {lowStockItems.map((i) => i.product_name).join(', ')}
          </span>
        </div>
      )}

      {/* Inventory Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Alert Level</th>
              <th>Current Stock</th>
              <th style={{ textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
        </table>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {tracked.map((product) => {
                const isLow = (product.current_stock ?? 0) <= 5 && (product.current_stock ?? 0) > 0
                const isOut = (product.current_stock ?? 0) <= 0
                return (
                  <tr key={product.id}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {product.name}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                        {product.category_name}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {product.unit}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      5 {product.unit}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        fontSize: 16, fontWeight: 900,
                        color: isOut ? 'var(--danger)' : isLow ? '#92400e' : 'var(--primary-dark)'
                      }}>
                        {product.current_stock}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{product.unit}</span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <span className={`badge ${isOut ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'}`}>
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title="Record Stock Movement"
        okText="Record Movement"
        okButtonProps={{ style: { background: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 700 } }}
        centered
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleRecordMovement} style={{ paddingTop: 8 }}>
          <Form.Item name="product_id" label="Select Cake Item" rules={[{ required: true, message: 'Please select a product' }]}>
            <Select placeholder="Choose cake item">
              {tracked.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name} (Current: {p.current_stock} {p.unit})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="Movement Type" initialValue="IN" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="IN">Stock In / Received (+)</Select.Option>
              <Select.Option value="DAMAGE">Damage / Wastage (-)</Select.Option>
              <Select.Option value="RETURN">Customer Return (+)</Select.Option>
              <Select.Option value="ADJUST">Inventory Count Adjustment</Select.Option>
            </Select>
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Enter quantity' }]}>
              <InputNumber min={0.1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="note" label="Note / Reason">
              <Input placeholder="e.g. Morning bake batch" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
