import React from 'react'
import { Trash2, CreditCard, ShoppingCart, Percent } from 'lucide-react'
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

  const subtotal = getSubtotal()
  const discount = getDiscountAmount()
  const total = getTotalAmount()
  const itemCount = getItemCount()

  return (
    <div className="cart-panel">
      {/* Header */}
      <div className="cart-header">
        <div className="cart-title">
          <ShoppingCart size={18} />
          <span>Current Order</span>
          {itemCount > 0 && <span className="cart-count-badge">{itemCount}</span>}
        </div>

        {items.length > 0 && (
          <button className="clear-btn" onClick={clearCart}>
            <Trash2 size={12} />
            Clear all
          </button>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="cart-empty">
          <div className="cart-empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={36} color="#94a3b8" />
          </div>
          <div className="cart-empty-text">Your cart is empty</div>
          <div className="cart-empty-sub">Click on a product to add it here</div>
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
          <div className="totals-row">
            <span className="totals-label">Discount</span>
            <span className="totals-amount discount">-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="totals-row total">
          <span className="totals-label total">Total Amount</span>
          <span className="totals-amount total">{formatCurrency(total)}</span>
        </div>

        <button className="discount-btn" onClick={onOpenDiscountModal} disabled={items.length === 0}>
          <Percent size={14} />
          Apply Discount
        </button>

        <button className="pay-btn" onClick={onOpenPaymentModal} disabled={items.length === 0}>
          <CreditCard size={18} />
          Place Order (F4)
        </button>
      </div>
    </div>
  )
}
