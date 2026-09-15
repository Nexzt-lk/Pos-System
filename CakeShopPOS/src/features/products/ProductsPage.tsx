import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Cake,
  Edit3,
  Package2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Barcode,
  ArrowUpDown,
  Trash2,
  Layers,
  Image as ImageIcon,
  Sparkles,
  LayoutGrid,
  List
} from 'lucide-react'
import { Modal, Form, Input, InputNumber, Select, Switch, message, Popconfirm, Segmented } from 'antd'
import { Product, Category, normalizeProduct, normalizeCategory } from '../../types/product'
import { productsApi } from '../../api/productsApi'
import { categoriesApi } from '../../api/categoriesApi'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatStockQty } from '../../lib/formatters'
import { generateCategoryItemCode } from '../../lib/skuGenerator'
import { BAKERY_IMAGE_PRESETS, getAutoMatchedProductImage, getProductImageSrc } from '../../lib/imageHelper'
import { ProductCardItem } from './ProductCardItem'

export const ProductsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'>('name_asc')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [prodStockWeightMode, setProdStockWeightMode] = useState<'kg' | 'g'>('kg')
  const [isLoading, setIsLoading] = useState(false)

  // Live margin preview in Modal
  const [modalSellingPrice, setModalSellingPrice] = useState<number>(0)
  const [modalCostPrice, setModalCostPrice] = useState<number>(0)

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
      console.error('Failed to load products:', err)
      message.error('Failed to load product catalog from server')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentShop?.id])

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setModalSellingPrice(product.price || 0)
      setModalCostPrice(product.cost_price || 0)
      const isWeight = product.unit?.toLowerCase() === 'kg' || product.unit?.toLowerCase() === 'g'
      setProdStockWeightMode(product.unit?.toLowerCase() === 'g' ? 'g' : 'kg')
      
      form.setFieldsValue({
        name: product.name,
        category_id: product.category_id,
        barcode: product.barcode,
        price: product.price,
        cost_price: product.cost_price || 0,
        unit: product.unit || 'pcs',
        track_inventory: Boolean(product.track_inventory),
        description: product.description || '',
        image_path: product.image_path
      })
    } else {
      setEditingProduct(null)
      setModalSellingPrice(0)
      setModalCostPrice(0)
      setProdStockWeightMode('kg')
      form.resetFields()

      const initialCat = categories[0]
      const autoCode = generateCategoryItemCode(initialCat, products)

      form.setFieldsValue({
        category_id: initialCat?.id || undefined,
        barcode: autoCode,
        track_inventory: true,
        unit: 'pcs',
        price: 0,
        cost_price: 0,
        initial_stock: 10,
        image_path: undefined
      })
    }
    setIsModalOpen(true)
  }

  const handleCategoryChangeInForm = (categoryId: string) => {
    const selectedCat = categories.find((c) => c.id === categoryId)
    if (!editingProduct) {
      const autoCode = generateCategoryItemCode(selectedCat, products)
      form.setFieldsValue({ barcode: autoCode })
    }
  }

  const handleGenerateBarcode = () => {
    const curCatId = form.getFieldValue('category_id') || categories[0]?.id
    const selectedCat = categories.find((c) => c.id === curCatId)
    const code = generateCategoryItemCode(selectedCat, products)
    form.setFieldsValue({ barcode: code })
    message.success(`Generated code: ${code}`)
  }

  const handleSaveProduct = async (values: any) => {
    if (!currentShop) return
    try {
      const selCat = categories.find((c) => c.id === values.category_id)
      const itemCode = values.barcode ? values.barcode.trim() : generateCategoryItemCode(selCat, products)

      const isWeight = values.unit?.toLowerCase() === 'kg' || values.unit?.toLowerCase() === 'g'
      const isBaseGram = values.unit?.toLowerCase() === 'g'
      let finalInitialStock = Number(values.initial_stock) || 0
      if (isWeight) {
        if (isBaseGram) {
          finalInitialStock = prodStockWeightMode === 'kg' ? finalInitialStock * 1000 : finalInitialStock
        } else {
          finalInitialStock = prodStockWeightMode === 'g' ? Math.round((finalInitialStock / 1000) * 1000) / 1000 : finalInitialStock
        }
      }

      // Automatically match image if none was explicitly picked
      const finalImagePath = values.image_path || getAutoMatchedProductImage(values.name, selCat?.name)

      if (editingProduct) {
        await productsApi.update(editingProduct.id, {
          categoryId: values.category_id || undefined,
          name: values.name.trim(),
          description: values.description || '',
          price: Number(values.price) || 0,
          costPrice: Number(values.cost_price) || 0,
          barcode: itemCode,
          unit: values.unit || 'pcs',
          trackInventory: Boolean(values.track_inventory),
          imagePath: finalImagePath,
          isActive: true
        })
        message.success('Product details updated successfully via Backend API!')
      } else {
        await productsApi.create({
          categoryId: values.category_id,
          name: values.name.trim(),
          description: values.description || '',
          price: Number(values.price) || 0,
          costPrice: Number(values.cost_price) || 0,
          barcode: itemCode,
          unit: values.unit || 'pcs',
          trackInventory: Boolean(values.track_inventory),
          initialStock: finalInitialStock,
          imagePath: finalImagePath,
          minStockAlert: 5
        })
        message.success(`Product "${values.name}" (Code: ${itemCode}) created via Backend API!`)
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error('Failed to save product:', err)
      message.error(err.message || 'Failed to save product')
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!currentShop) return
    try {
      await productsApi.delete(product.id)
      message.success(`Product "${product.name}" removed from catalog via Backend API`)
      await loadData()
    } catch (err: any) {
      message.error(err.message || 'Failed to remove product')
    }
  }

  // Summary Metrics
  const totalCount = products.length
  const inStockCount = products.filter(p => !p.track_inventory || (p.current_stock ?? 0) > 5).length
  const lowStockCount = products.filter(p => p.track_inventory && (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0).length
  const outOfStockCount = products.filter(p => p.track_inventory && (p.current_stock ?? 0) <= 0).length

  // Filtering & Sorting
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search query
        const matchSearch =
          searchQuery === '' ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.category_name && p.category_name.toLowerCase().includes(searchQuery.toLowerCase()))

        // Category filter
        const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory

        // Stock status filter
        let matchStock = true
        if (stockFilter === 'in_stock') {
          matchStock = !p.track_inventory || (p.current_stock ?? 0) > 5
        } else if (stockFilter === 'low_stock') {
          matchStock = Boolean(p.track_inventory && (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0)
        } else if (stockFilter === 'out_of_stock') {
          matchStock = Boolean(p.track_inventory && (p.current_stock ?? 0) <= 0)
        }

        return matchSearch && matchCat && matchStock
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
        if (sortBy === 'price_asc') return a.price - b.price
        if (sortBy === 'price_desc') return b.price - a.price
        if (sortBy === 'stock_asc') return (a.current_stock ?? 0) - (b.current_stock ?? 0)
        if (sortBy === 'stock_desc') return (b.current_stock ?? 0) - (a.current_stock ?? 0)
        return 0
      })
  }, [products, searchQuery, selectedCategory, stockFilter, sortBy])

  // Category counts for pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    products.forEach(p => {
      const catId = p.category_id || 'uncategorized'
      counts[catId] = (counts[catId] || 0) + 1
    })
    return counts
  }, [products])

  // Margin calculation for modal
  const profitAmt = modalSellingPrice - modalCostPrice
  const marginPct = modalSellingPrice > 0 ? ((profitAmt / modalSellingPrice) * 100).toFixed(1) : '0.0'

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
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.12)',
                border: '1px solid #86efac'
              }}
            >
              <Cake size={20} />
            </div>
            <span>Product Catalog & Pricing</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--primary-dark)',
                background: 'var(--primary-bg)',
                border: '1px solid var(--primary-muted)',
                padding: '2px 8px',
                borderRadius: 99,
                marginLeft: 4
              }}
            >
              {products.length} Products
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            Manage cake items, prices, barcodes, units, and profit margins · <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{currentShop?.name || 'Main Branch'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => loadData()}
            title="Refresh Products"
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
            onClick={() => handleOpenModal()}
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
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flexShrink: 0 }}>
        {/* Total Products */}
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
              Total Products
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {totalCount}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
              Catalog items
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

        {/* In Stock */}
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
              In Good Stock
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 2 }}>
              {inStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>
              Ready for sales
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

        {/* Low Stock Alerts */}
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
              Low Stock Warning
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
              {lowStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 1 }}>
              ≤ 5 items remaining
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

        {/* Categories */}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#581c87', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Categories
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#7e22ce', marginTop: 2 }}>
              {categories.length}
            </div>
            <div style={{ fontSize: 11, color: '#9333ea', fontWeight: 500, marginTop: 1 }}>
              Menu groups
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#faf5ff',
              border: '1px solid #f3e8ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9333ea'
            }}
          >
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
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
              placeholder="Search product name, code, barcode, category..."
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
            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>
                Stock:
              </span>
              <Segmented
                value={stockFilter}
                onChange={(val) => setStockFilter(val as any)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: `In Stock (${inStockCount})`, value: 'in_stock' },
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
                style={{ width: 170 }}
                options={[
                  { value: 'name_asc', label: 'Name (A to Z)' },
                  { value: 'name_desc', label: 'Name (Z to A)' },
                  { value: 'price_asc', label: 'Price (Lowest First)' },
                  { value: 'price_desc', label: 'Price (Highest First)' },
                  { value: 'stock_asc', label: 'Stock (Lowest First)' },
                  { value: 'stock_desc', label: 'Stock (Highest First)' }
                ]}
              />
            </div>

            {/* View Mode Toggle: Cards vs Table */}
            <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: 10 }}>
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'cards' | 'table')}
                options={[
                  {
                    value: 'cards',
                    icon: <LayoutGrid size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />,
                    label: 'Cards'
                  },
                  {
                    value: 'table',
                    icon: <List size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />,
                    label: 'Table'
                  }
                ]}
                style={{ background: '#f1f5f9', fontWeight: 700, fontSize: 12 }}
              />
            </div>
          </div>
        </div>

        {/* Category Pills (Horizontal) */}
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
              {products.length}
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

      {/* ── Main Catalog View (Cards Grid or Table) ── */}
      {viewMode === 'cards' ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: 2
          }}
        >
          {filteredProducts.length === 0 ? (
            <div
              style={{
                height: '100%',
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: 40,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
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
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                No Products Found
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360, margin: '4px auto 16px', textAlign: 'center' }}>
                {searchQuery
                  ? `No items matching "${searchQuery}". Try searching with a different term.`
                  : 'No products found matching the current filters. Click "Add New Product" to create one.'}
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
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
                paddingBottom: 24
              }}
            >
              {filteredProducts.map((product) => (
                <ProductCardItem
                  key={product.id}
                  product={product}
                  onEdit={handleOpenModal}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Products Table ── */
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
                  Product Details
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
                  Stock Status
                </th>
                <th style={{ padding: '13px 18px', textAlign: 'right', width: '10%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Actions
                </th>
              </tr>
            </thead>
          </table>

          <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {filteredProducts.map((product) => {
                  const isTracked = Boolean(product.track_inventory)
                  const stockNum = product.current_stock ?? 0
                  const isLow = isTracked && stockNum <= 5 && stockNum > 0
                  const isOut = isTracked && stockNum <= 0
                  const catColor = product.category_color || '#16a34a'

                  // Margin calculation
                  const hasCost = Boolean(product.cost_price && product.cost_price > 0)
                  const profit = product.price - (product.cost_price || 0)
                  const margin = hasCost && product.price > 0 ? ((profit / product.price) * 100).toFixed(0) : null

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
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: `${catColor}15`,
                              border: `1px solid ${catColor}30`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: catColor,
                              fontWeight: 800,
                              fontSize: 14,
                              flexShrink: 0,
                              overflow: 'hidden',
                              position: 'relative'
                            }}
                          >
                            <img
                              src={getProductImageSrc(product.image_path, product.name, product.category_name) || undefined}
                              alt={product.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                            <Cake size={18} style={{ position: 'absolute', zIndex: 0, opacity: 0.7 }} />
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                Unit: <strong style={{ color: '#475569' }}>{product.unit}</strong>
                              </span>
                              {!isTracked && (
                                <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                  Service Item
                                </span>
                              )}
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
                        {margin && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginTop: 1 }}>
                            +{margin}% margin
                          </div>
                        )}
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

                      {/* Stock Status */}
                      <td style={{ padding: '12px 16px' }}>
                        {isTracked ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 99,
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
                              color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                              border: `1px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#bbf7d0'}`
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e'
                              }}
                            />
                            {isOut ? 'Out of Stock' : formatStockQty(product.current_stock, product.unit)}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              background: '#f1f5f9',
                              color: '#64748b'
                            }}
                          >
                            Non-tracked
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleOpenModal(product)}
                            title="Edit Product Details"
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#334155',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--primary-bg)'
                              e.currentTarget.style.color = 'var(--primary)'
                              e.currentTarget.style.borderColor = 'var(--primary)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#ffffff'
                              e.currentTarget.style.color = '#334155'
                              e.currentTarget.style.borderColor = '#cbd5e1'
                            }}
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>

                          <Popconfirm
                            title="Remove Product"
                            description={`Are you sure you want to remove "${product.name}" from the active catalog?`}
                            onConfirm={() => handleDeleteProduct(product)}
                            okText="Yes, Remove"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true, style: { fontWeight: 700 } }}
                          >
                            <button
                              title="Delete Product"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: '1px solid transparent',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94a3b8',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fee2e2'
                                e.currentTarget.style.color = '#ef4444'
                                e.currentTarget.style.borderColor = '#fca5a5'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.color = '#94a3b8'
                                e.currentTarget.style.borderColor = 'transparent'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </Popconfirm>
                        </div>
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
                        No Products Found
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360, margin: '4px auto 16px' }}>
                        {searchQuery
                          ? `No items matching "${searchQuery}". Try searching with a different term.`
                          : 'No products in this category yet. Click "Add New Product" to create one.'}
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
      )}

      {/* ── Add / Edit Product Modal ── */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: '#f1f5f9',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e2e8f0'
              }}
            >
              {editingProduct ? <Edit3 size={16} /> : <Plus size={16} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {editingProduct ? `SKU: ${editingProduct.barcode || editingProduct.name}` : 'Enter product details for POS catalog'}
              </div>
            </div>
          </div>
        }
        okText={editingProduct ? 'Save Changes' : 'Create Product'}
        okButtonProps={{
          style: {
            background: 'var(--primary)',
            borderColor: 'var(--primary)',
            fontWeight: 600,
            height: 38,
            borderRadius: 8
          }
        }}
        cancelButtonProps={{
          style: {
            height: 38,
            borderRadius: 8,
            fontWeight: 500
          }
        }}
        centered
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveProduct}
          style={{ paddingTop: 8 }}
          onValuesChange={(_, allValues) => {
            if (allValues.price !== undefined) setModalSellingPrice(Number(allValues.price) || 0)
            if (allValues.cost_price !== undefined) setModalCostPrice(Number(allValues.cost_price) || 0)
          }}
        >
          {/* Product Name */}
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Product Name</span>}
            rules={[{ required: true, message: 'Please enter product name' }]}
            style={{ marginBottom: 12 }}
          >
            <Input placeholder="e.g. Chocolate Fudge Gateau 1kg" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          {/* Category & Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
            <Form.Item
              name="category_id"
              label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Category</span>}
              rules={[{ required: true, message: 'Select category' }]}
              style={{ marginBottom: 0 }}
            >
              <Select
                placeholder="Select category"
                size="large"
                style={{ borderRadius: 8 }}
                onChange={handleCategoryChangeInForm}
                options={categories.map((c) => ({
                  value: c.id,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: c.color || '#6366f1',
                          display: 'inline-block'
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      {(c.code_prefix || c.codePrefix) && (
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontFamily: 'monospace' }}>
                          ({c.code_prefix || c.codePrefix})
                        </span>
                      )}
                    </div>
                  )
                }))}
              />
            </Form.Item>

            <Form.Item
              name="unit"
              label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Unit</span>}
              initialValue="pcs"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <Select size="large" style={{ borderRadius: 8 }}>
                <Select.Option value="pcs">pcs (Pieces)</Select.Option>
                <Select.Option value="kg">kg (Kilograms)</Select.Option>
                <Select.Option value="g">g (Grams)</Select.Option>
                <Select.Option value="slice">slice (Portion)</Select.Option>
                <Select.Option value="box">box (Pack)</Select.Option>
              </Select>
            </Form.Item>
          </div>

          {/* Pricing Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Form.Item
              name="price"
              label={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Selling Price (Rs.)</span>
                  {modalSellingPrice > 0 && profitAmt !== 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                      Margin: {marginPct}%
                    </span>
                  )}
                </div>
              }
              rules={[{ required: true, message: 'Enter selling price' }]}
              style={{ marginBottom: 0 }}
            >
              <InputNumber
                min={0}
                step={10}
                placeholder="e.g. 3800"
                size="large"
                style={{ width: '100%', borderRadius: 8, fontWeight: 600 }}
              />
            </Form.Item>

            <Form.Item
              name="cost_price"
              label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Cost Price (Rs. - Optional)</span>}
              style={{ marginBottom: 0 }}
            >
              <InputNumber
                min={0}
                step={10}
                placeholder="e.g. 2200"
                size="large"
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Form.Item>
          </div>

          {/* Barcode & Auto Code */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
            <Form.Item
              name="barcode"
              label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Barcode / Item Code</span>}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <Input
                placeholder="e.g. CK-001, PS-005..."
                size="large"
                style={{ borderRadius: 10, fontFamily: 'monospace', fontWeight: 600 }}
                allowClear
              />
            </Form.Item>

            <button
              type="button"
              onClick={handleGenerateBarcode}
              title="Generate Category Code"
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 10,
                border: '1.5px solid #e2e8f0',
                background: '#f8fafc',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.borderColor = '#e2e8f0'
              }}
            >
              <Sparkles size={13} style={{ color: '#db2777' }} />
              <span>Auto Code</span>
            </button>
          </div>

          {/* Product Image & Auto-Match Preset Gallery */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) =>
              prev.name !== cur.name ||
              prev.category_id !== cur.category_id ||
              prev.image_path !== cur.image_path
            }
          >
            {({ getFieldValue, setFieldsValue }) => {
              const currentName = getFieldValue('name') || ''
              const currentCatId = getFieldValue('category_id')
              const selectedCat = categories.find((c) => c.id === currentCatId)
              const customImagePath = getFieldValue('image_path')
              const autoMatchedImage = getAutoMatchedProductImage(currentName, selectedCat?.name)
              const activeDisplayImage = customImagePath || autoMatchedImage
              const isAuto = !customImagePath

              return (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 14
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ImageIcon size={15} style={{ color: '#db2777' }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                        Product Image
                      </span>
                    </div>
                    {isAuto ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#059669',
                          background: '#ecfdf5',
                          padding: '2px 8px',
                          borderRadius: 99,
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Sparkles size={12} /> Auto-Matched
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFieldsValue({ image_path: undefined })}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#db2777',
                          background: '#fdf2f8',
                          padding: '2px 8px',
                          borderRadius: 99,
                          border: '1px solid #fbcfe8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <RefreshCw size={11} /> Reset to Auto
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Live Image Preview */}
                    <div
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 10,
                        border: '2px solid #e2e8f0',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: '#ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        position: 'relative'
                      }}
                    >
                      <img
                        src={getProductImageSrc(activeDisplayImage, currentName, selectedCat?.name) || undefined}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Quick Preset Selector */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                          {isAuto
                            ? `Auto-matched for ${selectedCat?.name || 'Category'}:`
                            : 'Select an image for this category:'}
                        </span>
                        {selectedCat && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', borderRadius: 6 }}>
                            {selectedCat.name}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          overflowX: 'auto',
                          paddingBottom: 4
                        }}
                      >
                        {[...BAKERY_IMAGE_PRESETS]
                          .sort((a, b) => {
                            const cName = (selectedCat?.name || '').toLowerCase()
                            const aMatch = a.categories.some((c) => cName.includes(c.toLowerCase()) || c.toLowerCase().includes(cName))
                            const bMatch = b.categories.some((c) => cName.includes(c.toLowerCase()) || c.toLowerCase().includes(cName))
                            if (aMatch && !bMatch) return -1
                            if (!aMatch && bMatch) return 1
                            return 0
                          })
                          .map((preset) => {
                            const isSelected = activeDisplayImage === preset.path
                            const isCategoryMatch = selectedCat && preset.categories.some((c) => (selectedCat.name || '').toLowerCase().includes(c.toLowerCase()))
                            return (
                              <div
                                key={preset.id}
                                onClick={() => setFieldsValue({ image_path: preset.path })}
                                title={`${preset.name} (${preset.categories.join(', ')})`}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  border: isSelected
                                    ? '2.5px solid #16a34a'
                                    : isCategoryMatch
                                    ? '1.5px solid #86efac'
                                    : '1px solid #cbd5e1',
                                  opacity: isSelected ? 1 : isCategoryMatch ? 0.9 : 0.6,
                                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                                  boxShadow: isSelected ? '0 2px 8px rgba(22, 163, 74, 0.35)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <img
                                  src={preset.path}
                                  alt={preset.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Hidden form field */}
                  <Form.Item name="image_path" noStyle>
                    <Input type="hidden" />
                  </Form.Item>
                </div>
              )
            }}
          </Form.Item>

          {/* Inventory Tracking Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Track Inventory
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Enable stock deduction upon sale and low-stock alerts
              </div>
            </div>
            <Form.Item name="track_inventory" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>

          {/* Initial stock if inventory tracked */}
          {!editingProduct && (
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.track_inventory !== cur.track_inventory || prev.unit !== cur.unit || prev.initial_stock !== cur.initial_stock}
            >
              {({ getFieldValue }) => {
                if (!getFieldValue('track_inventory')) return null
                const curUnit = getFieldValue('unit') || 'pcs'
                const isWeight = curUnit === 'kg' || curUnit === 'g'
                const currentQty = Number(getFieldValue('initial_stock')) || 0

                return (
                  <div style={{ marginTop: 12 }}>
                    <Form.Item
                      name="initial_stock"
                      label={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Initial Stock on Hand</span>
                          {isWeight && (
                            <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 5 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (prodStockWeightMode !== 'g') {
                                    setProdStockWeightMode('g')
                                    form.setFieldsValue({ initial_stock: Math.round(currentQty * 1000) })
                                  }
                                }}
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: prodStockWeightMode === 'g' ? '#db2777' : 'transparent',
                                  color: prodStockWeightMode === 'g' ? '#fff' : '#64748b'
                                }}
                              >
                                g
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (prodStockWeightMode !== 'kg') {
                                    setProdStockWeightMode('kg')
                                    form.setFieldsValue({ initial_stock: Math.max(0.1, Math.round((currentQty / 1000) * 100) / 100) })
                                  }
                                }}
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: prodStockWeightMode === 'kg' ? '#db2777' : 'transparent',
                                  color: prodStockWeightMode === 'kg' ? '#fff' : '#64748b'
                                }}
                              >
                                kg
                              </button>
                            </div>
                          )}
                        </div>
                      }
                      initialValue={isWeight ? (prodStockWeightMode === 'g' ? 500 : 1) : 10}
                      rules={[{ required: true, message: 'Enter initial stock quantity' }]}
                      style={{ marginBottom: 6 }}
                    >
                      <InputNumber
                        min={0}
                        step={isWeight ? (prodStockWeightMode === 'g' ? 50 : 0.25) : 1}
                        size="large"
                        style={{ width: '100%', borderRadius: 8, fontWeight: 600 }}
                      />
                    </Form.Item>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Quick Presets:</span>
                      {isWeight ? (
                        prodStockWeightMode === 'g' ? (
                          [250, 500, 1000, 2000, 5000].map((g) => (
                            <span
                              key={g}
                              className="form-quick-chip"
                              onClick={() => form.setFieldsValue({ initial_stock: g })}
                            >
                              {g < 1000 ? `${g}g` : `${g / 1000}kg`}
                            </span>
                          ))
                        ) : (
                          [0.5, 1, 2, 5, 10].map((k) => (
                            <span
                              key={k}
                              className="form-quick-chip"
                              onClick={() => form.setFieldsValue({ initial_stock: k })}
                            >
                              {k} kg
                            </span>
                          ))
                        )
                      ) : (
                        [5, 10, 20, 50, 100].map((q) => (
                          <span
                            key={q}
                            className="form-quick-chip"
                            onClick={() => form.setFieldsValue({ initial_stock: q })}
                          >
                            {q} pcs
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )
              }}
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
