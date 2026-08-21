import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, Plus, Minus, Scale, AlertTriangle, Check, Cake } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'
import { getProductImageSrc } from '../../lib/imageHelper'

interface ProductQuantityModalProps {
  isOpen: boolean
  product: Product | null
  currentCartQuantity?: number
  onClose: () => void
  onConfirm: (product: Product, quantity: number) => void
}

export const ProductQuantityModal: React.FC<ProductQuantityModalProps> = ({
  isOpen,
  product,
  currentCartQuantity = 0,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !product) return null

  const isWeightBased = product.unit?.toLowerCase() === 'kg' || product.unit?.toLowerCase() === 'g'
  const [hasModalImgError, setHasModalImgError] = useState(false)
  const modalImgSrc = getProductImageSrc(product.image_path)

  // Default initial quantity: if editing existing cart item use current, otherwise 1 (or 1kg / 0.5kg)
  const [inputValue, setInputValue] = useState<string>(() => {
    if (currentCartQuantity > 0) return String(currentCartQuantity)
    return isWeightBased ? '1' : '1'
  })

  // Mode for weight items: 'kg' or 'g'
  const [weightInputMode, setWeightInputMode] = useState<'kg' | 'g'>('kg')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setHasModalImgError(false)
      const initial = currentCartQuantity > 0 ? String(currentCartQuantity) : '1'
      setInputValue(initial)
      setWeightInputMode('kg')
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen, product?.id, currentCartQuantity, isWeightBased])

  // Normalized quantity in base units (kg for weight items, integer count for pcs)
  const normalizedQty = useMemo(() => {
    const raw = parseFloat(inputValue) || 0
    if (raw <= 0) return 0
    if (isWeightBased) {
      return weightInputMode === 'g' ? Math.round((raw / 1000) * 1000) / 1000 : Math.round(raw * 1000) / 1000
    }
    return Math.max(1, Math.round(raw))
  }, [inputValue, weightInputMode, isWeightBased])

  // Calculated subtotal for this line item
  const displaySubtotal = useMemo(() => {
    if (!product || normalizedQty <= 0) return 0
    return Math.round(product.price * normalizedQty * 100) / 100
  }, [product, normalizedQty])

  // Check inventory limit
  const isStockTracked = product.track_inventory && (product.current_stock ?? 0) > 0
  const isExceedingStock = isStockTracked && normalizedQty > (product.current_stock ?? 0)

  // Handlers for adjustments
  const handleStep = (delta: number) => {
    const current = parseFloat(inputValue) || 0
    let next: number
    if (isWeightBased) {
      if (weightInputMode === 'g') {
        const deltaGrams = delta * 1000
        next = Math.max(50, Math.round(current + deltaGrams))
      } else {
        next = Math.max(0.1, Math.round((current + delta) * 100) / 100)
      }
    } else {
      next = Math.max(1, Math.round(current + delta))
    }
    setInputValue(String(next))
    inputRef.current?.focus()
  }

  const handleSetPreset = (val: number, mode: 'kg' | 'g' = 'kg') => {
    setWeightInputMode(mode)
    setInputValue(String(val))
    inputRef.current?.focus()
  }

  const handleToggleWeightMode = (newMode: 'kg' | 'g') => {
    if (newMode === weightInputMode) return
    const current = parseFloat(inputValue) || 0
    if (newMode === 'g') {
      setInputValue(String(Math.round(current * 1000)))
    } else {
      setInputValue(String(Math.round((current / 1000) * 100) / 100))
    }
    setWeightInputMode(newMode)
    inputRef.current?.focus()
  }

  const handleConfirm = () => {
    if (normalizedQty > 0) {
      onConfirm(product, normalizedQty)
      onClose()
    }
  }

  // Keyboard Shortcuts (Enter to confirm, Esc to close, Arrow keys / +/- to step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      } else if (e.key === 'ArrowUp' || e.key === '+') {
        e.preventDefault()
        handleStep(isWeightBased ? (weightInputMode === 'g' ? 0.25 : 0.25) : 1)
      } else if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault()
        handleStep(isWeightBased ? (weightInputMode === 'g' ? -0.25 : -0.25) : -1)
      } else if (isWeightBased && (e.key === 'k' || e.key === 'K') && document.activeElement !== inputRef.current) {
        e.preventDefault()
        handleToggleWeightMode('kg')
      } else if (isWeightBased && (e.key === 'g' || e.key === 'G') && document.activeElement !== inputRef.current) {
        e.preventDefault()
        handleToggleWeightMode('g')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inputValue, weightInputMode, product, normalizedQty, isWeightBased])

  // Weight & Count Presets
  const weightPresets = [
    { label: '250g', val: 250, mode: 'g' as const },
    { label: '500g', val: 500, mode: 'g' as const },
    { label: '1.0 kg', val: 1, mode: 'kg' as const },
    { label: '1.5 kg', val: 1.5, mode: 'kg' as const },
    { label: '2.0 kg', val: 2, mode: 'kg' as const },
    { label: '2.5 kg', val: 2.5, mode: 'kg' as const },
    { label: '3.0 kg', val: 3, mode: 'kg' as const },
    { label: '5.0 kg', val: 5, mode: 'kg' as const }
  ]

  const countPresets = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: 430,
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '12px 18px',
            background: 'linear-gradient(135deg, #fdf2f8 0%, #ffffff 100%)',
            borderBottom: '1.5px solid #fce7f3'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #fdf2f8 0%, #f1f5f9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#db2777',
                border: '1.5px solid #fce7f3',
                flexShrink: 0
              }}
            >
              {modalImgSrc && !hasModalImgError ? (
                <img
                  src={modalImgSrc}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    const clean = product.image_path?.startsWith('/') ? product.image_path.slice(1) : product.image_path
                    if (e.currentTarget.src.startsWith('app-images:///')) {
                      e.currentTarget.src = `/images/${clean}`
                    } else {
                      setHasModalImgError(true)
                    }
                  }}
                />
              ) : isWeightBased ? (
                <Scale size={20} />
              ) : (
                <Cake size={20} color="#db2777" style={{ opacity: 0.8 }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                {product.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#be185d',
                    background: '#fce7f3',
                    padding: '2px 7px',
                    borderRadius: 6
                  }}
                >
                  {formatCurrency(product.price)} / {product.unit || 'pcs'}
                </span>
                {isStockTracked && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: isExceedingStock ? '#ef4444' : '#64748b'
                    }}
                  >
                    Stock: {product.current_stock}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Main Quantity Stepper & Direct Type Input */}
          <div
            style={{
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              borderRadius: 16,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}
          >
            {/* Left: Unit Switcher (kg/g) or Label */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {isWeightBased ? 'Weight (බර)' : 'Quantity (ගණන)'}
              </div>
              {isWeightBased && (
                <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleWeightMode('kg')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: weightInputMode === 'kg' ? '#db2777' : '#e2e8f0',
                      color: weightInputMode === 'kg' ? '#fff' : '#475569'
                    }}
                  >
                    Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleWeightMode('g')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: weightInputMode === 'g' ? '#db2777' : '#e2e8f0',
                      color: weightInputMode === 'g' ? '#fff' : '#475569'
                    }}
                  >
                    g
                  </button>
                </div>
              )}
            </div>

            {/* Middle & Right: Stepper Controls + Editable Value */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleStep(isWeightBased ? (weightInputMode === 'g' ? -250 : -0.25) : -1)}
                style={stepperBtnStyle}
                title="Decrease (-)"
              >
                <Minus size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'baseline', minWidth: 80, justifyContent: 'center' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^\d*\.?\d*$/.test(val)) {
                      setInputValue(val)
                    }
                  }}
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: isExceedingStock ? '#ef4444' : '#0f172a',
                    width: '85px',
                    textAlign: 'center',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'monospace'
                  }}
                  autoFocus
                />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>
                  {isWeightBased ? weightInputMode : product.unit || 'pcs'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleStep(isWeightBased ? (weightInputMode === 'g' ? 250 : 0.25) : 1)}
                style={stepperBtnStyle}
                title="Increase (+)"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Stock Warning Alert */}
          {isExceedingStock && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 11,
                fontWeight: 700
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>
                Quantity exceeds stock ({product.current_stock} {product.unit})
              </span>
            </div>
          )}

          {/* Quick Preset Buttons (Compact Grid) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
              Quick Presets
            </div>

            {isWeightBased ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {weightPresets.map((p) => {
                  const isMatch =
                    (p.mode === 'kg' && weightInputMode === 'kg' && parseFloat(inputValue) === p.val) ||
                    (p.mode === 'g' && weightInputMode === 'g' && parseFloat(inputValue) === p.val) ||
                    (p.mode === 'g' && weightInputMode === 'kg' && parseFloat(inputValue) === p.val / 1000)
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSetPreset(p.val, p.mode)}
                      style={{
                        padding: '7px 4px',
                        borderRadius: 8,
                        border: isMatch ? '2px solid #db2777' : '1px solid #e2e8f0',
                        background: isMatch ? '#fdf2f8' : '#ffffff',
                        color: isMatch ? '#db2777' : '#1e293b',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {countPresets.map((val) => {
                  const isMatch = parseInt(inputValue, 10) === val
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSetPreset(val)}
                      style={{
                        padding: '7px 4px',
                        borderRadius: 8,
                        border: isMatch ? '2px solid #db2777' : '1px solid #e2e8f0',
                        background: isMatch ? '#fdf2f8' : '#ffffff',
                        color: isMatch ? '#db2777' : '#1e293b',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Increment Chips (+250g / +500g / +1 / +5) */}
          <div style={{ display: 'flex', gap: 6 }}>
            {isWeightBased ? (
              <>
                <button
                  type="button"
                  onClick={() => handleStep(0.25)}
                  style={chipBtnStyle}
                >
                  +250g
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(0.5)}
                  style={chipBtnStyle}
                >
                  +500g
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  style={chipBtnStyle}
                >
                  +1.0 kg
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  style={chipBtnStyle}
                >
                  +1 pcs
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(5)}
                  style={chipBtnStyle}
                >
                  +5 pcs
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(10)}
                  style={chipBtnStyle}
                >
                  +10 pcs
                </button>
              </>
            )}
          </div>

          {/* 🌟 Compact Live Price Summary Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)'
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Total Item Price (මුළු ගාණ)
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginTop: 1 }}>
                {normalizedQty} {isWeightBased ? 'kg' : product.unit || 'pcs'} × {formatCurrency(product.price)}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#4ade80' }}>
              {formatCurrency(displaySubtotal)}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 18px',
            borderTop: '1.5px solid #f1f5f9',
            display: 'flex',
            gap: 10,
            background: '#ffffff'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={normalizedQty <= 0}
            className="pay-btn"
            style={{
              flex: 2,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: normalizedQty <= 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Check size={16} />
            <span>
              {currentCartQuantity > 0 ? 'Update Item' : 'Add to Cart (Enter)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const stepperBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  background: '#ffffff',
  color: '#0f172a',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

const chipBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 4px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#475569',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center'
}
