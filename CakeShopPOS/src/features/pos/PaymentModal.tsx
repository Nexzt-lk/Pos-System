import React, { useState } from 'react'
import { X, Banknote, CreditCard, Building2, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
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

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onOrderCompleted }) => {
  const currentShop = useAppStore((s) => s.currentShop)
  const currentTerminalId = useAppStore((s) => s.currentTerminalId)
  const currentUser = useAppStore((s) => s.currentUser)

  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount)
  const getTotalAmount = useCartStore((s) => s.getTotalAmount)
  const discountType = useCartStore((s) => s.discountType)
  const clearCart = useCartStore((s) => s.clearCart)

  const totalAmount = getTotalAmount()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashTendered, setCashTendered] = useState<string>(String(Math.ceil(totalAmount)))
  const [referenceNo, setReferenceNo] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const numCashTendered = parseFloat(cashTendered) || 0
  const changeDue = Math.max(0, numCashTendered - totalAmount)
  const isValid = paymentMethod !== 'CASH' || numCashTendered >= totalAmount

  const quickPresets = [
    Math.ceil(totalAmount),
    Math.ceil(totalAmount / 500) * 500,
    Math.ceil(totalAmount / 1000) * 1000,
    5000
  ].filter((v, i, a) => a.indexOf(v) === i && v >= totalAmount).slice(0, 4)

  const handleComplete = async () => {
    if (!currentShop || !isValid) return
    setIsProcessing(true)
    try {
      const orderNo = generateOrderNumber(
        currentShop.branch_code,
        currentTerminalId,
        Math.floor(Math.random() * 900) + 100
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
        created_at: new Date().toISOString(),
        local_id: uuidv4(),
        items: items.map((i) => ({
          product_id: i.product_id, product_name: i.product_name,
          unit_price: i.unit_price, cost_price: i.cost_price,
          quantity: i.quantity, discount: i.discount, subtotal: i.subtotal
        })),
        payments: [{
          method: paymentMethod, amount: totalAmount,
          cash_given: paymentMethod === 'CASH' ? numCashTendered : undefined,
          change_given: paymentMethod === 'CASH' ? changeDue : undefined,
          reference_no: referenceNo || undefined
        }]
      }

      if (window.electronAPI) await window.electronAPI.dbQuery('db:create-order', orderPayload)
      clearCart()
      onOrderCompleted(orderPayload)
      onClose()
    } catch (err: any) {
      console.error('Order creation failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />
            Payment & Checkout
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {/* Total Banner */}
          <div className="total-banner">
            <div className="total-banner-label">Total Amount Due</div>
            <div className="total-banner-amount">{formatCurrency(totalAmount)}</div>
          </div>

          {/* Payment Methods */}
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>Select Payment Method</div>
            <div className="payment-methods">
              {[
                { id: 'CASH', label: 'Cash', icon: <Banknote size={20} /> },
                { id: 'CARD', label: 'Card', icon: <CreditCard size={20} /> },
                { id: 'TRANSFER', label: 'Transfer', icon: <Building2 size={20} /> }
              ].map((m) => (
                <button
                  key={m.id}
                  className={`payment-method-btn ${paymentMethod === m.id ? 'selected' : ''}`}
                  onClick={() => { setPaymentMethod(m.id as PaymentMethod); if (m.id === 'CASH') setCashTendered(String(Math.ceil(totalAmount))) }}
                >
                  <div className="payment-method-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.icon}</div>
                  <div className="payment-method-label">{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Calculator */}
          {paymentMethod === 'CASH' && (
            <div className="cash-section">
              <div>
                <div className="field-label">Cash Tendered (Rs.)</div>
                <input
                  type="number"
                  className="cash-input"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                />
              </div>

              <div className="quick-cash">
                {quickPresets.map((p) => (
                  <button key={p} className="quick-cash-btn" onClick={() => setCashTendered(String(p))}>
                    Rs. {p.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="change-row">
                <span className="change-label">Change Due (ඉතිරිය):</span>
                <span className={`change-amount ${numCashTendered < totalAmount ? 'short' : 'ok'}`}>
                  {numCashTendered < totalAmount
                    ? `Short: ${formatCurrency(totalAmount - numCashTendered)}`
                    : formatCurrency(changeDue)}
                </span>
              </div>
            </div>
          )}

          {/* Ref No. for Card/Transfer */}
          {paymentMethod !== 'CASH' && (
            <div>
              <div className="field-label">Reference / Auth Code (Optional)</div>
              <input
                type="text"
                className="form-input"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. Card Auth Code or Slip #"
                style={{ marginTop: 6 }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="pay-btn"
            disabled={!isValid || isProcessing}
            onClick={handleComplete}
          >
            <CheckCircle2 size={18} />
            {isProcessing ? 'Processing...' : 'Complete & Print Receipt (F10)'}
          </button>
        </div>
      </div>
    </div>
  )
}
