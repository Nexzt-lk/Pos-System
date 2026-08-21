import React from 'react'
import { Plus, Minus, Trash2, Cake } from 'lucide-react'
import { CartItem as CartItemType } from '../../store/cartStore'
import { formatCurrency } from '../../lib/formatters'

import { getProductImageSrc } from '../../lib/imageHelper'

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onEditItem?: (item: CartItemType) => void
}

export const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemoveItem, onEditItem }) => {
  const isWeight = item.unit?.toLowerCase() === 'kg' || item.unit?.toLowerCase() === 'g'
  const stepDelta = isWeight ? 0.25 : 1
  const [hasImgError, setHasImgError] = React.useState(false)

  const imgSrc = getProductImageSrc(item.image_path)

  return (
    <div className="cart-item">
      {/* 🖼️ High Quality Mini Image Thumbnail */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #fdf2f8 0%, #f1f5f9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          border: '1px solid #e2e8f0',
          cursor: onEditItem ? 'pointer' : 'default'
        }}
        onClick={() => onEditItem?.(item)}
      >
        {imgSrc && !hasImgError ? (
          <img
            src={imgSrc}
            alt={item.product_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              const clean = item.image_path?.startsWith('/') ? item.image_path.slice(1) : item.image_path
              if (e.currentTarget.src.startsWith('app-images:///')) {
                e.currentTarget.src = `/images/${clean}`
              } else {
                setHasImgError(true)
              }
            }}
          />
        ) : (
          <Cake size={20} color="#db2777" style={{ opacity: 0.7 }} />
        )}
      </div>

      {/* 📝 Name & Unit Price */}
      <div
        className="cart-item-info"
        style={{ cursor: onEditItem ? 'pointer' : 'default' }}
        onClick={() => onEditItem?.(item)}
        title="Click to adjust weight / quantity"
      >
        <div className="cart-item-name" title={item.product_name}>{item.product_name}</div>
        <div className="cart-item-price">
          {item.quantity} {item.unit || 'pcs'} × {formatCurrency(item.unit_price)}
        </div>
      </div>

      {/* 🔢 Quantity Stepper */}
      <div className="qty-stepper">
        <button
          className="qty-btn"
          title={`Decrease by ${stepDelta} ${item.unit || 'pcs'}`}
          onClick={() => {
            const nextQty = Math.max(0, Math.round((item.quantity - stepDelta) * 1000) / 1000)
            onUpdateQuantity(item.product_id, nextQty)
          }}
        >
          <Minus size={13} />
        </button>
        <span
          className="qty-num"
          style={{ cursor: onEditItem ? 'pointer' : 'default', minWidth: 44, textAlign: 'center' }}
          onClick={() => onEditItem?.(item)}
          title="Click to enter exact weight / count"
        >
          {item.quantity} {isWeight ? 'kg' : ''}
        </span>
        <button
          className="qty-btn"
          title={`Increase by ${stepDelta} ${item.unit || 'pcs'}`}
          onClick={() => {
            const nextQty = Math.round((item.quantity + stepDelta) * 1000) / 1000
            onUpdateQuantity(item.product_id, nextQty)
          }}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* 💰 Subtotal */}
      <span className="cart-item-subtotal">{formatCurrency(item.subtotal)}</span>

      {/* 🗑️ Remove */}
      <button
        className="cart-item-remove"
        title="Remove item"
        onClick={() => onRemoveItem(item.product_id)}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

