import React, { useState } from 'react'
import { Cake } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'
import { getProductImageSrc } from '../../lib/imageHelper'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
  isFocused?: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isFocused }) => {

  const [hasImgError, setHasImgError] = useState(false)

  const isOutOfStock = product.track_inventory && (product.current_stock ?? 0) <= 0
  const isLow = product.track_inventory && !isOutOfStock && (product.current_stock ?? 0) <= 5

  const activeImagePath = product.image_path || (product as any).imagePath
  const imgSrc = getProductImageSrc(activeImagePath, product.name, product.category_name)

  return (
    <div
      className={`product-card ${isOutOfStock ? 'out-of-stock' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
      style={isFocused ? {
        border: '2px solid var(--primary)',
        boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)',
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
              const clean = activeImagePath?.replace(/^\/+/, '') || ''
              if (e.currentTarget.src.startsWith('app-images:///')) {
                // Try relative web path or localStorage
                const cached = typeof window !== 'undefined' ? localStorage.getItem(`pos_img_${clean}`) : null
                if (cached) {
                  e.currentTarget.src = cached
                } else {
                  e.currentTarget.src = `/images/${clean}`
                }
              } else {
                setHasImgError(true)
              }
            }}
          />
        ) : (
          <div className="product-card-img-placeholder">
            <Cake size={36} color="#16a34a" style={{ opacity: 0.6 }} />
          </div>
        )}


        {/* Stock Status Badge */}
        {product.track_inventory && (
          <span className={`stock-badge ${isOutOfStock ? 'out' : isLow ? 'low' : 'ok'}`}>
            {isOutOfStock 
              ? 'Out of Stock' 
              : isLow 
              ? `Low: ${product.current_stock} ${product.unit || 'pcs'}` 
              : `Stock: ${product.current_stock} ${product.unit || 'pcs'}`}
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

          {product.track_inventory ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: isOutOfStock ? '#fee2e2' : isLow ? '#fef3c7' : '#f0fdf4',
                color: isOutOfStock ? '#b91c1c' : isLow ? '#b45309' : '#15803d',
                border: `1px solid ${isOutOfStock ? '#fca5a5' : isLow ? '#fde68a' : '#bbf7d0'}`,
                whiteSpace: 'nowrap'
              }}
            >
              {isOutOfStock ? 'තොග අවසන්' : `Store: ${product.current_stock} ${product.unit || 'pcs'}`}
            </span>
          ) : (
            <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
              Unmetered
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

