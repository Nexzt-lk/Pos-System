import React from 'react'
import { Modal } from 'antd'
import { Printer, Check, Receipt } from 'lucide-react'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import { useAppStore } from '../../store/appStore'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  orderData: any | null
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  orderData
}) => {
  const currentShop = useAppStore((state) => state.currentShop)

  if (!orderData) return null

  const handlePrint = async () => {
    if (window.electronAPI) {
      await window.electronAPI.printReceipt({
        shopName: currentShop?.name || 'Rasa Cake House',
        branchName: currentShop?.address,
        address: currentShop?.address,
        phone: currentShop?.phone,
        orderNo: orderData.order_no,
        cashierName: orderData.cashier_name,
        dateTime: formatDateTime(orderData.created_at),
        items: orderData.items.map((i: any) => ({
          name: i.product_name,
          quantity: i.quantity,
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

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      title={
        <div className="flex items-center gap-2 text-slate-100 pb-2 border-b border-slate-800">
          <Receipt size={18} className="text-brand-400" />
          <span className="font-bold text-base">Receipt Preview</span>
        </div>
      }
      className="dark-modal"
    >
      <div className="py-2 space-y-4">
        {/* Thermal Receipt Paper Visual Container */}
        <div className="rounded-2xl bg-white p-5 text-slate-900 font-mono shadow-inner text-xs leading-relaxed select-text">
          {/* Header */}
          <div className="text-center pb-2 border-b border-dashed border-slate-300">
            <h2 className="text-base font-extrabold tracking-tight uppercase">
              {currentShop?.name || 'Rasa Cake House'}
            </h2>
            <p className="text-[10px] text-slate-600">{currentShop?.address}</p>
            <p className="text-[10px] text-slate-600">Tel: {currentShop?.phone}</p>
          </div>

          {/* Order Meta */}
          <div className="py-2 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
            <p><strong>Receipt #:</strong> {orderData.order_no}</p>
            <p><strong>Date:</strong> {formatDateTime(orderData.created_at)}</p>
            <p><strong>Cashier:</strong> {orderData.cashier_name || 'Counter 1'}</p>
          </div>

          {/* Items Table */}
          <div className="py-2 border-b border-dashed border-slate-300 space-y-1.5">
            <div className="flex justify-between font-bold text-[11px]">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {orderData.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span>{item.quantity}x {item.product_name}</span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(orderData.subtotal)}</span>
            </div>
            {orderData.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Discount:</span>
                <span>-{formatCurrency(orderData.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold pt-1">
              <span>TOTAL:</span>
              <span>{formatCurrency(orderData.total_amount)}</span>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="pt-2 text-[10px] text-slate-600">
            <p>Payment: {orderData.payments?.[0]?.method || 'CASH'}</p>
            {orderData.payments?.[0]?.cash_given && (
              <p>Cash Tendered: {formatCurrency(orderData.payments[0].cash_given)}</p>
            )}
            {orderData.payments?.[0]?.change_given && (
              <p>Change: {formatCurrency(orderData.payments[0].change_given)}</p>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2 text-center border-t border-dashed border-slate-300 text-[10px] text-slate-500">
            <p>Thank you for your visit!</p>
            <p className="text-[9px]">Software by Rasa Cake POS</p>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-xs font-extrabold text-white shadow-lg glow-pink hover:bg-brand-600 active:scale-98"
          >
            <Printer size={16} />
            <span>Reprint Receipt</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
