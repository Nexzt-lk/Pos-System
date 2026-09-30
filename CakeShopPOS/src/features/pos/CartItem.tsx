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
  const unitLower = item.unit?.toLowerCase() || 'pcs'
  const isKg = unitLower === 'kg'
  const isGram = unitLower === 'g'
  const isWeight = isKg || isGram

  const stepDelta = isGram ? 50 : isKg ? (item.quantity <= 0.5 ? 0.05 : 0.25) : 1
  const [hasImgError, setHasImgError] = React.useState(false)

  const imgSrc = getProductImageSrc(item.image_path, item.product_name)

  // Formatted display string for quantity (e.g., 250g, 500g, 1.5kg, 3 pcs)
  const displayQty = React.useMemo(() => {
    if (isKg) {
      if (item.quantity < 1 && item.quantity > 0) {
        return `${Math.round(item.quantity * 1000)}g`
      }
      const wholeKg = Math.floor(item.quantity)
      const remG = Math.round((item.quantity - wholeKg) * 1000)
      if (remG > 0 && wholeKg > 0) {
        return `${wholeKg}kg ${remG}g`
      }
      if (wholeKg > 0) {
        return `${wholeKg}kg`
      }
      return `${item.quantity}kg`
    }
    if (isGram) {
      if (item.quantity >= 1000) {
        const wholeKg = Math.floor(item.quantity / 1000)
        const remG = Math.round(item.quantity % 1000)
        if (remG > 0) {
          return `${wholeKg}kg ${remG}g`
        }
        return `${wholeKg}kg`
      }
      return `${Math.round(item.quantity)}g`
    }
    return `${item.quantity}`
  }, [item.quantity, isKg, isGram])

  const isTracked = Boolean(item.track_inventory)
  const availableStock = item.current_stock !== undefined ? item.current_stock : Infinity
  const isAtMaxStock = isTracked && item.quantity >= availableStock
  const isExceedingStock = isTracked && item.quantity > availableStock

  return (
    <div
      className="cart-item"
      style={isExceedingStock ? { border: '1.5px solid #fca5a5', background: '#fef2f2' } : undefined}
    >
      {/* 🖼️ High Quality Mini Image Thumbnail */}
      <div
        className="cart-item-thumb"
        onClick={() => onEditItem?.(item)}
      >
        {imgSrc && !hasImgError ? (
          <img
            src={imgSrc}
            alt={item.product_name}
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
          <Cake size={22} color="#db2777" style={{ opacity: 0.7 }} />
        )}
      </div>

      {/* 📝 Main Body Details */}
      <div className="cart-item-body">
        {/* Top: Name & Remove Button */}
        <div className="cart-item-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              className="cart-item-name"
              title={item.product_name}
              onClick={() => onEditItem?.(item)}
            >
              {item.product_name}
            </span>
            {isTracked && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: isExceedingStock ? '#dc2626' : availableStock <= 5 ? '#d97706' : '#16a34a'
                }}
              >
                {isExceedingStock
                  ? `⚠️ Store එකේ ඇත්තේ ${availableStock} ${item.unit || 'pcs'} පමණි!`
                  : `Store: ${availableStock} ${item.unit || 'pcs'}`}
              </span>
            )}
          </div>
          <button
            type="button"
            className="cart-item-remove"
            title="Remove item"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveItem(item.product_id)
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Bottom: Unit Price, Stepper & Line Subtotal */}
        <div className="cart-item-footer">
          <div
            className="cart-item-unit-price"
            onClick={() => onEditItem?.(item)}
            title="Click to adjust quantity / weight"
          >
            {formatCurrency(item.unit_price)}
            <span className="cart-item-unit-tag"> / {item.unit || 'pcs'}</span>
          </div>

          <div className="cart-item-controls">
            {/* 🔢 Quantity Stepper */}
            <div className="qty-stepper">
              <button
                type="button"
                className="qty-btn"
                title={`Decrease by ${isWeight ? (isGram ? '50g' : `${stepDelta}kg`) : '1'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  const nextQty = Math.max(0, Math.round((item.quantity - stepDelta) * 1000) / 1000)
                  onUpdateQuantity(item.product_id, nextQty)
                }}
              >
                <Minus size={12} />
              </button>
              <span
                className="qty-num"
                style={{
                  cursor: onEditItem ? 'pointer' : 'default',
                  minWidth: 32,
                  color: isExceedingStock ? '#dc2626' : undefined,
                  fontWeight: isExceedingStock ? 900 : undefined
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onEditItem?.(item)
                }}
                title="Click to enter exact weight / count (in grams or kg)"
              >
                {displayQty}
              </span>
              <button
                type="button"
                className="qty-btn"
                disabled={isAtMaxStock}
                style={isAtMaxStock ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                title={
                  isAtMaxStock
                    ? `Cannot increase: Store has only ${availableStock} ${item.unit || 'pcs'}`
                    : `Increase by ${isWeight ? (isGram ? '50g' : `${stepDelta}kg`) : '1'}`
                }
                onClick={(e) => {
                  e.stopPropagation()
                  if (isAtMaxStock) return
                  const nextQty = Math.min(
                    availableStock,
                    Math.round((item.quantity + stepDelta) * 1000) / 1000
                  )
                  onUpdateQuantity(item.product_id, nextQty)
                }}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* 💰 Subtotal */}
            <span className="cart-item-subtotal">{formatCurrency(item.subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

