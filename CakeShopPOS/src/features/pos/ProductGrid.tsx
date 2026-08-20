import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Sparkles, AlertCircle, Scan, X } from 'lucide-react'
import { Product, Category } from '../../types/product'
import { ProductCard } from './ProductCard'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'

interface ProductGridProps {
  products: Product[]
  categories: Category[]
  onAddToCart: (product: Product) => void
  isLoading?: boolean
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products, categories, onAddToCart, isLoading
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useBarcodeScanner((barcode) => {
    const matched = products.find((p) => p.barcode === barcode)
    if (matched) onAddToCart(matched)
  })

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery))
      return matchesCat && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  // Reset focused item when search or category changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [searchQuery, selectedCategory])

  // Keyboard shortcut listener (F2 / '/' to search, Arrow keys to navigate, Enter to select, Alt+1..9 for categories)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search: F2, '/', or Ctrl+F
      if ((e.key === 'F2' || e.key === '/' || (e.ctrlKey && e.key === 'f')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      // Alt+0 for All items, Alt+1..9 for categories
      if (e.altKey && !isNaN(Number(e.key))) {
        const num = Number(e.key)
        e.preventDefault()
        if (num === 0 || num === 1) {
          setSelectedCategory('ALL')
        } else if (categories[num - 2]) {
          setSelectedCategory(categories[num - 2].id)
        }
        return
      }

      // Arrow navigation across products
      if (filteredProducts.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setFocusedIndex((prev) => (prev + 1 < filteredProducts.length ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredProducts.length - 1))
        } else if (e.key === 'Enter') {
          // If searching or navigating, Enter opens the focused (or first) product
          const targetIndex = focusedIndex >= 0 ? focusedIndex : 0
          if (filteredProducts[targetIndex]) {
            e.preventDefault()
            onAddToCart(filteredProducts[targetIndex])
          }
        }
      }

      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredProducts, focusedIndex, categories, onAddToCart])

  return (
    <div className="catalog-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 20px', gap: 14, overflow: 'hidden' }}>
      {/* Top Station Search & Scan Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Quick Search Input */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          background: '#ffffff',
          border: '1.5px solid var(--border)',
          borderRadius: 14,
          padding: '0 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          transition: 'all 0.15s ease'
        }}>
          <Search size={16} style={{ color: '#94a3b8', marginRight: 10, flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cake name, code, or barcode (Press '/' to focus)..."
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a'
            }}
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
            >
              <X size={14} />
            </button>
          ) : (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              background: '#f1f5f9',
              padding: '2px 6px',
              borderRadius: 6,
              border: '1px solid #e2e8f0'
            }}>
              /
            </span>
          )}
        </div>

        {/* Live Barcode Scanner Radar Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '10px 14px',
          fontSize: 12,
          fontWeight: 700,
          color: '#475569',
          flexShrink: 0
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
          <Scan size={14} style={{ color: '#16a34a' }} />
          <span>Scanner Ready</span>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="category-tabs" style={{ margin: 0, paddingBottom: 2 }}>
        <button
          className={`cat-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('ALL')}
        >
          <Sparkles size={13} />
          <span>All Items</span>
          <span className="cat-count">{products.length}</span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id
          const count = products.filter((p) => p.category_id === cat.id).length
          return (
            <button
              key={cat.id}
              className={`cat-pill ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.name}</span>
              <span className="cat-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Product Grid Deck */}
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
          Loading menu items...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 10 }}>
          <AlertCircle size={44} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>No products match your search</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>Try clearing filters or search terms</span>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('ALL') }}
              style={{
                marginTop: 4,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              isFocused={focusedIndex === idx}
            />
          ))}
        </div>
      )}
    </div>
  )
}

