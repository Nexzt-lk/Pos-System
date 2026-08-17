import React from 'react'
import { Trash2, CreditCard, ShoppingBag, Percent } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { CartItem } from './CartItem'
import { formatCurrency } from '../../lib/formatters'

interface CartProps {
  onOpenPaymentModal: () => void
  onOpenDiscountModal: () => void
}

export const Cart: React.FC<CartProps> = ({
  onOpenPaymentModal,
  onOpenDiscountModal
}) => {
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clearCart)

  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const getDiscountAmount = useCartStore((state) => state.getDiscountAmount)
  const getTotalAmount = useCartStore((state) => state.getTotalAmount)
  const getItemCount = useCartStore((state) => state.getItemCount)

  const subtotal = getSubtotal()
  const discount = getDiscountAmount()
  const total = getTotalAmount()
  const itemCount = getItemCount()

  return (
    <div className="flex h-full w-96 flex-col border-l border-slate-800/80 bg-slate-900/50 p-4 select-none">
      {/* Cart Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} className="text-brand-400" />
          <h2 className="text-base font-bold text-white">Current Order</h2>
          <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-xs font-bold text-brand-300">
            {itemCount}
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={clearCart}
            title="Clear all items"
            className="flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <ShoppingBag size={48} className="mb-2 text-slate-600" />
            <p className="text-sm font-semibold">Cart is empty</p>
            <p className="text-xs text-slate-600">Click products or scan barcode to add</p>
          </div>
        ) : (
          items.map((item) => (
            <CartItem
              key={item.product_id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onApplyDiscount={onOpenDiscountModal}
            />
          ))
        )}
      </div>

      {/* Order Totals & Checkout Panel */}
      <div className="pt-3 border-t border-slate-800 space-y-3">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between font-semibold text-emerald-400">
              <span>Discounts</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span className="text-base font-bold text-white">Grand Total</span>
            <span className="text-2xl font-extrabold text-brand-400 glow-pink">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={items.length === 0}
            onClick={onOpenDiscountModal}
            className="flex items-center justify-center gap-1 rounded-xl bg-slate-800/80 p-2.5 text-xs font-bold text-slate-200 border border-slate-700 hover:border-brand-500 transition-all disabled:opacity-40"
          >
            <Percent size={14} className="text-brand-400" />
            <span>Discount</span>
          </button>

          <button
            disabled={items.length === 0}
            onClick={onOpenPaymentModal}
            className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-brand-500 p-3 text-sm font-extrabold text-white shadow-lg glow-pink hover:bg-brand-600 active:scale-95 transition-all disabled:opacity-40"
          >
            <CreditCard size={18} />
            <span>PAY NOW (F4)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
