import React from 'react'
import { Plus, Cake } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'
import { useCartStore } from '../../store/cartStore'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const items = useCartStore((s) => s.items)
  const cartItem = items.find((i) => i.product_id === product.id)
  const inCartQty = cartItem?.quantity || 0

  const isOutOfStock = product.track_inventory && (product.current_stock ?? 0) <= 0
  const isLow = product.track_inventory && !isOutOfStock && (product.current_stock ?? 0) <= 5

  const getImgSrc = (path?: string) => {
    if (!path) return null
    if (path.startsWith('http') || path.startsWith('data:')) return path
    if (window.electronAPI) return `app-images:///${path}`
    return `/images/${path.startsWith('/') ? path.slice(1) : path}`
  }

  const imgSrc = getImgSrc(product.image_path)

  return (
    <div
      className={`product-card ${isOutOfStock ? 'out-of-stock' : ''} ${inCartQty > 0 ? 'selected-in-cart' : ''}`}
      onClick={() => !isOutOfStock && onAddToCart(product)}
    >
      {/* 📸 Isolated Studio Image Showcase Viewport */}
      <div className="product-card-img-wrap">
        {imgSrc ? (
          <img
            className="product-card-img"
            src={imgSrc}
            alt={product.name}
            onError={(e) => {
              if (e.currentTarget.src.startsWith('app-images:///')) {
                e.currentTarget.src = `/images/${product.image_path}`
              } else {
                e.currentTarget.style.display = 'none'
              }
            }}
          />
        ) : (
          <Cake size={38} color="#cbd5e1" />
        )}

        {/* Dynamic In-Cart Counter Pill */}
        {inCartQty > 0 && (
          <span className="card-incart-badge">
            {inCartQty} {product.unit || 'pcs'} in cart
          </span>
        )}

        {/* Stock Status Badge */}
        {product.track_inventory && (
          <span className={`stock-badge ${isOutOfStock ? 'out' : isLow ? 'low' : 'ok'}`}>
            {isOutOfStock ? 'Out of Stock' : isLow ? `Low: ${product.current_stock}` : `${product.current_stock}`}
          </span>
        )}
      </div>

      {/* 🏷️ Product Metadata & Pricing */}
      <div className="product-info">
        <span className="product-cat-label">
          {product.category_name || 'General'}
        </span>

        <div className="product-name" title={product.name}>
          {product.name}
        </div>

        {product.barcode && (
          <div style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
            {product.barcode}
          </div>
        )}

        <div className="product-footer">
          <div className="product-price">
            {formatCurrency(product.price)}
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginLeft: 3 }}>
              /{product.unit || 'pcs'}
            </span>
          </div>
          {!isOutOfStock && (
            <button
              className="card-add-btn"
              title="Add to order"
              onClick={(e) => {
                e.stopPropagation()
                onAddToCart(product)
              }}
            >
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

