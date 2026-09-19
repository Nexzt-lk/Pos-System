import React, { useState, useEffect, useMemo } from 'react'
import {

  Package,
  Package2,
  PlusCircle,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Barcode
 
} from 'lucide-react'
import { Modal, Form, Select, InputNumber, Input, Segmented, message } from 'antd'
import { Product, Category, normalizeProduct, normalizeCategory } from '../../types/product'
import { productsApi } from '../../api/productsApi'
import { categoriesApi } from '../../api/categoriesApi'
import { inventoryApi } from '../../api/inventoryApi'
import { RefreshButton } from '../../components/RefreshButton'
import { InventoryFilters } from './InventoryFilters'
import { useAppStore } from '../../store/appStore'
import { useStockAlertStore } from '../../store/stockAlertStore'
import { formatCurrency, formatStockQty } from '../../lib/formatters'
import { generateCategoryItemCode } from '../../lib/skuGenerator'
import { getAutoMatchedProductImage, getProductImageSrc } from '../../lib/imageHelper'

export const InventoryPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc'>('stock_asc')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<'EXISTING' | 'NEW'>('EXISTING')
  const [movementWeightMode, setMovementWeightMode] = useState<'kg' | 'g'>('kg')
  const [newProductWeightMode, setNewProductWeightMode] = useState<'kg' | 'g'>('kg')
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
      const isBaseGram = product.unit?.toLowerCase() === 'g'

      const defaultMode = isBaseGram ? 'g' : 'kg'
      setMovementWeightMode(defaultMode)

      form.setFieldsValue({
        product_id: product.id,
        type: 'IN',
        quantity: isBaseGram ? 500 : 1,
        note: '',
        price: product.price,
        cost_price: product.cost_price || 0
      })
    } else {
      setEntryMode('EXISTING')
      const firstTracked = products.find(p => p.track_inventory)
      const isBaseGram = firstTracked?.unit?.toLowerCase() === 'g'
      setMovementWeightMode(isBaseGram ? 'g' : 'kg')

      form.setFieldsValue({
        product_id: firstTracked?.id || undefined,
        type: 'IN',
        quantity: isBaseGram ? 500 : 1,
        note: '',
        price: firstTracked?.price || 0,
        cost_price: firstTracked?.cost_price || 0
      })
    }
    setIsModalOpen(true)
  }

  const handleProductSelectInMovementModal = (productId: string) => {
    const selectedProd = products.find((p) => p.id === productId)
    if (selectedProd) {
      const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'
      setMovementWeightMode(isBaseGram ? 'g' : 'kg')
      form.setFieldsValue({
        price: selectedProd.price,
        cost_price: selectedProd.cost_price || 0
      })
    }
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

        const selectedProd = tracked.find((p) => p.id === values.product_id)
        if (!selectedProd) {
          message.error('Product not found in inventory')
          return
        }
        const isWeight = selectedProd.unit?.toLowerCase() === 'kg' || selectedProd.unit?.toLowerCase() === 'g'
        const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'

        let finalQty = Number(values.quantity)
        if (isWeight) {
          if (isBaseGram) {
            finalQty = movementWeightMode === 'kg' ? finalQty * 1000 : finalQty
          } else {
            // Base unit is kg
            finalQty = movementWeightMode === 'g' ? Math.round((finalQty / 1000) * 1000) / 1000 : finalQty
          }
        }

        await inventoryApi.recordMovement({
          productId: values.product_id,
          type: values.type,
          quantity: finalQty,
          note: values.note || '',
          costPerUnit: values.cost_price !== undefined ? Number(values.cost_price) : undefined,
          doneBy: currentUser?.id
        }, currentShop.id)

        // Check if selling price or cost price was edited, and update product catalog
        const newSellingPrice = Number(values.price)
        const newCostPrice = Number(values.cost_price) || 0
        const priceChanged = !isNaN(newSellingPrice) && newSellingPrice > 0 && newSellingPrice !== selectedProd.price
        const costChanged = !isNaN(newCostPrice) && newCostPrice !== (selectedProd.cost_price || 0)

        if (priceChanged || costChanged) {
          await productsApi.update(selectedProd.id, {
            categoryId: selectedProd.category_id,
            name: selectedProd.name,
            description: selectedProd.description,
            price: priceChanged ? newSellingPrice : selectedProd.price,
            costPrice: costChanged ? newCostPrice : (selectedProd.cost_price || 0),
            barcode: selectedProd.barcode,
            unit: selectedProd.unit,
            trackInventory: Boolean(selectedProd.track_inventory),
            isActive: true
          })
          message.success(`Stock recorded & prices updated for "${selectedProd.name}"!`)
        } else {
          message.success('Stock movement recorded successfully!')
        }
      } else {
        // NEW ITEM MODE via Backend API
        const selectedCat = categories.find((c) => c.id === values.new_category_id)
        const itemCode = values.new_barcode ? values.new_barcode.trim() : generateCategoryItemCode(selectedCat, products)
        const isNewWeight = values.new_unit?.toLowerCase() === 'kg' || values.new_unit?.toLowerCase() === 'g'
        const isNewBaseGram = values.new_unit?.toLowerCase() === 'g'

        let finalNewStock = Number(values.new_quantity) || 0
        if (isNewWeight) {
          if (isNewBaseGram) {
            finalNewStock = newProductWeightMode === 'kg' ? finalNewStock * 1000 : finalNewStock
          } else {
            finalNewStock = newProductWeightMode === 'g' ? Math.round((finalNewStock / 1000) * 1000) / 1000 : finalNewStock
          }
        }

        await productsApi.create({
          categoryId: values.new_category_id,
          name: values.new_name.trim(),
          description: values.new_description || '',
          price: Number(values.new_price) || 0,
          costPrice: Number(values.new_cost_price) || 0,
          barcode: itemCode,
          unit: values.new_unit || 'pcs',
          trackInventory: true,
          initialStock: finalNewStock,
          imagePath: getAutoMatchedProductImage(values.new_name, selectedCat?.name),
          minStockAlert: 5
        })

        message.success(`New item "${values.new_name}" created via Backend API!`)
      }

      setIsModalOpen(false)
      await loadData()
      if (currentShop?.id) {
        useStockAlertStore.getState().fetchStockAlerts(currentShop.id, false)
      }
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
        if (sortBy === 'price_asc') return a.price - b.price
        return 0
      })
  }, [tracked, searchQuery, selectedCategory, stockFilter, sortBy])

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 50

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, stockFilter, sortBy])

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProducts, currentPage])
  
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)

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
          <RefreshButton onClick={loadData} isLoading={isLoading} />

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
      <InventoryFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        categoryCounts={categoryCounts}
        trackedCount={tracked.length}
        inStockCount={inStockCount}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
      />

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
          <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
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
                    Stock
                  </th>
                  <th style={{ padding: '13px 18px', textAlign: 'right', width: '12%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Update Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
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
                              src={getProductImageSrc(product.image_path, product.name, product.category_name)}
                              alt={product.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                            <Package size={18} style={{ position: 'absolute', zIndex: 0, opacity: 0.7 }} />
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

                      {/* On-Hand Stock */}
                      <td style={{ padding: '12px 16px' }}>
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
                          {isOut ? 'Out of Stock' : formatStockQty(product.current_stock, product.unit)}
                        </span>
                      </td>

                      {/* Quick Action */}
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenMovementModal(product)}
                            title="Record Stock Movement"
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
                              color: 'var(--primary)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--primary-bg)'
                              e.currentTarget.style.color = 'var(--primary-dark)'
                              e.currentTarget.style.borderColor = 'var(--primary-muted)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--primary)'
                              e.currentTarget.style.borderColor = 'transparent'
                            }}
                          >
                            <PlusCircle size={15} />
                          </button>
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
          
          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} items
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : '#fff', color: currentPage === 1 ? '#94a3b8' : '#334155', fontWeight: 600, fontSize: 12, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: currentPage === totalPages ? '#f1f5f9' : '#fff', color: currentPage === totalPages ? '#94a3b8' : '#334155', fontWeight: 600, fontSize: 12, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Movement Modal ── */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {entryMode === 'NEW' ? 'Receive & Register New Cake Item' : 'Record Stock Movement'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {entryMode === 'NEW' ? 'Add new item to catalog and receive initial stock' : 'Record stock receipts, damages, and adjustments'}
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
                    <span>Existing Item</span>
                  </div>
                ),
                value: 'EXISTING'
              },
              {
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0', fontWeight: 700 }}>
                    <span>+ New Item</span>
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
                    onChange={handleProductSelectInMovementModal}
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
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.product_id !== cur.product_id || prev.type !== cur.type || prev.quantity !== cur.quantity}>
                {({ getFieldValue }) => {
                  const pId = getFieldValue('product_id')
                  const selectedProd = tracked.find((p) => p.id === pId)
                  const isWeight = selectedProd?.unit?.toLowerCase() === 'kg' || selectedProd?.unit?.toLowerCase() === 'g'
                  const isBaseGram = selectedProd?.unit?.toLowerCase() === 'g'
                  const currentQty = Number(getFieldValue('quantity')) || 0
                  const mType = getFieldValue('type') || 'IN'

                  // Calculate normalized change in product base unit
                  let normalizedChange = currentQty
                  if (isWeight) {
                    if (isBaseGram) {
                      normalizedChange = movementWeightMode === 'kg' ? currentQty * 1000 : currentQty
                    } else {
                      // Base unit is kg
                      normalizedChange = movementWeightMode === 'g' ? currentQty / 1000 : currentQty
                    }
                  }

                  const currentStock = selectedProd?.current_stock ?? 0
                  let projectedStock = currentStock
                  if (mType === 'IN' || mType === 'RETURN') {
                    projectedStock = currentStock + normalizedChange
                  } else if (mType === 'DAMAGE') {
                    projectedStock = Math.max(0, currentStock - normalizedChange)
                  } else if (mType === 'ADJUST') {
                    projectedStock = normalizedChange
                  }

                  return (
                    <div className="form-section">
                      <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="form-section-title">
                          2. Movement Type & Quantity
                        </span>
                        {isWeight && (
                          <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (movementWeightMode !== 'g') {
                                  setMovementWeightMode('g')
                                  form.setFieldsValue({ quantity: Math.round(currentQty * 1000) })
                                }
                              }}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                background: movementWeightMode === 'g' ? '#db2777' : 'transparent',
                                color: movementWeightMode === 'g' ? '#fff' : '#64748b'
                              }}
                            >
                              Grams (g)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (movementWeightMode !== 'kg') {
                                  setMovementWeightMode('kg')
                                  form.setFieldsValue({ quantity: Math.max(0.05, Math.round((currentQty / 1000) * 100) / 100) })
                                }
                              }}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                background: movementWeightMode === 'kg' ? '#db2777' : 'transparent',
                                color: movementWeightMode === 'kg' ? '#fff' : '#64748b'
                              }}
                            >
                              Kilograms (kg)
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 10 }}>
                        <Form.Item
                          name="type"
                          label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Action Type</span>}
                          initialValue="IN"
                          rules={[{ required: true, message: 'Please select an action type' }]}
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
                          label={
                            <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                              Quantity {isWeight ? `(${movementWeightMode})` : `(${selectedProd?.unit || 'pcs'})`}
                            </span>
                          }
                          rules={[
                            { required: true, message: 'Please enter quantity' },
                            {
                              validator: (_, val) => {
                                if (val === undefined || val === null || val === '') {
                                  return Promise.reject(new Error('Please enter quantity'))
                                }
                                if (Number(val) <= 0) {
                                  return Promise.reject(new Error('Quantity must be greater than 0'))
                                }
                                if (Number(val) > 1000000) {
                                  return Promise.reject(new Error('Quantity exceeds maximum limit (1,000,000)'))
                                }
                                return Promise.resolve()
                              }
                            }
                          ]}
                          initialValue={1}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={isWeight && movementWeightMode === 'g' ? 1 : 0.01}
                            step={isWeight && movementWeightMode === 'g' ? 50 : isWeight ? 0.25 : 1}
                            size="large"
                            style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                          />
                        </Form.Item>
                      </div>

                      {/* Quick Multiplier / Weight Chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Quick Add:</span>
                        {isWeight ? (
                          movementWeightMode === 'g' ? (
                            [100, 250, 500, 750, 1000, 1500, 2000, 5000].map((g) => (
                              <span
                                key={g}
                                className="form-quick-chip"
                                onClick={() => form.setFieldsValue({ quantity: g })}
                              >
                                {g < 1000 ? `${g}g` : `${g / 1000}kg (${g}g)`}
                              </span>
                            ))
                          ) : (
                            [0.25, 0.5, 0.75, 1, 1.5, 2, 5, 10].map((k) => (
                              <span
                                key={k}
                                className="form-quick-chip"
                                onClick={() => form.setFieldsValue({ quantity: k })}
                              >
                                {k} kg
                              </span>
                            ))
                          )
                        ) : (
                          [1, 5, 10, 20, 50, 100].map((q) => (
                            <span
                              key={q}
                              className="form-quick-chip"
                              onClick={() => form.setFieldsValue({ quantity: q })}
                            >
                              {q} pcs
                            </span>
                          ))
                        )}
                      </div>

                      {/* Live Calculation / Stock Preview */}
                      {selectedProd && currentQty > 0 && (
                        <div style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: 12,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>
                            Current Stock: <strong>{formatStockQty(currentStock, selectedProd.unit)}</strong>
                          </span>
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>
                            Result Stock: <strong>{formatStockQty(projectedStock, selectedProd.unit)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                }}
              </Form.Item>

              {/* Product Pricing & Cost Update */}
              <div className="form-section" style={{ marginBottom: 0 }}>
                <div className="form-section-header">
                  <span className="form-section-title">
                    3. Pricing & Reference
                  </span>
                </div>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) => prev.price !== cur.price || prev.cost_price !== cur.cost_price}
                >
                  {({ getFieldValue }) => {
                    const sellP = Number(getFieldValue('price')) || 0
                    const costP = Number(getFieldValue('cost_price')) || 0
                    const profit = sellP - costP
                    const margin = sellP > 0 && costP > 0 ? Math.round((profit / sellP) * 100) : null

                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                          <Form.Item
                            name="price"
                            label={
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>Selling Price</span>
                                {margin !== null && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: margin >= 0 ? '#16a34a' : '#dc2626' }}>
                                    Margin: {margin}%
                                  </span>
                                )}
                              </div>
                            }
                            rules={[
                              { required: true, message: 'Please enter selling price' },
                              {
                                validator: (_, val) => {
                                  if (val === undefined || val === null || val === '') {
                                    return Promise.reject(new Error('Please enter selling price'))
                                  }
                                  if (Number(val) <= 0) {
                                    return Promise.reject(new Error('Selling price must be greater than 0'))
                                  }
                                  if (Number(val) > 10000000) {
                                    return Promise.reject(new Error('Selling price exceeds maximum limit (10,000,000)'))
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
                              placeholder="e.g. 3500"
                              size="large"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700, color: 'var(--primary-dark)' }}
                              formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                            />
                          </Form.Item>

                          <Form.Item
                            name="cost_price"
                            label={<span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>Cost Price</span>}
                            rules={[
                              {
                                validator: (_, val) => {
                                  if (val !== undefined && val !== null && val !== '') {
                                    if (Number(val) < 0) {
                                      return Promise.reject(new Error('Cost price cannot be negative'))
                                    }
                                    if (Number(val) > 10000000) {
                                      return Promise.reject(new Error('Cost price exceeds maximum limit (10,000,000)'))
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
                              placeholder="e.g. 2100"
                              size="large"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                              formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                            />
                          </Form.Item>
                        </div>

                        {sellP > 0 && costP > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: 8,
                              padding: '6px 12px',
                              marginBottom: 12,
                              fontSize: 12
                            }}
                          >
                            <span style={{ color: '#166534', fontWeight: 600 }}>
                              Estimated Profit: <strong>{formatCurrency(profit)}</strong>
                            </span>
                            <span style={{ color: '#15803d', fontWeight: 700 }}>
                              Profit Margin: {margin}%
                            </span>
                          </div>
                        )}
                      </>
                    )
                  }}
                </Form.Item>

                <Form.Item
                  name="note"
                  label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Batch Reference / Note</span>}
                  rules={[
                    { max: 250, message: 'Note cannot exceed 250 characters' }
                  ]}
                  style={{ marginBottom: 6 }}
                >
                  <Input placeholder="e.g. Morning bake batch, supplier invoice..." size="large" style={{ borderRadius: 8 }} />
                </Form.Item>

                <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                  💡 Tip: You can update the Selling Price or Cost Price here. It will automatically update in the Product Catalog.
                </div>
              </div>
            </>
          ) : (
            <>
              {/* NEW ITEM FORM */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">
                    1. Product Information
                  </span>
                </div>

                <Form.Item
                  name="new_name"
                  label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Product Name / Title</span>}
                  rules={[
                    { required: true, message: 'Please enter product name' },
                    { whitespace: true, message: 'Product name cannot be blank spaces' },
                    { min: 2, message: 'Product name must be at least 2 characters' },
                    { max: 100, message: 'Product name cannot exceed 100 characters' }
                  ]}
                  style={{ marginBottom: 12 }}
                >
                  <Input placeholder="e.g. Blueberry Cheesecake 1kg" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                  <Form.Item
                    name="new_category_id"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Category (Auto Code)</span>}
                    rules={[{ required: true, message: 'Please select a category' }]}
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
                    rules={[{ required: true, message: 'Please select a unit' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      size="large"
                      style={{ borderRadius: 8 }}
                      onChange={(val) => {
                        if (val === 'g') setNewProductWeightMode('g')
                        else if (val === 'kg') setNewProductWeightMode('kg')
                      }}
                    >
                      <Select.Option value="pcs">pcs (Pieces)</Select.Option>
                      <Select.Option value="kg">kg (Kilograms)</Select.Option>
                      <Select.Option value="g">g (Grams)</Select.Option>
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
                    rules={[
                      { required: true, message: 'Please enter or generate item code' },
                      { whitespace: true, message: 'Item code cannot be blank spaces' },
                      { min: 2, message: 'Item code must be at least 2 characters' },
                      { max: 50, message: 'Item code cannot exceed 50 characters' },
                      {
                        pattern: /^[a-zA-Z0-9_\-\.\/]+$/,
                        message: 'Item code can only contain letters, numbers, hyphens, underscores, slashes, or dots'
                      }
                    ]}
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
                      <span>Auto Code</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing & Stock In */}
              <div className="form-section" style={{ marginBottom: 0 }}>
                <div className="form-section-header">
                  <span className="form-section-title">
                    3. Pricing & Initial Stock
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <Form.Item
                    name="new_price"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Selling Price (Rs.)</span>}
                    rules={[
                      { required: true, message: 'Please enter selling price' },
                      {
                        validator: (_, val) => {
                          if (val === undefined || val === null || val === '') {
                            return Promise.reject(new Error('Please enter selling price'))
                          }
                          if (Number(val) <= 0) {
                            return Promise.reject(new Error('Selling price must be greater than 0'))
                          }
                          if (Number(val) > 10000000) {
                            return Promise.reject(new Error('Selling price exceeds maximum limit (10,000,000)'))
                          }
                          return Promise.resolve()
                        }
                      }
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0.01}
                      size="large"
                      style={{ width: '100%', borderRadius: 8, fontWeight: 700, color: 'var(--primary-dark)' }}
                      formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                    />
                  </Form.Item>

                  <Form.Item
                    name="new_cost_price"
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Cost Price (Rs.)</span>}
                    rules={[
                      {
                        validator: (_, val) => {
                          if (val !== undefined && val !== null && val !== '') {
                            if (Number(val) < 0) {
                              return Promise.reject(new Error('Cost price cannot be negative'))
                            }
                            if (Number(val) > 10000000) {
                              return Promise.reject(new Error('Cost price exceeds maximum limit (10,000,000)'))
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
                      size="large"
                      style={{ width: '100%', borderRadius: 8 }}
                      formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                    />
                  </Form.Item>
                </div>

                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.new_unit !== cur.new_unit || prev.new_quantity !== cur.new_quantity}>
                  {({ getFieldValue }) => {
                    const chosenUnit = getFieldValue('new_unit') || 'pcs'
                    const isNewWeight = chosenUnit === 'kg' || chosenUnit === 'g'
                    const currentQty = Number(getFieldValue('new_quantity')) || 0

                    return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                          <Form.Item
                            name="new_quantity"
                            label={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Initial Stock</span>
                                {isNewWeight && (
                                  <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 5 }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (newProductWeightMode !== 'g') {
                                          setNewProductWeightMode('g')
                                          form.setFieldsValue({ new_quantity: Math.round(currentQty * 1000) })
                                        }
                                      }}
                                      style={{
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: newProductWeightMode === 'g' ? '#db2777' : 'transparent',
                                        color: newProductWeightMode === 'g' ? '#fff' : '#64748b'
                                      }}
                                    >
                                      g
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (newProductWeightMode !== 'kg') {
                                          setNewProductWeightMode('kg')
                                          form.setFieldsValue({ new_quantity: Math.max(0.1, Math.round((currentQty / 1000) * 100) / 100) })
                                        }
                                      }}
                                      style={{
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: newProductWeightMode === 'kg' ? '#db2777' : 'transparent',
                                        color: newProductWeightMode === 'kg' ? '#fff' : '#64748b'
                                      }}
                                    >
                                      kg
                                    </button>
                                  </div>
                                )}
                              </div>
                            }
                            rules={[
                              { required: true, message: 'Please enter initial stock quantity' },
                              {
                                validator: (_, val) => {
                                  if (val === undefined || val === null || val === '') {
                                    return Promise.reject(new Error('Please enter initial stock quantity'))
                                  }
                                  if (Number(val) < 0) {
                                    return Promise.reject(new Error('Stock quantity cannot be negative'))
                                  }
                                  if (Number(val) > 1000000) {
                                    return Promise.reject(new Error('Stock quantity exceeds maximum limit (1,000,000)'))
                                  }
                                  return Promise.resolve()
                                }
                              }
                            ]}
                            initialValue={isNewWeight ? (newProductWeightMode === 'g' ? 500 : 1) : 10}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={0}
                              step={isNewWeight ? (newProductWeightMode === 'g' ? 50 : 0.25) : 1}
                              size="large"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                            />
                          </Form.Item>

                          <Form.Item
                            name="new_note"
                            label={<span style={{ fontWeight: 600, fontSize: 12 }}>Note / Supplier Info</span>}
                            rules={[
                              { max: 250, message: 'Note cannot exceed 250 characters' }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="e.g. Initial supplier batch" size="large" style={{ borderRadius: 8 }} />
                          </Form.Item>
                        </div>

                        {/* Quick Chips for New Product */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Presets:</span>
                          {isNewWeight ? (
                            newProductWeightMode === 'g' ? (
                              [250, 500, 1000, 2000, 5000].map((g) => (
                                <span
                                  key={g}
                                  className="form-quick-chip"
                                  onClick={() => form.setFieldsValue({ new_quantity: g })}
                                >
                                  {g < 1000 ? `${g}g` : `${g / 1000}kg`}
                                </span>
                              ))
                            ) : (
                              [0.5, 1, 2, 5, 10].map((k) => (
                                <span
                                  key={k}
                                  className="form-quick-chip"
                                  onClick={() => form.setFieldsValue({ new_quantity: k })}
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
                                onClick={() => form.setFieldsValue({ new_quantity: q })}
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
              </div>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
