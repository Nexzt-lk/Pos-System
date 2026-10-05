import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Cake,
  Edit3,
  Package2,
  AlertTriangle,
  CheckCircle2,
  Barcode,
  Trash2,
  Layers,
  Sparkles
} from 'lucide-react'
import { Modal, Form, Input, InputNumber, Select, Switch, message, Popconfirm } from 'antd'
import { Product, Category, normalizeProduct, normalizeCategory } from '../../types/product'
import { productsApi } from '../../api/productsApi'
import { categoriesApi } from '../../api/categoriesApi'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'
import { generateCategoryItemCode } from '../../lib/skuGenerator'
import { getAutoMatchedProductImage, getProductImageSrc } from '../../lib/imageHelper'
import { RefreshButton } from '../../components/RefreshButton'
import { ProductCardItem } from './ProductCardItem'
import { ProductImagePicker } from './ProductImagePicker'
import { InventoryFilters } from '../inventory/InventoryFilters'

export const ProductsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'>('name_asc')
  const [viewMode] = useState<'cards' | 'table'>('table')

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
        productsApi.getAll(true, currentShop.id).catch(() => []),
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
        initial_stock_kg: 1,
        initial_stock_g: 0,
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
        if (values.initial_stock_kg !== undefined || values.initial_stock_g !== undefined) {
          const kg = Number(values.initial_stock_kg) || 0
          const g = Number(values.initial_stock_g) || 0
          finalInitialStock = isBaseGram ? (kg * 1000 + g) : (kg + g / 1000)
        } else if (isBaseGram) {
          finalInitialStock = prodStockWeightMode === 'kg' ? finalInitialStock * 1000 : finalInitialStock
        } else {
          finalInitialStock = prodStockWeightMode === 'g' ? Math.round((finalInitialStock / 1000) * 1000) / 1000 : finalInitialStock
        }
      }

      // Automatically match image if none was explicitly picked
      const finalImagePath = values.image_path || getAutoMatchedProductImage(values.name, selCat?.name)

      if (editingProduct) {
        await productsApi.update(editingProduct.id, {
          shopId: currentShop.id,
          shop_id: currentShop.id,
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
          minStockAlert: 5,
          shopId: currentShop.id,
          shop_id: currentShop.id
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
      <div className="page-header" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ minWidth: 260, flex: '1 1 auto' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'nowrap' }}>
          <RefreshButton onClick={loadData} isLoading={isLoading} />

          <button
            onClick={() => handleOpenModal()}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.92'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.3)'
            }}
          >
            <Plus size={16} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>Add New Product</span>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Products
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
              {totalCount}
            </div>
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginTop: 1 }}>
              Catalog items
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
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
            background: '#ffffff',
            border: lowStockCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Low Stock Warning
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 2 }}>
              {lowStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 1 }}>
              ≤ 5 items remaining
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626'
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Categories
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#7e22ce', marginTop: 2 }}>
              {categories.length}
            </div>
            <div style={{ fontSize: 11, color: '#9333ea', fontWeight: 600, marginTop: 1 }}>
              Menu groups
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#faf5ff',
              border: '1px solid #e9d5ff',
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
      <InventoryFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search product name, code, barcode, category..."
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        categoryCounts={categoryCounts}
        trackedCount={products.length}
        inStockCount={inStockCount}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
      />

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
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '13px 18px', width: '32%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Product Name
                    </th>
                    <th style={{ padding: '13px 16px', width: '18%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Category
                    </th>
                    <th style={{ padding: '13px 16px', width: '16%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Item Code / Barcode
                    </th>
                    <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Selling Price
                    </th>
                    <th style={{ padding: '13px 16px', width: '10%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Cost Price
                    </th>
                    <th style={{ padding: '13px 18px', textAlign: 'right', width: '10%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Quick Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isTracked = Boolean(product.track_inventory)
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
                                src={getProductImageSrc(product.image_path || (product as any).imagePath, product.name, product.category_name) || undefined}
                                alt={product.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  const imgPath = product.image_path || (product as any).imagePath
                                  const clean = imgPath?.replace(/^\/+/, '') || ''
                                  const cached = typeof window !== 'undefined' ? localStorage.getItem(`pos_img_${clean}`) : null
                                  if (cached && e.currentTarget.src !== cached) {
                                    e.currentTarget.src = cached
                                  } else {
                                    e.currentTarget.style.display = 'none'
                                  }
                                }}
                              />
                              <Cake size={18} style={{ position: 'absolute', zIndex: 0, opacity: 0.7 }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  color: '#64748b',
                                  fontWeight: 600,
                                  fontSize: 13.5,
                                  lineHeight: 1.3
                                }}
                              >
                                {product.name}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                                  Unit: <strong>{product.unit}</strong>
                                </span>
                                {!isTracked && (
                                  <span style={{ fontSize: 10, background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    Service Item
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
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
                                  color: '#64748b',
                                  fontSize: 13
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
                          <div style={{ fontWeight: 600, color: '#64748b', fontSize: 12.5 }}>
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



                        {/* Quick Action */}
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              onClick={() => handleOpenModal(product)}
                              title="Edit Product Details"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#2563eb',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dbeafe'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.2)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#eff6ff'
                                e.currentTarget.style.transform = 'none'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            >
                              <Edit3 size={15} />
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
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#dc2626',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#fee2e2'
                                  e.currentTarget.style.transform = 'translateY(-1px)'
                                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.2)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#fef2f2'
                                  e.currentTarget.style.transform = 'none'
                                  e.currentTarget.style.boxShadow = 'none'
                                }}
                              >
                                <Trash2 size={15} />
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
            rules={[
              { required: true, message: 'Please enter product name' },
              { whitespace: true, message: 'Product name cannot be blank spaces' },
              { min: 2, message: 'Product name must be at least 2 characters' },
              { max: 100, message: 'Product name cannot exceed 100 characters' }
            ]}
            style={{ marginBottom: 12 }}
          >
            <Input placeholder="e.g. Chocolate Fudge Gateau 1kg" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          {/* Category & Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
            <Form.Item
              name="category_id"
              label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Category</span>}
              rules={[{ required: true, message: 'Please select a category' }]}
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
              rules={[{ required: true, message: 'Please select a unit' }]}
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
              rules={[
                { required: true, message: 'Please enter selling price' },
                {
                  validator: (_, val) => {
                    if (val === undefined || val === null || val === '') {
                      return Promise.reject(new Error('Selling price is required'))
                    }
                    if (Number(val) <= 0) {
                      return Promise.reject(new Error('Selling price must be greater than 0'))
                    }
                    if (Number(val) > 10000000) {
                      return Promise.reject(new Error('Selling price exceeds maximum limit'))
                    }
                    return Promise.resolve()
                  }
                }
              ]}
              style={{ marginBottom: 0 }}
            >
              <InputNumber
                min={0.01}
                step={10}
                placeholder="e.g. 3800"
                size="large"
                style={{ width: '100%', borderRadius: 8, fontWeight: 600 }}
              />
            </Form.Item>

            <Form.Item
              name="cost_price"
              label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Cost Price (Rs. - Optional)</span>}
              rules={[
                {
                  validator: (_, val) => {
                    if (val !== undefined && val !== null && val !== '') {
                      if (Number(val) < 0) {
                        return Promise.reject(new Error('Cost price cannot be negative'))
                      }
                      if (Number(val) > 10000000) {
                        return Promise.reject(new Error('Cost price exceeds maximum limit'))
                      }
                    }
                    return Promise.resolve()
                  }
                }
              ]}
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
              rules={[
                {
                  validator: (_, val) => {
                    if (val && typeof val === 'string' && val.trim().length > 0) {
                      if (val.trim().length < 2) {
                        return Promise.reject(new Error('Barcode must be at least 2 characters'))
                      }
                      if (val.trim().length > 50) {
                        return Promise.reject(new Error('Barcode cannot exceed 50 characters'))
                      }
                      if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(val.trim())) {
                        return Promise.reject(new Error('Barcode can only contain letters, numbers, hyphens, or dots'))
                      }
                    }
                    return Promise.resolve()
                  }
                }
              ]}
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

          {/* Product Image Selection & Custom Upload */}
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
              const currentImagePath = getFieldValue('image_path')

              return (
                <>
                  <ProductImagePicker
                    value={currentImagePath}
                    onChange={(newPath) => setFieldsValue({ image_path: newPath })}
                    productName={currentName}
                    categoryName={selectedCat?.name}
                  />
                  <Form.Item name="image_path" noStyle>
                    <Input type="hidden" />
                  </Form.Item>
                </>
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

                return (
                  <div style={{ marginTop: 12 }}>
                    {isWeight ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Form.Item
                            name="initial_stock_kg"
                            label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Weight (Kilograms / kg)</span>}
                            initialValue={1}
                            rules={[
                              {
                                validator: (_, val) => {
                                  if (val !== undefined && val !== null && val !== '') {
                                    if (Number(val) < 0) return Promise.reject(new Error('kg cannot be negative'))
                                    if (Number(val) > 10000) return Promise.reject(new Error('kg too large'))
                                  }
                                  return Promise.resolve()
                                }
                              }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={0}
                              step={1}
                              placeholder="0"
                              size="large"
                              addonAfter="kg"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                              onChange={(val) => {
                                const k = Number(val) || 0
                                const g = Number(form.getFieldValue('initial_stock_g')) || 0
                                const isBaseGram = curUnit === 'g'
                                form.setFieldsValue({ initial_stock: isBaseGram ? (k * 1000 + g) : (k + g / 1000) })
                              }}
                            />
                          </Form.Item>

                          <Form.Item
                            name="initial_stock_g"
                            label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Weight (Grams / g)</span>}
                            initialValue={0}
                            rules={[
                              {
                                validator: (_, val) => {
                                  if (val !== undefined && val !== null && val !== '') {
                                    if (Number(val) < 0) return Promise.reject(new Error('g cannot be negative'))
                                    if (Number(val) >= 1000) return Promise.reject(new Error('g must be < 1000'))
                                  }
                                  return Promise.resolve()
                                }
                              }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={0}
                              max={999}
                              step={50}
                              placeholder="0"
                              size="large"
                              addonAfter="g"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                              onChange={(val) => {
                                const g = Number(val) || 0
                                const k = Number(form.getFieldValue('initial_stock_kg')) || 0
                                const isBaseGram = curUnit === 'g'
                                form.setFieldsValue({ initial_stock: isBaseGram ? (k * 1000 + g) : (k + g / 1000) })
                              }}
                            />
                          </Form.Item>
                        </div>

                        <Form.Item name="initial_stock" hidden initialValue={curUnit === 'g' ? 1000 : 1}>
                          <Input />
                        </Form.Item>

                        {/* Quick Presets for weight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Quick Presets:</span>
                          {[
                            { label: '250g', kg: 0, g: 250 },
                            { label: '500g', kg: 0, g: 500 },
                            { label: '1 kg', kg: 1, g: 0 },
                            { label: '1.5 kg', kg: 1, g: 500 },
                            { label: '2 kg', kg: 2, g: 0 },
                            { label: '5 kg', kg: 5, g: 0 },
                            { label: '10 kg', kg: 10, g: 0 },
                            { label: '25 kg', kg: 25, g: 0 }
                          ].map((p) => (
                            <span
                              key={p.label}
                              className="form-quick-chip"
                              onClick={() => {
                                form.setFieldsValue({
                                  initial_stock_kg: p.kg,
                                  initial_stock_g: p.g,
                                  initial_stock: curUnit === 'g' ? (p.kg * 1000 + p.g) : (p.kg + p.g / 1000)
                                })
                              }}
                            >
                              {p.label}
                            </span>
                          ))}
                        </div>

                        {/* Quick By Money Value Calculation for Initial Stock */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>💵 By Money Amount:</span>
                          {[1000, 2000, 2500, 5000, 7500, 10000, 20000].map((amt) => (
                            <span
                              key={amt}
                              className="form-quick-chip"
                              style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 700 }}
                              onClick={() => {
                                const effectivePrice = Number(form.getFieldValue('price')) || Number(form.getFieldValue('cost_price')) || 0
                                if (effectivePrice <= 0) {
                                  message.info('Please enter selling price first to calculate stock by money amount')
                                  return
                                }
                                const isBaseGram = curUnit === 'g'
                                if (isBaseGram) {
                                  const totalG = Math.round(amt / effectivePrice)
                                  form.setFieldsValue({
                                    initial_stock_kg: Math.floor(totalG / 1000),
                                    initial_stock_g: Math.round(totalG % 1000),
                                    initial_stock: totalG
                                  })
                                } else {
                                  const totalKg = amt / effectivePrice
                                  const totalG = Math.round(totalKg * 1000)
                                  form.setFieldsValue({
                                    initial_stock_kg: Math.floor(totalG / 1000),
                                    initial_stock_g: Math.round(totalG % 1000),
                                    initial_stock: Math.round(totalKg * 1000) / 1000
                                  })
                                }
                              }}
                            >
                              Rs. {amt >= 1000 ? `${amt / 1000}k` : amt}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <Form.Item
                          name="initial_stock"
                          label={<span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>Initial Stock on Hand ({curUnit})</span>}
                          initialValue={10}
                          rules={[
                            { required: true, message: 'Please enter initial stock quantity' },
                            {
                              validator: (_, val) => {
                                if (val === undefined || val === null || val === '') {
                                  return Promise.reject(new Error('Initial stock quantity is required'))
                                }
                                if (Number(val) < 0) {
                                  return Promise.reject(new Error('Initial stock cannot be negative'))
                                }
                                if (Number(val) > 1000000) {
                                  return Promise.reject(new Error('Initial stock quantity is too large'))
                                }
                                return Promise.resolve()
                              }
                            }
                          ]}
                          style={{ marginBottom: 6 }}
                        >
                          <InputNumber
                            min={0}
                            step={1}
                            size="large"
                            style={{ width: '100%', borderRadius: 8, fontWeight: 600 }}
                          />
                        </Form.Item>

                        {/* Quick Presets */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Quick Presets:</span>
                          {[5, 10, 20, 50, 100].map((q) => (
                            <span
                              key={q}
                              className="form-quick-chip"
                              onClick={() => form.setFieldsValue({ initial_stock: q })}
                            >
                              {q} pcs
                            </span>
                          ))}
                        </div>
                      </>
                    )}
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
