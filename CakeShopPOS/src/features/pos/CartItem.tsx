import React from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { CartItem as CartItemType } from '../../store/cartStore'
import { formatCurrency } from '../../lib/formatters'

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
}

export const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemoveItem }) => {
  return (
    <div className="cart-item">
      {/* Info */}
      <div className="cart-item-info">
        <div className="cart-item-name">{item.product_name}</div>
        <div className="cart-item-price">{formatCurrency(item.unit_price)} each</div>
      </div>

      {/* Qty Stepper */}
      <div className="qty-stepper">
        <button className="qty-btn" onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}>
          <Minus size={12} />
        </button>
        <span className="qty-num">{item.quantity}</span>
        <button className="qty-btn" onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}>
          <Plus size={12} />
        </button>
      </div>

      {/* Subtotal */}
      <span className="cart-item-subtotal">{formatCurrency(item.subtotal)}</span>

      {/* Remove */}
      <button className="cart-item-remove" onClick={() => onRemoveItem(item.product_id)}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}
