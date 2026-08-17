import React, { useState } from 'react'
import { Modal, Radio } from 'antd'
import { Banknote, CreditCard, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, generateOrderNumber } from '../../lib/formatters'
import { PaymentMethod } from '../../types/order'
import { v4 as uuidv4 } from 'uuid'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onOrderCompleted: (orderData: any) => void
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onOrderCompleted
}) => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const currentUser = useAppStore((state) => state.currentUser)

  const items = useCartStore((state) => state.items)
  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const getDiscountAmount = useCartStore((state) => state.getDiscountAmount)
  const getTotalAmount = useCartStore((state) => state.getTotalAmount)
  const discountType = useCartStore((state) => state.discountType)
  const discountValue = useCartStore((state) => state.discountValue)
  const clearCart = useCartStore((state) => state.clearCart)

  const totalAmount = getTotalAmount()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashTendered, setCashTendered] = useState<string>(totalAmount.toString())
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [customerNote, setCustomerNote] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  const numCashTendered = parseFloat(cashTendered) || 0
  const changeDue = Math.max(0, numCashTendered - totalAmount)
  const isExactOrSufficient = paymentMethod !== 'CASH' || numCashTendered >= totalAmount

  // Cash quick presets
  const quickCashPresets = [
    Math.ceil(totalAmount),
    Math.ceil(totalAmount / 500) * 500 || 500,
    Math.ceil(totalAmount / 1000) * 1000 || 1000,
    5000
  ].filter((val, idx, arr) => arr.indexOf(val) === idx && val >= totalAmount)

  const handleCompleteOrder = async () => {
    if (!currentShop || !isExactOrSufficient) return

    setIsProcessing(true)
    try {
      const orderNo = generateOrderNumber(
        currentShop.branch_code,
        currentTerminalId,
        Math.floor(Math.random() * 900) + 100 // fallback or from sequence
      )

      const orderPayload = {
        id: uuidv4(),
        shop_id: currentShop.id,
        order_no: orderNo,
        cashier_id: currentUser?.id,
        cashier_name: currentUser?.name,
        subtotal: getSubtotal(),
        discount_type: discountType,
        discount_amount: getDiscountAmount(),
        tax_amount: 0,
        total_amount: totalAmount,
        status: 'completed',
        note: customerNote || null,
        created_at: new Date().toISOString(),
        local_id: uuidv4(),
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          unit_price: i.unit_price,
          cost_price: i.cost_price,
          quantity: i.quantity,
          discount: i.discount,
          subtotal: i.subtotal
        })),
        payments: [
          {
            method: paymentMethod,
            amount: totalAmount,
            cash_given: paymentMethod === 'CASH' ? numCashTendered : undefined,
            change_given: paymentMethod === 'CASH' ? changeDue : undefined,
            reference_no: referenceNo || undefined
          }
        ]
      }

      // Save locally to SQLite via IPC
      if (window.electronAPI) {
        await window.electronAPI.dbQuery('db:create-order', orderPayload)
      }

      clearCart()
      onOrderCompleted(orderPayload)
      onClose()
    } catch (err: any) {
      console.error('Order creation failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={560}
      title={
        <div className="flex items-center gap-2 text-slate-100 pb-2 border-b border-slate-800">
          <CheckCircle2 size={20} className="text-brand-400" />
          <span className="font-bold text-base">Payment & Bill Checkout</span>
        </div>
      }
      className="dark-modal"
    >
      <div className="py-2 space-y-4 text-slate-200">
        {/* Total Amount Due Banner */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-center border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">TOTAL AMOUNT DUE</p>
          <p className="text-3xl font-extrabold text-brand-400 tracking-tight mt-0.5">
            {formatCurrency(totalAmount)}
          </p>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
            Select Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'CASH', label: 'Cash (මුදල්)', icon: Banknote },
              { id: 'CARD', label: 'Card (කාඩ්පත්)', icon: CreditCard },
              { id: 'TRANSFER', label: 'Bank Transfer', icon: ArrowRightLeft }
            ].map((method) => {
              const Icon = method.icon
              const isSelected = paymentMethod === method.id
              return (
                <button
                  key={method.id}
                  onClick={() => {
                    setPaymentMethod(method.id as PaymentMethod)
                    if (method.id === 'CASH') setCashTendered(totalAmount.toString())
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3.5 border transition-all ${
                    isSelected
                      ? 'bg-brand-500/20 border-brand-500 text-white glow-pink'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon size={22} className={isSelected ? 'text-brand-400' : ''} />
                  <span className="text-xs font-bold">{method.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cash Tendered & Change Calculator */}
        {paymentMethod === 'CASH' && (
          <div className="space-y-3 rounded-2xl bg-slate-900/80 p-4 border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Cash Tendered (Rs.)
              </label>
              <input
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xl font-mono font-bold text-white border border-slate-700 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Quick Cash Presets */}
            <div className="flex flex-wrap gap-2">
              {quickCashPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setCashTendered(preset.toString())}
                  className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  Rs. {preset.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Change Due Display */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-sm font-semibold text-slate-400">Change Due (ඉතිරිය):</span>
              <span
                className={`text-xl font-extrabold ${
                  numCashTendered < totalAmount ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {numCashTendered < totalAmount
                  ? `Short: ${formatCurrency(totalAmount - numCashTendered)}`
                  : formatCurrency(changeDue)}
              </span>
            </div>
          </div>
        )}

        {/* Reference Number for Card / Transfer */}
        {paymentMethod !== 'CASH' && (
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Card / Transaction Ref # (Optional)
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. Auth Code or Transfer Slip #"
              className="w-full rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm text-white border border-slate-700 focus:border-brand-500 focus:outline-none"
            />
          </div>
        )}

        {/* Action Button */}
        <div className="pt-3">
          <button
            disabled={!isExactOrSufficient || isProcessing}
            onClick={handleCompleteOrder}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-extrabold text-white shadow-xl glow-pink hover:bg-brand-600 active:scale-98 transition-all disabled:opacity-40"
          >
            <CheckCircle2 size={20} />
            <span>{isProcessing ? 'Processing...' : 'Complete & Print Bill (F10)'}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
