import React, { useState, useMemo } from 'react'
import { Search, Sparkles, AlertCircle } from 'lucide-react'
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

  return (
    <div className="catalog-panel">
      {/* Category Tabs */}
      <div className="category-tabs">
        <button
          className={`cat-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('ALL')}
        >
          <Sparkles size={13} />
          <span>All</span>
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
              style={isSelected ? { background: cat.color, borderColor: cat.color } : {}}
            >
              <span>{cat.name}</span>
              <span className="cat-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
          Loading menu items...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 8 }}>
          <AlertCircle size={40} style={{ opacity: 0.4 }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>No items found</span>
          <span style={{ fontSize: 12 }}>Try another category or search term</span>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
          ))}
        </div>
      )}
    </div>
  )
}
