import React from 'react'
import { Cake, Plus } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const isOutOfStock = product.track_inventory && (product.current_stock ?? 0) <= 0

  return (
    <div
      onClick={() => !isOutOfStock && onAddToCart(product)}
      className={`glass-card group relative flex flex-col justify-between overflow-hidden rounded-2xl p-3.5 transition-all select-none ${
        isOutOfStock
          ? 'opacity-50 cursor-not-allowed border-rose-500/30'
          : 'cursor-pointer hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10'
      }`}
    >
      {/* Top Category Indicator Pill & Stock Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider"
          style={{ backgroundColor: product.category_color || '#ec4899' }}
        >
          {product.category_name || 'General'}
        </span>

        {product.track_inventory ? (
          <span
            className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
              isOutOfStock
                ? 'bg-rose-500/20 text-rose-300'
                : (product.current_stock ?? 0) <= 5
                ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {isOutOfStock ? 'Out of Stock' : `Stock: ${product.current_stock}`}
          </span>
        ) : (
          <span className="rounded-lg bg-slate-700/40 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            Service
          </span>
        )}
      </div>

      {/* Product Image / Icon Placeholder */}
      <div className="relative mb-3 flex h-28 w-full items-center justify-center rounded-xl bg-slate-800/40 overflow-hidden group-hover:scale-[1.02] transition-transform">
        {product.image_path ? (
          <img
            src={`app-images:///${product.image_path}`}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Image fallback on broken path
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
            <Cake size={28} />
          </div>
        )}
      </div>

      {/* Product Details & Price */}
      <div>
        <h3 className="text-sm font-bold text-white line-clamp-1 leading-tight">{product.name}</h3>
        {product.barcode && (
          <p className="text-[10px] font-mono text-slate-400">Barcode: {product.barcode}</p>
        )}

        <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-700/40">
          <p className="text-base font-extrabold text-brand-400 tracking-tight">
            {formatCurrency(product.price)}
          </p>

          <button
            disabled={isOutOfStock}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-md transition-transform group-hover:scale-110 active:scale-95 disabled:opacity-0"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
