import React from 'react'
import { Plus, Cake } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const isOutOfStock = product.track_inventory && (product.current_stock ?? 0) <= 0
  const isLow = product.track_inventory && !isOutOfStock && (product.current_stock ?? 0) <= 5

  return (
    <div
      className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
      onClick={() => !isOutOfStock && onAddToCart(product)}
    >
      {/* Product Image */}
      <div className="product-img-placeholder" style={{ position: 'relative' }}>
        {product.image_path ? (
          <img
            src={`app-images:///${product.image_path}`}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <span style={{ fontSize: 44 }}>🎂</span>
        )}

        {/* Stock badge */}
        {product.track_inventory && (
          <span className={`stock-badge ${isOutOfStock ? 'out' : isLow ? 'low' : 'ok'}`}
            style={{ position: 'absolute', top: 8, right: 8 }}>
            {isOutOfStock ? 'Out of Stock' : isLow ? `Low: ${product.current_stock}` : `${product.current_stock}`}
          </span>
        )}
      </div>

      {/* Product Info */}
      <div className="product-info">
        <span
          className="product-cat-label"
          style={{ backgroundColor: product.category_color || '#16a34a' }}
        >
          {product.category_name || 'General'}
        </span>

        <div className="product-name">{product.name}</div>

        {product.barcode && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {product.barcode}
          </div>
        )}

        <div className="product-footer">
          <span className="product-price">{formatCurrency(product.price)}</span>
          {!isOutOfStock && (
            <button className="add-btn" onClick={(e) => { e.stopPropagation(); onAddToCart(product) }}>
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
