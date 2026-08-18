import React from 'react'
import { Trash2, CreditCard, ShoppingCart, Percent, Tag, ArrowRight } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { CartItem } from './CartItem'
import { formatCurrency } from '../../lib/formatters'

interface CartProps {
  onOpenPaymentModal: () => void
  onOpenDiscountModal: () => void
}

export const Cart: React.FC<CartProps> = ({ onOpenPaymentModal, onOpenDiscountModal }) => {
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount)
  const getTotalAmount = useCartStore((s) => s.getTotalAmount)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const discountValue = useCartStore((s) => s.discountValue)
  const discountType = useCartStore((s) => s.discountType)

  const subtotal = getSubtotal()
  const discount = getDiscountAmount()
  const total = getTotalAmount()
  const itemCount = getItemCount()

  return (
    <div className="cart-panel">
      {/* Header */}
      <div className="cart-header">
        <div className="cart-title">
          <ShoppingCart size={18} style={{ color: 'var(--primary)' }} />
          <span>Active Ticket</span>
          {itemCount > 0 && <span className="cart-count-badge">{itemCount} items</span>}
        </div>

        {items.length > 0 && (
          <button className="clear-btn" onClick={clearCart} title="Clear all items (Esc)">
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="cart-empty">
          <div className="cart-empty-icon" style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: '#f8fafc',
            border: '1.5px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6
          }}>
            <ShoppingCart size={24} color="#94a3b8" />
          </div>
          <div className="cart-empty-text">No items on this ticket</div>
          <div className="cart-empty-sub">Tap any cake or scan barcode to add to counter</div>
        </div>
      ) : (
        <div className="cart-items">
          {items.map((item) => (
            <CartItem
              key={item.product_id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="cart-footer">
        <div className="totals-row">
          <span className="totals-label">Subtotal</span>
          <span className="totals-amount">{formatCurrency(subtotal)}</span>
        </div>

        {discount > 0 && (
          <div className="totals-row" style={{ color: '#ef4444' }}>
            <span className="totals-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={12} />
              <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'LKR'})</span>
            </span>
            <span className="totals-amount discount">-{formatCurrency(discount)}</span>
          </div>
        )}

        <div className="totals-row total">
          <span className="totals-label total">Total Due</span>
          <span className="totals-amount total">{formatCurrency(total)}</span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="discount-btn"
            onClick={onOpenDiscountModal}
            disabled={items.length === 0}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: discountValue > 0 ? '#f0fdf4' : '#ffffff',
              color: discountValue > 0 ? '#16a34a' : '#475569',
              fontWeight: 700,
              fontSize: 12,
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Percent size={14} />
            <span>{discountValue > 0 ? 'Edit Discount' : 'Discount'}</span>
          </button>
        </div>

        <button
          type="button"
          className="pay-btn"
          onClick={onOpenPaymentModal}
          disabled={items.length === 0}
        >
          <CreditCard size={18} />
          <span>Pay & Print Bill (F4)</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

