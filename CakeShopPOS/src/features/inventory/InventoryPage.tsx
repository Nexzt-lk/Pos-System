import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Package,
  Package2,
  Sparkles,
  Boxes,
  PlusCircle,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ArrowUpDown,
  RefreshCw,
  Barcode,
  TrendingUp,
  Tag,
  DollarSign
} from 'lucide-react'
import { Modal, Form, Select, InputNumber, Input, Segmented, message } from 'antd'
import { Product, Category, normalizeProduct, normalizeCategory } from '../../types/product'
import { productsApi } from '../../api/productsApi'
import { categoriesApi } from '../../api/categoriesApi'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatStockQty } from '../../lib/formatters'
import { generateCategoryItemCode } from '../../lib/skuGenerator'

export const InventoryPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc'>('stock_asc')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<'EXISTING' | 'NEW'>('EXISTING')
  const [isLoading, setIsLoading] = useState(false)
  
  const [form] = Form.useForm()

  const loadData = async () => {
    if (!currentShop) return
    setIsLoading(true)
    try {
      const [rawProds, rawCats] = await Promise.all([
        productsApi.getAll(true).catch(() => []),
        categoriesApi.getAll().catch(() => [])
      ])

      const cats = rawCats.map((c) => normalizeCategory(c, currentShop.id))
      const catMap = new Map(cats.map((c) => [c.id, c]))

      const prods = rawProds.map((p) => {
        const norm = normalizeProduct(p, currentShop.id)
        if (norm.category_id && catMap.has(norm.category_id)) {
          const cat = catMap.get(norm.category_id)!
          norm.category_name = cat.name
          norm.category_color = cat.color
        }
        return norm
      })

      setProducts(prods)
      setCategories(cats)
    } catch (err) {
      console.error('Failed to load inventory:', err)
      message.error('Failed to load inventory from server')
    } finally {
      setIsLoading(false)
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
        note: '',
        cost_price: product.cost_price || undefined
      })
    } else {
      setEntryMode('EXISTING')
      form.setFieldsValue({
        product_id: products.find(p => p.track_inventory)?.id || undefined,
        type: 'IN',
        quantity: 1,
        note: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleCategorySelectForNewItem = (categoryId: string) => {
    const chosenCat = categories.find((c) => c.id === categoryId)
    const autoCode = generateCategoryItemCode(chosenCat, products)
    form.setFieldsValue({ new_barcode: autoCode })
  }

  const handleRegenerateNewItemCode = () => {
    const curCatId = form.getFieldValue('new_category_id') || categories[0]?.id
    const chosenCat = categories.find((c) => c.id === curCatId)
    const autoCode = generateCategoryItemCode(chosenCat, products)
    form.setFieldsValue({ new_barcode: autoCode })
    message.success(`Generated code: ${autoCode}`)
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
        }
        message.success('Stock movement recorded successfully!')
      } else {
        // NEW ITEM MODE via Backend API
        const selectedCat = categories.find((c) => c.id === values.new_category_id)
        const itemCode = values.new_barcode ? values.new_barcode.trim() : generateCategoryItemCode(selectedCat, products)

        await productsApi.create({
          categoryId: values.new_category_id,
          name: values.new_name.trim(),
          description: values.new_description || '',
          price: Number(values.new_price) || 0,
          costPrice: Number(values.new_cost_price) || 0,
          barcode: itemCode,
          unit: values.new_unit || 'pcs',
          trackInventory: true,
          initialStock: Number(values.new_quantity) || 0,
          minStockAlert: 5
        })

        message.success(`New item "${values.new_name}" created via Backend API!`)
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error('Failed to save stock movement:', err)
      message.error(err.message || 'Failed to save movement')
    }
  }

  const tracked = useMemo(() => products.filter((p) => p.track_inventory), [products])
  const inStockCount = useMemo(() => tracked.filter((p) => (p.current_stock ?? 0) > 5).length, [tracked])
  const lowStockCount = useMemo(() => tracked.filter((p) => (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0).length, [tracked])
  const outOfStockCount = useMemo(() => tracked.filter((p) => (p.current_stock ?? 0) <= 0).length, [tracked])

  // Category counts for tracked inventory
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    tracked.forEach((p) => {
      const catId = p.category_id || 'uncategorized'
      counts[catId] = (counts[catId] || 0) + 1
    })
    return counts
  }, [tracked])

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return tracked
      .filter((p) => {
        const matchSearch =
          searchQuery === '' ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.category_name && p.category_name.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory

        let matchStock = true
        if (stockFilter === 'in_stock') {
          matchStock = (p.current_stock ?? 0) > 5
        } else if (stockFilter === 'low_stock') {
          matchStock = (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0
        } else if (stockFilter === 'out_of_stock') {
          matchStock = (p.current_stock ?? 0) <= 0
        }

        return matchSearch && matchCat && matchStock
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
        if (sortBy === 'stock_asc') return (a.current_stock ?? 0) - (b.current_stock ?? 0)
        if (sortBy === 'stock_desc') return (b.current_stock ?? 0) - (a.current_stock ?? 0)
        if (sortBy === 'price_desc') return b.price - a.price
        return 0
      })
  }, [tracked, searchQuery, selectedCategory, stockFilter, sortBy])

  return (
    <div className="page-container" style={{ padding: '18px 24px', gap: 16 }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="page-title" style={{ fontSize: 20 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                border: '1px solid #bfdbfe'
              }}
            >
              <Package size={20} />
            </div>
            <span>Stock & Inventory Ledger</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#1e40af',
                background: '#eff6ff',
                border: '1px solid #dbeafe',
                padding: '2px 8px',
                borderRadius: 99,
                marginLeft: 4
              }}
            >
              {tracked.length} Items Tracked
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            Monitor real-time on-hand stock quantities, stock arrivals, wastage, and inventory levels ·{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{currentShop?.name || 'Main Branch'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => loadData()}
            title="Refresh Inventory"
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 10,
              border: '1.5px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.color = 'var(--primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => handleOpenMovementModal()}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Record Stock Movement</span>
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flexShrink: 0 }}>
        {/* Total Tracked */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tracked Items
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {tracked.length}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
              Active stock SKUs
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}
          >
            <Package2 size={22} />
          </div>
        </div>

        {/* In Good Stock */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Healthy Stock
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 2 }}>
              {inStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>
              Over 5 units available
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a'
            }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Low Stock Items */}
        <div
          style={{
            background: lowStockCount > 0 ? '#fffbeb' : '#ffffff',
            border: lowStockCount > 0 ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Low Stock Alert
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
              {lowStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 1 }}>
              Re-stock recommended
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}
          >
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Out of Stock */}
        <div
          style={{
            background: outOfStockCount > 0 ? '#fef2f2' : '#ffffff',
            border: outOfStockCount > 0 ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Out of Stock
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 2 }}>
              {outOfStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 1 }}>
              0 units on shelf
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626'
            }}
          >
            <AlertOctagon size={22} />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: '#ffffff',
          padding: '12px 16px',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div
            className="search-box"
            style={{
              width: 340,
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 10,
              padding: '7px 12px'
            }}
          >
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inventory by product name, code, barcode..."
              style={{ fontSize: 13 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 4px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Stock Filter Pills & Sort Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Stock Segmented */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>
                Status:
              </span>
              <Segmented
                value={stockFilter}
                onChange={(val) => setStockFilter(val as any)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: `Healthy (${inStockCount})`, value: 'in_stock' },
                  { label: `Low (${lowStockCount})`, value: 'low_stock' },
                  { label: `Out (${outOfStockCount})`, value: 'out_of_stock' }
                ]}
                style={{ background: '#f1f5f9', fontWeight: 600, fontSize: 12 }}
              />
            </div>

            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
              <Select
                value={sortBy}
                onChange={(val) => setSortBy(val)}
                style={{ width: 175 }}
                options={[
                  { value: 'stock_asc', label: 'Stock (Lowest First)' },
                  { value: 'stock_desc', label: 'Stock (Highest First)' },
                  { value: 'name_asc', label: 'Name (A to Z)' },
                  { value: 'name_desc', label: 'Name (Z to A)' },
                  { value: 'price_desc', label: 'Price (Highest First)' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingTop: 2, paddingBottom: 2 }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              border: selectedCategory === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              background: selectedCategory === 'all' ? 'var(--primary)' : '#ffffff',
              color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              boxShadow: selectedCategory === 'all' ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none'
            }}
          >
            <span>All Categories</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 99,
                background: selectedCategory === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              {tracked.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id
            const count = categoryCounts[cat.id] || 0
            const catColor = cat.color || '#16a34a'
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: isSelected ? `1.5px solid ${catColor}` : '1px solid var(--border)',
                  background: isSelected ? catColor : '#ffffff',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? `0 2px 8px ${catColor}40` : 'none'
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isSelected ? '#ffffff' : catColor,
                    display: 'inline-block'
                  }}
                />
                <span>{cat.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Inventory Table ── */}
      <div
        className="data-table"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          background: '#ffffff'
        }}
      >
        <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '13px 18px', width: '30%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Product Name
                </th>
                <th style={{ padding: '13px 16px', width: '16%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Category
                </th>
                <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Item Code / Barcode
                </th>
                <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Selling Price
                </th>
                <th style={{ padding: '13px 16px', width: '12%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cost Price
                </th>
                <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  On-Hand Stock
                </th>
                <th style={{ padding: '13px 18px', textAlign: 'right', width: '10%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Action
                </th>
              </tr>
            </thead>
          </table>

          <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {filteredProducts.map((product) => {
                  const stockNum = product.current_stock ?? 0
                  const isLow = stockNum <= 5 && stockNum > 0
                  const isOut = stockNum <= 0
                  const catColor = product.category_color || '#16a34a'

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      {/* Product Name + Icon */}
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: `${catColor}15`,
                              border: `1px solid ${catColor}30`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: catColor,
                              fontWeight: 800,
                              fontSize: 14,
                              flexShrink: 0
                            }}
                          >
                            <Package size={18} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                fontSize: 13.5,
                                lineHeight: 1.3
                              }}
                            >
                              {product.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                              Unit: <strong style={{ color: '#475569' }}>{product.unit}</strong>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 99,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: `${catColor}14`,
                            color: catColor,
                            border: `1px solid ${catColor}30`
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: catColor }} />
                          {product.category_name || 'General'}
                        </span>
                      </td>

                      {/* Barcode / SKU */}
                      <td style={{ padding: '12px 16px' }}>
                        {product.barcode ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Barcode size={14} style={{ color: '#94a3b8' }} />
                            <span
                              style={{
                                fontFamily: 'monospace',
                                color: '#334155',
                                fontSize: 12,
                                fontWeight: 700,
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                padding: '2px 7px',
                                borderRadius: 6
                              }}
                            >
                              {product.barcode}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: 14 }}>
                          {formatCurrency(product.price)}
                        </div>
                      </td>

                      {/* Cost Price */}
                      <td style={{ padding: '12px 16px' }}>
                        {product.cost_price ? (
                          <span style={{ color: '#64748b', fontWeight: 600, fontSize: 12.5 }}>
                            {formatCurrency(product.cost_price)}
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* On-Hand Stock */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 800,
                            background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
                            color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                            border: `1.5px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#bbf7d0'}`
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e'
                            }}
                          />
                          {isOut ? '0 units (Out of Stock)' : formatStockQty(product.current_stock, product.unit)}
                        </span>
                      </td>

                      {/* Quick Action */}
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenMovementModal(product)}
                          title="Record Stock Movement"
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--primary)',
                            background: 'var(--primary-bg)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--primary-dark)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--primary)'
                            e.currentTarget.style.color = '#ffffff'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--primary-bg)'
                            e.currentTarget.style.color = 'var(--primary-dark)'
                          }}
                        >
                          <PlusCircle size={14} />
                          <span>Movement</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 16,
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 12px',
                          color: '#94a3b8'
                        }}
                      >
                        <Package2 size={28} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        No Inventory Records Found
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360, margin: '4px auto 16px' }}>
                        {searchQuery
                          ? `No inventory items matching "${searchQuery}".`
                          : 'No tracked items found for this selection.'}
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('')
                            setSelectedCategory('all')
                            setStockFilter('all')
                          }}
                          style={{
                            padding: '7px 16px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer'
                          }}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Movement Modal ── */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #86efac'
              }}
            >
              {entryMode === 'NEW' ? <Sparkles size={18} /> : <Boxes size={18} />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {entryMode === 'NEW' ? 'Receive & Register New Cake Item' : 'Record Stock Movement'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {entryMode === 'NEW' ? 'Add new item to catalog and receive initial stock' : 'තොග ලැබීම් / හානිවීම් / ගැලපීම් සටහන් කිරීම'}
              </div>
            </div>
          </div>
        }
        okText={entryMode === 'NEW' ? 'Save Product & Stock' : 'Record Movement'}
        okButtonProps={{
          style: {
            background: 'var(--primary)',
            borderColor: 'var(--primary)',
            fontWeight: 700,
            height: 38,
            borderRadius: 8
          }
        }}
        cancelButtonProps={{
          style: {
            height: 38,
            borderRadius: 8,
            fontWeight: 600
          }
        }}
        centered
        width={580}
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
                const initCat = categories[0]
                const autoCode = generateCategoryItemCode(initCat, products)
                form.setFieldsValue({
                  new_unit: 'pcs',
                  new_category_id: initCat?.id || undefined,
                  new_barcode: autoCode,
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0', fontWeight: 700 }}>
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
              {/* Select Product */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">
                    <Boxes size={14} style={{ color: 'var(--primary)' }} />
                    1. Target Product
                  </span>
                </div>

                <Form.Item
                  name="product_id"
                  label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Select Item</span>}
                  rules={[{ required: true, message: 'Please select a product' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    placeholder="Choose or search product..."
                    showSearch
                    size="large"
                    style={{ borderRadius: 8 }}
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                    }
                    options={tracked.map((p) => ({
                      value: p.id,
                      label: `${p.name} (Code: ${p.barcode || '—'} · Current: ${formatStockQty(p.current_stock, p.unit)})`
                    }))}
                  />
                </Form.Item>
              </div>

              {/* Movement Details */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">
                    <TrendingUp size={14} style={{ color: 'var(--primary)' }} />
                    2. Movement Type & Quantity
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 10 }}>
                  <Form.Item
                    name="type"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Action Type</span>}
                    initialValue="IN"
                    rules={[{ required: true }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select size="large" style={{ borderRadius: 8 }}>
                      <Select.Option value="IN">
                        <span style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>+ Stock In / Received</span>
                      </Select.Option>
                      <Select.Option value="DAMAGE">
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>- Damage / Wastage</span>
                      </Select.Option>
                      <Select.Option value="RETURN">
                        <span style={{ color: 'var(--info)', fontWeight: 700 }}>+ Customer Return</span>
                      </Select.Option>
                      <Select.Option value="ADJUST">
                        <span style={{ color: 'var(--warning)', fontWeight: 700 }}>~ Count Adjustment</span>
                      </Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="quantity"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Quantity</span>}
                    rules={[{ required: true, message: 'Enter quantity' }]}
                    initialValue={1}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0.01} step={1} size="large" style={{ width: '100%', borderRadius: 8, fontWeight: 700 }} />
                  </Form.Item>
                </div>

                {/* Quick Multiplier Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Quick Qty:</span>
                  {[1, 5, 10, 20, 50, 100].map((q) => (
                    <span
                      key={q}
                      className="form-quick-chip"
                      onClick={() => form.setFieldsValue({ quantity: q })}
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cost & Note */}
              <div className="form-section" style={{ marginBottom: 0 }}>
                <div className="form-section-header">
                  <span className="form-section-title">
                    <DollarSign size={14} style={{ color: 'var(--primary)' }} />
                    3. Cost & Reference (Optional)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
                  <Form.Item
                    name="cost_price"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Cost Price (Rs.)</span>}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      placeholder="e.g. 2500"
                      size="large"
                      style={{ width: '100%', borderRadius: 8 }}
                      formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                    />
                  </Form.Item>

                  <Form.Item
                    name="note"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Batch Ref / Note</span>}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="e.g. Morning bake batch" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* NEW ITEM FORM */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">
                    <Tag size={14} style={{ color: 'var(--primary)' }} />
                    1. Product Information
                  </span>
                </div>

                <Form.Item
                  name="new_name"
                  label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Product Name / Title</span>}
                  rules={[{ required: true, message: 'Please enter product name' }]}
                  style={{ marginBottom: 12 }}
                >
                  <Input placeholder="e.g. Blueberry Cheesecake 1kg" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                  <Form.Item
                    name="new_category_id"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Category (ස්වයංක්‍රීය Code)</span>}
                    rules={[{ required: true, message: 'Select category' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      placeholder="Select category"
                      size="large"
                      style={{ borderRadius: 8 }}
                      onChange={handleCategorySelectForNewItem}
                    >
                      {categories.map((c) => (
                        <Select.Option key={c.id} value={c.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color || '#16a34a' }} />
                            <span>{c.name}</span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="new_unit"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Unit</span>}
                    initialValue="pcs"
                    style={{ marginBottom: 0 }}
                  >
                    <Select size="large" style={{ borderRadius: 8 }}>
                      <Select.Option value="pcs">pcs (Pieces)</Select.Option>
                      <Select.Option value="kg">kg (Kilograms)</Select.Option>
                      <Select.Option value="slice">slice (Portion)</Select.Option>
                      <Select.Option value="box">box (Pack)</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
              </div>

              {/* Barcode / SKU Auto-Generated by Category */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">
                    <Boxes size={14} style={{ color: 'var(--primary)' }} />
                    2. SKU & Identifier
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-start' }}>
                  <Form.Item
                    name="new_barcode"
                    label={
                      <span style={{ fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>Item Code / Barcode</span>
                        <span style={{ fontSize: 10, color: 'var(--primary)', background: 'var(--primary-bg)', padding: '1px 6px', borderRadius: 4 }}>
                          Auto by Category
                        </span>
                      </span>
                    }
                    rules={[{ required: true, message: 'Please enter or generate item code' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      placeholder="e.g. CK-001, PS-005..."
                      size="large"
                      style={{ borderRadius: 8, fontFamily: 'monospace', fontWeight: 700 }}
                    />
                  </Form.Item>

                  <div style={{ paddingTop: 28 }}>
                    <button
                      type="button"
                      onClick={handleRegenerateNewItemCode}
                      title="Generate Category Code"
                      style={{
                        height: 42,
                        padding: '0 14px',
                        borderRadius: 8,
                        border: '1.5px solid var(--border)',
                        background: '#ffffff',
                        color: 'var(--primary)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                    >
                      <Sparkles size={14} />
                      <span>Auto Code</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing & Stock In */}
              <div className="form-section" style={{ marginBottom: 0 }}>
                <div className="form-section-header">
                  <span className="form-section-title">
                    <DollarSign size={14} style={{ color: 'var(--primary)' }} />
                    3. Pricing & Initial Stock
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <Form.Item
                    name="new_price"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Selling Price (Rs.)</span>}
                    rules={[{ required: true, message: 'Enter price' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      size="large"
                      style={{ width: '100%', borderRadius: 8, fontWeight: 700, color: 'var(--primary-dark)' }}
                      formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                    />
                  </Form.Item>

                  <Form.Item
                    name="new_cost_price"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Cost Price (Rs.)</span>}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      size="large"
                      style={{ width: '100%', borderRadius: 8 }}
                      formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                    />
                  </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                  <Form.Item
                    name="new_quantity"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Initial Stock Received</span>}
                    rules={[{ required: true, message: 'Enter initial stock quantity' }]}
                    initialValue={10}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0} step={1} size="large" style={{ width: '100%', borderRadius: 8, fontWeight: 700 }} />
                  </Form.Item>

                  <Form.Item
                    name="new_note"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Note / Supplier Info</span>}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="e.g. Initial supplier batch" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </div>
              </div>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
