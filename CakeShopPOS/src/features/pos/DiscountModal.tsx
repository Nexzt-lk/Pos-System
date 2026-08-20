import React, { useState } from 'react'
import { Modal } from 'antd'
import { Percent, DollarSign, Tag, Check } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { DiscountType } from '../../types/order'
import { formatCurrency } from '../../lib/formatters'

interface DiscountModalProps {
  isOpen: boolean
  onClose: () => void
}

export const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose }) => {
  const discountType = useCartStore((s) => s.discountType)
  const discountValue = useCartStore((s) => s.discountValue)
  const setOrderDiscount = useCartStore((s) => s.setOrderDiscount)
  const getSubtotal = useCartStore((s) => s.getSubtotal)

  const [type, setType] = useState<DiscountType>(discountType || 'percent')
  const [val, setVal] = useState<number>(discountValue || 0)

  const subtotal = getSubtotal()

  const handleApply = () => {
    setOrderDiscount(type, Number(val) || 0)
    onClose()
  }

  const handleClear = () => {
    setOrderDiscount('percent', 0)
    setVal(0)
    onClose()
  }

  const calculatedDiscount = type === 'percent' ? (subtotal * (Number(val) || 0)) / 100 : Number(val) || 0

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
          <Tag size={18} color="var(--primary)" />
          <span>Apply Order Discount</span>
        </div>
      }
      centered
      width={420}
    >
      <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Discount Type Selector */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 12,
          gap: 4
        }}>
          <button
            type="button"
            onClick={() => setType('percent')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: type === 'percent' ? '#ffffff' : 'transparent',
              color: type === 'percent' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: type === 'percent' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Percent size={14} />
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setType('fixed')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: type === 'fixed' ? '#ffffff' : 'transparent',
              color: type === 'fixed' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: type === 'fixed' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <DollarSign size={14} />
            Fixed Amount (LKR)
          </button>
        </div>

        {/* Value Input */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            Discount Value ({type === 'percent' ? '%' : 'LKR'})
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            padding: '0 14px'
          }}>
            <input
              type="number"
              min="0"
              max={type === 'percent' ? 100 : subtotal}
              value={val || ''}
              onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
              placeholder={type === 'percent' ? 'e.g. 10' : 'e.g. 250'}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 0',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 18,
                fontWeight: 800,
                color: '#0f172a'
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
              {type === 'percent' ? '%' : 'LKR'}
            </span>
          </div>
        </div>

        {/* Quick Preset Buttons */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            Quick Presets
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {type === 'percent' ? (
              [5, 10, 15, 20].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setVal(p)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: val === p ? 'var(--primary-bg)' : '#ffffff',
                    color: val === p ? 'var(--primary-dark)' : '#475569',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {p}%
                </button>
              ))
            ) : (
              [100, 200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setVal(amt)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: val === amt ? 'var(--primary-bg)' : '#ffffff',
                    color: val === amt ? 'var(--primary-dark)' : '#475569',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Rs. {amt}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Live Calculation Preview */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 12,
          padding: 12,
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12
        }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Discount Deduction:</span>
          <span style={{ fontWeight: 800, color: '#ef4444', fontSize: 14 }}>
            -{formatCurrency(calculatedDiscount)}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          {discountValue > 0 && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Remove Discount
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Check size={16} />
            Apply Discount
          </button>
        </div>
      </div>
    </Modal>
  )
}
