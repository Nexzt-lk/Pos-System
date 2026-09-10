import React, { useEffect } from 'react'
import { X, Printer, Receipt, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDateTime, formatQuantityWithUnit } from '../../lib/formatters'
import { useAppStore } from '../../store/appStore'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  orderData: any | null
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, orderData }) => {
  const currentShop = useAppStore((state) => state.currentShop)

  const handlePrint = async () => {
    if (window.electronAPI && orderData) {
      await window.electronAPI.printReceipt({
        shopName: currentShop?.name || 'Rasa Cake House',
        address: currentShop?.address,
        phone: currentShop?.phone,
        orderNo: orderData.order_no,
        cashierName: orderData.cashier_name,
        dateTime: formatDateTime(orderData.created_at),
        items: orderData.items.map((i: any) => ({
          name: i.product_name,
          quantity: formatQuantityWithUnit(i.quantity, i.unit),
          unitPrice: i.unit_price,
          subtotal: i.subtotal
        })),
        subtotal: orderData.subtotal,
        discountAmount: orderData.discount_amount,
        taxAmount: orderData.tax_amount,
        totalAmount: orderData.total_amount,
        paymentMethod: orderData.payments?.[0]?.method || 'CASH',
        cashGiven: orderData.payments?.[0]?.cash_given,
        changeGiven: orderData.payments?.[0]?.change_given
      })
    }
  }

  // Trigger print when modal opens
  useEffect(() => {
    if (isOpen && orderData) {
      handlePrint()
    }
  }, [isOpen, orderData?.order_no])

  // Keyboard shortcut: Esc or Enter to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        handlePrint()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, orderData])

  if (!isOpen || !orderData) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 440, borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            <Receipt size={18} style={{ color: 'var(--primary)' }} />
            <span>Printed Receipt Preview</span>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Receipt Paper Card */}
        <div style={{ padding: '20px 24px 8px', background: '#f8fafc' }}>
          <div className="receipt-paper" style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '24px 20px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Store Header */}
            <div className="receipt-logo" style={{ fontSize: 18, fontWeight: 900, textAlign: 'center', color: '#0f172a', marginBottom: 4 }}>
              {currentShop?.name || 'Rasa Cake House & Bakers'}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 1.4 }}>
              {currentShop?.address || 'No. 45, Peradeniya Road, Kandy'}<br />
              Tel: {currentShop?.phone || '+94 81 223 4567'}
            </div>
            
            <div style={{ borderTop: '1.5px dashed #cbd5e1', margin: '10px 0' }} />

            {/* Meta Info */}
            <div style={{ fontSize: 11.5, lineHeight: 1.8, color: '#334155' }}>
              <div className="receipt-row"><span><strong>Order No:</strong></span><span>{orderData.order_no}</span></div>
              <div className="receipt-row"><span><strong>Date & Time:</strong></span><span>{formatDateTime(orderData.created_at)}</span></div>
              <div className="receipt-row"><span><strong>Cashier:</strong></span><span>{orderData.cashier_name || 'Cashier 1'}</span></div>
            </div>

            <div style={{ borderTop: '1.5px dashed #cbd5e1', margin: '10px 0' }} />

            {/* Items Table */}
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <div className="receipt-row" style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span>Item & Qty</span>
                <span>Amount</span>
              </div>
              {orderData.items?.map((item: any, idx: number) => (
                <div key={idx} className="receipt-row" style={{ marginBottom: 4, color: '#1e293b', fontSize: 12 }}>
                  <span>{formatQuantityWithUnit(item.quantity, item.unit)} × {item.product_name}</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1.5px dashed #cbd5e1', margin: '10px 0' }} />

            {/* Totals */}
            <div style={{ fontSize: 12, lineHeight: 1.9, color: '#334155' }}>
              <div className="receipt-row"><span>Subtotal:</span><span style={{ fontWeight: 700 }}>{formatCurrency(orderData.subtotal)}</span></div>
              {orderData.discount_amount > 0 && (
                <div className="receipt-row" style={{ color: '#ef4444', fontWeight: 800 }}>
                  <span>Discount:</span><span>-{formatCurrency(orderData.discount_amount)}</span>
                </div>
              )}
              <div className="receipt-row" style={{
                fontSize: 16,
                fontWeight: 900,
                color: '#0f172a',
                paddingTop: 6,
                marginTop: 4,
                borderTop: '1.5px solid #0f172a'
              }}>
                <span>TOTAL DUE:</span>
                <span style={{ color: '#16a34a' }}>{formatCurrency(orderData.total_amount)}</span>
              </div>
            </div>

            <div style={{ borderTop: '1.5px dashed #cbd5e1', margin: '10px 0' }} />

            {/* Payment Summary */}
            <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.8 }}>
              <div className="receipt-row"><span>Payment Method:</span><span><strong>{orderData.payments?.[0]?.method || 'CASH'}</strong></span></div>
              {orderData.payments?.[0]?.cash_given && (
                <div className="receipt-row"><span>Cash Tendered:</span><span>{formatCurrency(orderData.payments[0].cash_given)}</span></div>
              )}
              {orderData.payments?.[0]?.change_given > 0 && (
                <div className="receipt-row" style={{ fontWeight: 800, color: '#16a34a' }}>
                  <span>Change Given:</span><span>{formatCurrency(orderData.payments[0].change_given)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1.5px dashed #cbd5e1', textAlign: 'center', fontSize: 11, color: '#64748b' }}>
              <p style={{ fontWeight: 700, color: '#0f172a' }}>Thank you for your visit!</p>
              <p style={{ fontSize: 10, marginTop: 2 }}>Please come again soon</p>
              <p style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 6 }}>NEXZT POS • Think Next. Grow Now</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10, background: '#ffffff' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <CheckCircle2 size={16} color="#16a34a" />
            <span>New Order (Esc)</span>
          </button>
          <button
            onClick={handlePrint}
            className="pay-btn"
            style={{
              flex: 1.5,
              padding: '12px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Printer size={16} />
            <span>Print Receipt (P)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

