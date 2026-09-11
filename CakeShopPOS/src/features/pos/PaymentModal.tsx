import React, { useState, useEffect, useRef } from 'react'
import { X, Banknote, CreditCard, Building2, CheckCircle2 } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, generateOrderNumber } from '../../lib/formatters'
import { PaymentMethod } from '../../types/order'
import { ordersApi, CreateSaleRequest } from '../../api/ordersApi'
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

  const cashInputRef = useRef<HTMLInputElement>(null)

  const numCashTendered = parseFloat(cashTendered) || 0
  const changeDue = Math.max(0, numCashTendered - totalAmount)
  const isValid = paymentMethod !== 'CASH' || numCashTendered >= totalAmount

  const quickPresets = [
    Math.ceil(totalAmount),
    Math.ceil(totalAmount / 500) * 500,
    Math.ceil(totalAmount / 1000) * 1000,
    5000
  ].filter((v, i, a) => a.indexOf(v) === i && v >= totalAmount).slice(0, 4)

  // Auto-focus and initialize when opened
  useEffect(() => {
    if (isOpen) {
      setCashTendered(String(Math.ceil(totalAmount)))
      setPaymentMethod('CASH')
      setReferenceNo('')
      setTimeout(() => {
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      }, 60)
    }
  }, [isOpen, totalAmount])

  // Keyboard Shortcuts (Enter / F10 to complete, Esc to cancel, F1/F2/F3 for methods)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter' || e.key === 'F10') {
        e.preventDefault()
        if (isValid && !isProcessing) {
          handleComplete()
        }
      } else if (e.key === 'F1') {
        e.preventDefault()
        setPaymentMethod('CASH')
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      } else if (e.key === 'F2') {
        e.preventDefault()
        setPaymentMethod('CARD')
      } else if (e.key === 'F3') {
        e.preventDefault()
        setPaymentMethod('TRANSFER')
      } else if (e.key === 'F5' && quickPresets[0]) {
        e.preventDefault()
        setCashTendered(String(quickPresets[0]))
      } else if (e.key === 'F6' && quickPresets[1]) {
        e.preventDefault()
        setCashTendered(String(quickPresets[1]))
      } else if (e.key === 'F7' && quickPresets[2]) {
        e.preventDefault()
        setCashTendered(String(quickPresets[2]))
      } else if (e.key === 'F8' && quickPresets[3]) {
        e.preventDefault()
        setCashTendered(String(quickPresets[3]))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isValid, isProcessing, numCashTendered, totalAmount, paymentMethod, quickPresets])

  const handleComplete = async () => {
    if (!currentShop || !isValid) return
    setIsProcessing(true)

    const orderId = uuidv4()
    const idempotencyKey = uuidv4()
    const orderNoFallback = generateOrderNumber(
      currentShop.branch_code,
      currentTerminalId,
      Math.floor(Math.random() * 900) + 100
    )

    const orderPayload = {
      id: orderId,
      shop_id: currentShop.id,
      order_no: orderNoFallback,
      cashier_id: currentUser?.id,
      cashier_name: currentUser?.name || 'Cashier 1',
      subtotal: getSubtotal(),
      discount_type: discountType,
      discount_amount: getDiscountAmount(),
      tax_amount: 0,
      total_amount: totalAmount,
      status: 'completed',
      created_at: new Date().toISOString(),
      local_id: orderId,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: i.unit_price,
        cost_price: i.cost_price,
        quantity: i.quantity,
        discount: i.discount,
        subtotal: i.subtotal
      })),
      payments: [{
        method: paymentMethod,
        amount: totalAmount,
        cash_given: paymentMethod === 'CASH' ? numCashTendered : undefined,
        change_given: paymentMethod === 'CASH' ? changeDue : undefined,
        reference_no: referenceNo || undefined
      }]
    }

    try {
      // 1. Direct local SQLite database insert & inventory decrement (Offline-First POS)
      if (window.electronAPI?.dbQuery) {
        try {
          const res = await window.electronAPI.dbQuery('db:create-order', orderPayload)
          if (res && res.orderNo) {
            orderPayload.order_no = res.orderNo
          }
          window.electronAPI.triggerSync?.()
        } catch (dbErr) {
          console.warn('Local electron db save error:', dbErr)
        }
      }

      // 2. Also notify Backend API if connected
      const saleRequest: CreateSaleRequest = {
        idempotencyKey,
        localId: orderId,
        cashierId: currentUser?.id,
        terminalId: currentTerminalId || 'T1',
        items: items.map((i) => ({
          productId: i.product_id,
          quantity: i.quantity,
          discount: i.discount || 0
        })),
        discountType: discountType || undefined,
        discountAmount: getDiscountAmount(),
        taxAmount: 0,
        paymentMethod: paymentMethod,
        cashGiven: paymentMethod === 'CASH' ? numCashTendered : undefined,
        cardReferenceNo: referenceNo || undefined
      }

      try {
        const backendOrder = await ordersApi.createSale(saleRequest, idempotencyKey)
        if (backendOrder && backendOrder.orderNo) {
          orderPayload.order_no = backendOrder.orderNo
          orderPayload.id = backendOrder.id
        }
      } catch (apiErr) {
        console.warn('Backend API sale notification skipped (Offline mode):', apiErr)
      }
    } finally {
      window.dispatchEvent(new CustomEvent('pos:order-completed', { detail: orderPayload }))
      clearCart()
      onOrderCompleted(orderPayload)
      onClose()
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
                { id: 'CASH', label: 'Cash (F1)', icon: <Banknote size={20} /> },
                { id: 'CARD', label: 'Card (F2)', icon: <CreditCard size={20} /> },
                { id: 'TRANSFER', label: 'Transfer (F3)', icon: <Building2 size={20} /> }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`payment-method-btn ${paymentMethod === m.id ? 'selected' : ''}`}
                  onClick={() => {
                    setPaymentMethod(m.id as PaymentMethod)
                    if (m.id === 'CASH') {
                      setCashTendered(String(Math.ceil(totalAmount)))
                      cashInputRef.current?.focus()
                    }
                  }}
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
                  ref={cashInputRef}
                  type="number"
                  className="cash-input"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                />
              </div>

              <div className="quick-cash">
                {quickPresets.map((p, idx) => (
                  <button
                    key={p}
                    type="button"
                    className="quick-cash-btn"
                    onClick={() => setCashTendered(String(p))}
                    title={`Shortcut: F${idx + 5}`}
                  >
                    Rs. {p.toLocaleString()} <span style={{ opacity: 0.5, fontSize: 10 }}>[F{idx + 5}]</span>
                  </button>
                ))}
              </div>

              <div className="change-row">
                <span className="change-label">Change Due:</span>
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
