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
  products,
  categories,
  onAddToCart,
  isLoading
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // ⚡ Barcode Hardware Scanner Auto-Add Listener
  useBarcodeScanner((barcode) => {
    const matched = products.find((p) => p.barcode === barcode)
    if (matched) {
      onAddToCart(matched)
    }
  })

  // Filtered Products Memo
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'ALL' || product.category_id === selectedCategory
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchQuery))

      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden p-4">
      {/* 🔍 Search & Quick Action Bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cake by name or scan barcode (F2)..."
            className="w-full rounded-2xl bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 border border-slate-700/80 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>

        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* 🏷️ Horizontal Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-brand-500 text-white shadow-md glow-pink'
              : 'glass-card text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles size={14} />
          <span>All Items ({products.length})</span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id
          const itemCount = products.filter((p) => p.category_id === cat.id).length
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                isSelected
                  ? 'text-white shadow-md'
                  : 'glass-card text-slate-400 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: isSelected ? cat.color : undefined,
                borderColor: isSelected ? cat.color : undefined
              }}
            >
              {cat.name} ({itemCount})
            </button>
          )
        })}
      </div>

      {/* 🍰 Product Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm font-semibold text-slate-400 animate-pulse">Loading cake inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <AlertCircle size={40} className="text-slate-500 mb-2" />
            <p className="text-base font-bold text-slate-300">No items found</p>
            <p className="text-xs text-slate-500">Try searching for something else or change category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pb-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
