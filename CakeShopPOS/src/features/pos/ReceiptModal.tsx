import React from 'react'
import { X, Printer, Receipt } from 'lucide-react'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import { useAppStore } from '../../store/appStore'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  orderData: any | null
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, orderData }) => {
  const currentShop = useAppStore((state) => state.currentShop)

  if (!isOpen || !orderData) return null

  const handlePrint = async () => {
    if (window.electronAPI) {
      await window.electronAPI.printReceipt({
        shopName: currentShop?.name || 'Rasa Cake House',
        address: currentShop?.address,
        phone: currentShop?.phone,
        orderNo: orderData.order_no,
        cashierName: orderData.cashier_name,
        dateTime: formatDateTime(orderData.created_at),
        items: orderData.items.map((i: any) => ({
          name: i.product_name, quantity: i.quantity,
          unitPrice: i.unit_price, subtotal: i.subtotal
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Receipt size={18} style={{ color: 'var(--primary)' }} />
            Receipt Preview
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Receipt Paper */}
        <div style={{ padding: '16px 20px 0' }}>
          <div className="receipt-paper">
            {/* Header */}
            <div className="receipt-logo">
              🎂 {currentShop?.name || 'Rasa Cake House'}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 8 }}>
              {currentShop?.address}<br />
              Tel: {currentShop?.phone}
            </div>
            <hr className="receipt-divider" />

            {/* Meta */}
            <div style={{ fontSize: 11, lineHeight: 1.8, marginBottom: 6 }}>
              <div className="receipt-row"><span><strong>Receipt #:</strong></span><span>{orderData.order_no}</span></div>
              <div className="receipt-row"><span><strong>Date:</strong></span><span>{formatDateTime(orderData.created_at)}</span></div>
              <div className="receipt-row"><span><strong>Cashier:</strong></span><span>{orderData.cashier_name || 'Counter 1'}</span></div>
            </div>
            <hr className="receipt-divider" />

            {/* Items */}
            <div style={{ fontSize: 11, marginBottom: 6 }}>
              <div className="receipt-row" style={{ fontWeight: 700, marginBottom: 4 }}>
                <span>Item</span><span>Total</span>
              </div>
              {orderData.items?.map((item: any, idx: number) => (
                <div key={idx} className="receipt-row" style={{ marginBottom: 2 }}>
                  <span>{item.quantity}× {item.product_name}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <hr className="receipt-divider" />

            {/* Totals */}
            <div style={{ fontSize: 11, marginBottom: 6 }}>
              <div className="receipt-row"><span>Subtotal:</span><span>{formatCurrency(orderData.subtotal)}</span></div>
              {orderData.discount_amount > 0 && (
                <div className="receipt-row" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                  <span>Discount:</span><span>-{formatCurrency(orderData.discount_amount)}</span>
                </div>
              )}
              <div className="receipt-row receipt-total" style={{ marginTop: 4 }}>
                <span>TOTAL:</span><span>{formatCurrency(orderData.total_amount)}</span>
              </div>
            </div>
            <hr className="receipt-divider" />

            {/* Payment */}
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              <div>Payment: <strong>{orderData.payments?.[0]?.method || 'CASH'}</strong></div>
              {orderData.payments?.[0]?.cash_given && (
                <div>Cash Tendered: {formatCurrency(orderData.payments[0].cash_given)}</div>
              )}
              {orderData.payments?.[0]?.change_given > 0 && (
                <div>Change: <strong>{formatCurrency(orderData.payments[0].change_given)}</strong></div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1.5px dashed #d1d5db', textAlign: 'center', fontSize: 10, color: '#888' }}>
              <p>ස්තූතියි! Thank you for visiting!</p>
              <p style={{ fontSize: 9 }}>Powered by Rasa Cake POS</p>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}>
            Close
          </button>
          <button onClick={handlePrint} className="pay-btn" style={{ flex: 2 }}>
            <Printer size={16} />
            Reprint Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
