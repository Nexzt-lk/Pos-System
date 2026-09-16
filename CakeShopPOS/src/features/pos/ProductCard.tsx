import React, { useState } from 'react'
import { Plus, Cake } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'
import { useCartStore } from '../../store/cartStore'
import { getProductImageSrc } from '../../lib/imageHelper'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
  isFocused?: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isFocused }) => {
  const items = useCartStore((s) => s.items)
  const cartItem = items.find((i) => i.product_id === product.id)
  const inCartQty = cartItem?.quantity || 0

  const [hasImgError, setHasImgError] = useState(false)

  const isOutOfStock = product.track_inventory && (product.current_stock ?? 0) <= 0
  const isLow = product.track_inventory && !isOutOfStock && (product.current_stock ?? 0) <= 5

  const imgSrc = getProductImageSrc(product.image_path, product.name, product.category_name)

  return (
    <div
      className={`product-card ${isOutOfStock ? 'out-of-stock' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
      style={isFocused ? {
        border: '2px solid var(--primary)',
        boxShadow: '0 0 0 3px rgba(236, 72, 153, 0.35)',
        transform: 'translateY(-3px)'
      } : undefined}
      onClick={() => !isOutOfStock && onAddToCart(product)}
    >
      {/*   Modern Rich Product Image Viewport */}
      <div className="product-card-img-wrap">
        {imgSrc && !hasImgError ? (
          <img
            className="product-card-img"
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              const clean = product.image_path?.startsWith('/') ? product.image_path.slice(1) : product.image_path
              if (e.currentTarget.src.startsWith('app-images:///')) {
                e.currentTarget.src = `/images/${clean}`
              } else {
                setHasImgError(true)
              }
            }}
          />
        ) : (
          <div className="product-card-img-placeholder">
            <Cake size={36} color="#db2777" style={{ opacity: 0.6 }} />
          </div>
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

        </div>
      </div>
    </div>
  )
}

