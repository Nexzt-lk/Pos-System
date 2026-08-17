import React, { useState, useEffect } from 'react'
import { Plus, Search, Cake, Tag, Edit, Trash2 } from 'lucide-react'
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
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentShop?.id])

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      form.setFieldsValue({
        ...product,
        track_inventory: product.track_inventory
      })
    } else {
      setEditingProduct(null)
      form.resetFields()
      form.setFieldsValue({
        track_inventory: true,
        unit: 'pcs',
        price: 0
      })
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

      if (window.electronAPI) {
        await window.electronAPI.dbQuery('db:upsert-product', payload)
      }

      message.success(editingProduct ? 'Product updated successfully' : 'Product added successfully')
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.message || 'Failed to save product')
    }
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  )

  return (
    <div className="flex h-full w-full flex-col p-6 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cake size={22} className="text-brand-400" />
            <span>Product Catalog & Pricing</span>
          </h2>
          <p className="text-xs text-slate-400">
            Manage cake items, prices, barcodes and profit margins for {currentShop?.name}
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg glow-pink hover:bg-brand-600 active:scale-95 transition-all"
        >
          <Plus size={16} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="my-4 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or barcode..."
            className="w-full rounded-xl bg-slate-900 pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 border border-slate-700/80 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 backdrop-blur-md">
            <tr>
              <th className="p-3.5">Product Name</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Barcode</th>
              <th className="p-3.5">Selling Price</th>
              <th className="p-3.5">Cost Price</th>
              <th className="p-3.5">Stock</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-bold text-white">{product.name}</td>
                <td className="p-3.5">
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: product.category_color || '#6366f1' }}
                  >
                    {product.category_name || 'General'}
                  </span>
                </td>
                <td className="p-3.5 font-mono text-slate-400">{product.barcode || '-'}</td>
                <td className="p-3.5 font-bold text-brand-400">{formatCurrency(product.price)}</td>
                <td className="p-3.5 text-slate-400">{formatCurrency(product.cost_price)}</td>
                <td className="p-3.5">
                  {product.track_inventory ? (
                    <span
                      className={`font-semibold ${
                        (product.current_stock ?? 0) <= 5 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {product.current_stock} {product.unit}
                    </span>
                  ) : (
                    <span className="text-slate-500">Service</span>
                  )}
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => handleOpenModal(product)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                  >
                    <Edit size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title={editingProduct ? 'Edit Product' : 'Add New Cake Product'}
        centered
        className="dark-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleSaveProduct} className="pt-2">
          <Form.Item
            name="name"
            label={<span className="text-slate-300">Product Name</span>}
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="e.g. Chocolate Fudge Cake 1kg" className="rounded-xl" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="category_id"
              label={<span className="text-slate-300">Category</span>}
              rules={[{ required: true, message: 'Select category' }]}
            >
              <Select placeholder="Select category" className="rounded-xl">
                {categories.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="barcode" label={<span className="text-slate-300">Barcode</span>}>
              <Input placeholder="Barcode scan or leave blank" className="rounded-xl" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="price"
              label={<span className="text-slate-300">Selling Price (Rs.)</span>}
              rules={[{ required: true, message: 'Enter selling price' }]}
            >
              <InputNumber min={0} className="w-full rounded-xl" />
            </Form.Item>

            <Form.Item name="cost_price" label={<span className="text-slate-300">Cost Price (Rs.)</span>}>
              <InputNumber min={0} className="w-full rounded-xl" />
            </Form.Item>
          </div>

          <Form.Item
            name="track_inventory"
            valuePropName="checked"
            label={<span className="text-slate-300">Track Stock / Inventory?</span>}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
