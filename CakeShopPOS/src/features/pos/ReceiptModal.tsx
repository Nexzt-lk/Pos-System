import React, { useState, useEffect } from 'react'
import { X, Printer, Receipt, CheckCircle2, Loader2 } from 'lucide-react'
import { formatCurrency, formatDateTime, formatQuantityWithUnit } from '../../lib/formatters'
import { useAppStore } from '../../store/appStore'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  orderData: any | null
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, orderData }) => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [isPrinting, setIsPrinting] = useState(false)
  const [hasPrinted, setHasPrinted] = useState(false)

  // Reset printing state whenever a new order modal opens
  useEffect(() => {
    if (isOpen) {
      setIsPrinting(false)
      setHasPrinted(false)
    }
  }, [isOpen, orderData?.order_no])

  const handlePrint = async () => {
    // Single-click protection: cannot be pressed more than once
    if (isPrinting || hasPrinted || !orderData) return

    setIsPrinting(true)
    setHasPrinted(true)

    try {
      if (window.electronAPI && orderData) {
        const preferredPrinter = localStorage.getItem('selected_printer') || undefined
        await window.electronAPI.printReceipt({
          shopName: currentShop?.name || 'Wasana Cake - Katugastota',
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
        }, preferredPrinter)
      }
    } catch (err) {
      console.warn('Receipt print error:', err)
    } finally {
      // Automatically return back to the sales screen after printing
      setTimeout(() => {
        onClose()
      }, 700)
    }
  }

  // Keyboard shortcuts: Esc to close without print, Enter/P to print once and return
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!isPrinting) onClose()
      } else if (e.key === 'Enter' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        if (!isPrinting && !hasPrinted) {
          handlePrint()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, orderData, isPrinting, hasPrinted])

  if (!isOpen || !orderData) return null

  return (
    <div className="modal-overlay" onClick={() => { if (!isPrinting) onClose() }}>
      <div
        className="modal-box"
        style={{
          maxWidth: 460,
          width: '95vw',
          maxHeight: '92vh',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          background: '#ffffff'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header (Fixed) */}
        <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#ffffff' }}>
          <div className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            <Receipt size={18} style={{ color: 'var(--primary)' }} />
            <span>Printed Receipt Preview</span>
          </div>
          <button className="modal-close" onClick={() => { if (!isPrinting) onClose() }} disabled={isPrinting}><X size={16} /></button>
        </div>

        {/* Top Quick Actions Bar (Immediately visible right above the bill) */}
        <div style={{
          padding: '10px 20px',
          background: '#f8fafc',
          borderBottom: '1.5px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexShrink: 0
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            Total: <strong style={{ color: '#0f172a', fontSize: 13 }}>{formatCurrency(orderData.total_amount)}</strong>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPrinting}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                color: '#475569',
                cursor: isPrinting ? 'not-allowed' : 'pointer'
              }}
            >
              No Bill (Esc)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || hasPrinted}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: (isPrinting || hasPrinted) ? '#94a3b8' : 'var(--primary)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: (isPrinting || hasPrinted) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {isPrinting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Printing...</span>
                </>
              ) : hasPrinted ? (
                <>
                  <CheckCircle2 size={13} color="#22c55e" />
                  <span>Printed!</span>
                </>
              ) : (
                <>
                  <Printer size={13} />
                  <span>Print Bill (Enter)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body (Receipt paper scrolls cleanly, never pushing buttons out of view) */}
        <div style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          minHeight: 0,
          padding: '16px 20px',
          background: '#f1f5f9'
        }}>
          <div className="receipt-paper" style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '24px 20px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0',
            maxWidth: '100%',
            margin: '0 auto'
          }}>
            {/* Store Header */}
            <div className="receipt-logo" style={{ fontSize: 18, fontWeight: 900, textAlign: 'center', color: '#0f172a', marginBottom: 4 }}>
              {currentShop?.name || 'Wasana Cake - Katugastota'}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 1.4 }}>
              {currentShop?.address || 'Katugastota, Kandy'}<br />
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
                <span>Product / Qty &times; Price</span>
                <span>Total</span>
              </div>
              {orderData.items?.map((item: any, idx: number) => (
                <div key={idx} style={{ marginBottom: 6, borderBottom: '1px dotted #e2e8f0', paddingBottom: 4 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>{item.product_name}</div>
                  <div className="receipt-row" style={{ color: '#475569', fontSize: 11.5, marginTop: 2 }}>
                    <span>{formatQuantityWithUnit(item.quantity, item.unit)} &times; {formatCurrency(item.unit_price)}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(item.subtotal)}</span>
                  </div>
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
              <p style={{ fontWeight: 700, color: '#0f172a' }}>Thank you for visiting Wasana Cake! 🎂</p>
              <p style={{ fontSize: 10, marginTop: 2 }}>Please come again soon</p>
              <div style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: '1px solid #e2e8f0',
                fontSize: 12,
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Software By Nexzt.lk
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Bottom Actions Bar - ALWAYS VISIBLE AT BOTTOM */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          gap: 12,
          background: '#ffffff',
          borderTop: '1.5px solid #e2e8f0',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.05)',
          flexShrink: 0,
          zIndex: 10
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPrinting}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1.5px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: 13,
              fontWeight: 700,
              color: '#475569',
              cursor: isPrinting ? 'not-allowed' : 'pointer',
              opacity: isPrinting ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <X size={16} color="#64748b" />
            <span>No Bill / Back (Esc)</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting || hasPrinted}
            className="pay-btn"
            style={{
              flex: 1.4,
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: (isPrinting || hasPrinted) ? 'not-allowed' : 'pointer',
              opacity: (isPrinting || hasPrinted) ? 0.75 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            {isPrinting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Printing Bill...</span>
              </>
            ) : hasPrinted ? (
              <>
                <CheckCircle2 size={16} color="#22c55e" />
                <span>Printed! Returning...</span>
              </>
            ) : (
              <>
                <Printer size={16} />
                <span>Print Bill (Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

