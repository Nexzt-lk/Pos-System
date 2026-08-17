import React from 'react'
import { Plus, Minus, Trash2, Tag } from 'lucide-react'
import { CartItem as CartItemType } from '../../store/cartStore'
import { formatCurrency } from '../../lib/formatters'

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onApplyDiscount: (productId: string) => void
}

export const CartItem: React.FC<CartItemProps> = ({
  item,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount
}) => {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 border border-slate-800/80 hover:border-slate-700 transition-colors">
      {/* Name & Unit Price */}
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-sm font-bold text-white truncate">{item.product_name}</h4>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{formatCurrency(item.unit_price)}</span>
          {item.discount > 0 && (
            <span className="text-emerald-400 font-semibold">
              (-{formatCurrency(item.discount)})
            </span>
          )}
        </div>
      </div>

      {/* Quantity Stepper */}
      <div className="flex items-center gap-1.5 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
        <button
          onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 active:scale-95 transition-all"
        >
          <Minus size={13} />
        </button>
        <span className="w-6 text-center text-xs font-bold text-white">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 active:scale-95 transition-all"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Subtotal & Action Buttons */}
      <div className="flex items-center gap-2 pl-3">
        <p className="w-20 text-right text-sm font-extrabold text-white">
          {formatCurrency(item.subtotal)}
        </p>

        <button
          onClick={() => onApplyDiscount(item.product_id)}
          title="Line Item Discount"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-500/20 hover:text-brand-400 transition-colors"
        >
          <Tag size={14} />
        </button>

        <button
          onClick={() => onRemoveItem(item.product_id)}
          title="Remove from Cart"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
