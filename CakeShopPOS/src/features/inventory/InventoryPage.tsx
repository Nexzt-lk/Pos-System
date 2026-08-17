import React, { useState, useEffect } from 'react'
import { Package, AlertTriangle, ArrowDownRight, ArrowUpRight, PlusCircle } from 'lucide-react'
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
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [currentShop?.id])

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
      message.success('Stock movement recorded successfully')
      setIsModalOpen(false)
      form.resetFields()
      loadInventory()
    } catch (err: any) {
      message.error(err.message || 'Failed to record stock movement')
    }
  }

  return (
    <div className="flex h-full w-full flex-col p-6 overflow-hidden space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package size={22} className="text-brand-400" />
            <span>Stock & Inventory Ledger</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time on-hand stock and movement auditing for {currentShop?.name}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg glow-pink hover:bg-brand-600 active:scale-95 transition-all"
        >
          <PlusCircle size={16} />
          <span>Record Stock In / Adjustment</span>
        </button>
      </div>

      {/* Low Stock Alert Banner (If items exist) */}
      {lowStockItems.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-400 animate-pulse" />
            <span className="font-bold">
              {lowStockItems.length} cake items running low on stock!
            </span>
          </div>
          <span className="text-[11px] text-amber-400/80">
            {lowStockItems.map((i) => i.product_name).join(', ')}
          </span>
        </div>
      )}

      {/* Inventory Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 backdrop-blur-md">
            <tr>
              <th className="p-3.5">Product Name</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Unit</th>
              <th className="p-3.5">Min Alert Level</th>
              <th className="p-3.5">Current Stock</th>
              <th className="p-3.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {products
              .filter((p) => p.track_inventory)
              .map((product) => {
                const isLow = (product.current_stock ?? 0) <= 5
                const isOut = (product.current_stock ?? 0) <= 0
                return (
                  <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">{product.name}</td>
                    <td className="p-3.5 text-slate-400">{product.category_name}</td>
                    <td className="p-3.5 font-mono text-slate-400">{product.unit}</td>
                    <td className="p-3.5 text-slate-400">5 {product.unit}</td>
                    <td className="p-3.5 text-base font-extrabold">
                      <span className={isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}>
                        {product.current_stock}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          isOut
                            ? 'bg-rose-500/20 text-rose-300'
                            : isLow
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Movement Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title="Record Stock Movement"
        centered
        className="dark-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleRecordMovement} className="pt-2">
          <Form.Item
            name="product_id"
            label={<span className="text-slate-300">Select Cake Item</span>}
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select placeholder="Choose cake item">
              {products
                .filter((p) => p.track_inventory)
                .map((p) => (
                  <Select.Option key={p.id} value={p.id}>
                    {p.name} (Current: {p.current_stock} {p.unit})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="type"
            label={<span className="text-slate-300">Movement Type</span>}
            initialValue="IN"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="IN">Stock In / Received (+)</Select.Option>
              <Select.Option value="DAMAGE">Damage / Wastage (-)</Select.Option>
              <Select.Option value="RETURN">Customer Return (+)</Select.Option>
              <Select.Option value="ADJUST">Inventory Count Adjustment</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label={<span className="text-slate-300">Quantity</span>}
            rules={[{ required: true, message: 'Enter quantity' }]}
          >
            <InputNumber min={0.1} step={1} className="w-full" />
          </Form.Item>

          <Form.Item name="note" label={<span className="text-slate-300">Note / Reason</span>}>
            <Input placeholder="e.g. Morning bake batch #2" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
