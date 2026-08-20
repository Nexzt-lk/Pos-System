import React, { useState, useEffect } from 'react'
import { X, Plus, Minus, Scale, ShoppingBag, AlertTriangle, Check } from 'lucide-react'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'

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
  const isGramsUnit = product.unit?.toLowerCase() === 'g'

  // Default initial quantity: if editing existing cart item use current, otherwise 1 (or 1kg / 0.5kg)
  const [inputValue, setInputValue] = useState<string>(() => {
    if (currentCartQuantity > 0) return String(currentCartQuantity)
    return isWeightBased ? '1' : '1'
  })

  // Mode for weight input: 'kg' or 'g'
  const [weightInputMode, setWeightInputMode] = useState<'kg' | 'g'>('kg')

  // Reset when opened or product changes
  useEffect(() => {
    if (isOpen && product) {
      if (currentCartQuantity > 0) {
        setInputValue(String(currentCartQuantity))
      } else {
        setInputValue(isWeightBased ? '1' : '1')
      }
      setWeightInputMode('kg')
    }
  }, [isOpen, product?.id, currentCartQuantity])

  // Presets
  const weightPresets = [
    { label: '250 g', value: 0.25 },
    { label: '500 g (½ kg)', value: 0.5 },
    { label: '750 g', value: 0.75 },
    { label: '1.0 kg', value: 1.0 },
    { label: '1.25 kg', value: 1.25 },
    { label: '1.5 kg', value: 1.5 },
    { label: '2.0 kg', value: 2.0 },
    { label: '2.5 kg', value: 2.5 },
    { label: '3.0 kg', value: 3.0 },
    { label: '5.0 kg', value: 5.0 }
  ]

  const countPresets = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24]

  // Handlers for adjustments
  const handleSetPreset = (val: number) => {
    setInputValue(String(val))
  }

  const handleStepWeight = (deltaKg: number) => {
    const current = parseFloat(inputValue) || 0
    const next = Math.max(0.05, Math.round((current + deltaKg) * 1000) / 1000)
    setInputValue(String(next))
  }

  const handleStepCount = (delta: number) => {
    const current = parseInt(inputValue, 10) || 0
    const next = Math.max(1, current + delta)
    setInputValue(String(next))
  }

  // Keypad input handlers
  const handleKeypadDigit = (digit: string) => {
    if (digit === '.') {
      if (!inputValue.includes('.')) {
        setInputValue((prev) => (prev === '' || prev === '0' ? '0.' : prev + '.'))
      }
      return
    }
    if (inputValue === '0' || inputValue === '') {
      setInputValue(digit)
    } else {
      setInputValue((prev) => prev + digit)
    }
  }

  const handleKeypadBackspace = () => {
    setInputValue((prev) => {
      if (prev.length <= 1) return '0'
      return prev.slice(0, -1)
    })
  }

  const handleKeypadClear = () => {
    setInputValue('0')
  }

  // Toggle grams input mode
  const handleToggleWeightMode = (mode: 'kg' | 'g') => {
    if (mode === weightInputMode) return
    const num = parseFloat(inputValue) || 0
    if (mode === 'g') {
      setInputValue(String(Math.round(num * 1000)))
    } else {
      setInputValue(String(num / 1000))
    }
    setWeightInputMode(mode)
  }

  // Final quantity to commit (always normalized to product.unit)
  const getNormalizedQuantity = (): number => {
    const num = parseFloat(inputValue) || 0
    if (isWeightBased && weightInputMode === 'g' && !isGramsUnit) {
      return Math.round((num / 1000) * 1000) / 1000 // Convert g back to kg
    }
    return Math.round(num * 1000) / 1000
  }

  const normalizedQty = getNormalizedQuantity()
  const displaySubtotal = Math.round(normalizedQty * product.price * 100) / 100

  // Inventory validation
  const isStockTracked = product.track_inventory && product.current_stock !== undefined
  const maxStock = isStockTracked ? (product.current_stock ?? 0) : 999999
  const isExceedingStock = isStockTracked && normalizedQty > maxStock

  const handleConfirm = () => {
    if (normalizedQty <= 0) return
    onConfirm(product, normalizedQty)
    onClose()
  }

  // Keyboard shortcut listener (Enter to confirm, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inputValue, weightInputMode, product, normalizedQty])

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: 580,
          borderRadius: 24,
          boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
          border: '1px solid rgba(226, 232, 240, 0.9)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Product Summary */}
        <div
          className="modal-header"
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(135deg, #fdf2f8 0%, #fff 100%)',
            borderBottom: '1.5px solid #fce7f3'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#fbcfe8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#db2777',
                flexShrink: 0
              }}
            >
              {isWeightBased ? <Scale size={22} /> : <ShoppingBag size={22} />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                {product.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#be185d',
                    background: '#fce7f3',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}
                >
                  {formatCurrency(product.price)} / {product.unit || 'pcs'}
                </span>
                {isStockTracked && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isExceedingStock ? '#ef4444' : '#64748b'
                    }}
                  >
                    Stock: {product.current_stock} {product.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 24px', gap: 16 }}>
          {/* Main Quantity Display Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              borderRadius: 18,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {isWeightBased ? 'Select Weight (බර)' : 'Select Quantity (ප්‍රමාණය)'}
              </div>

              {/* Weight Unit Switcher (Kg vs Grams) */}
              {isWeightBased && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleWeightMode('kg')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: weightInputMode === 'kg' ? '#db2777' : '#e2e8f0',
                      color: weightInputMode === 'kg' ? '#fff' : '#475569',
                      transition: 'all 0.15s'
                    }}
                  >
                    Kilograms (kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleWeightMode('g')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: weightInputMode === 'g' ? '#db2777' : '#e2e8f0',
                      color: weightInputMode === 'g' ? '#fff' : '#475569',
                      transition: 'all 0.15s'
                    }}
                  >
                    Grams (g)
                  </button>
                </div>
              )}
            </div>

            {/* Big Editable Quantity / Weight Display */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  const val = e.target.value
                  if (/^\d*\.?\d*$/.test(val)) {
                    setInputValue(val)
                  }
                }}
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: isExceedingStock ? '#ef4444' : '#0f172a',
                  width: '140px',
                  textAlign: 'right',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'monospace'
                }}
                autoFocus
              />
              <span style={{ fontSize: 18, fontWeight: 800, color: '#94a3b8' }}>
                {isWeightBased ? weightInputMode : product.unit || 'pcs'}
              </span>
            </div>
          </div>

          {/* Stock Warning Alert if exceeding available quantity */}
          {isExceedingStock && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                Quantity exceeds current in-stock balance ({product.current_stock} {product.unit})
              </span>
            </div>
          )}

          {/* Presets & Steppers Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Quick Presets
            </div>

            {isWeightBased ? (
              <>
                {/* Weight Preset Buttons */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 8
                  }}
                >
                  {weightPresets.map((preset) => {
                    const isSelected = normalizedQty === preset.value
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setWeightInputMode('kg')
                          handleSetPreset(preset.value)
                        }}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 10,
                          border: isSelected ? '2px solid #db2777' : '1.5px solid #e2e8f0',
                          background: isSelected ? '#fdf2f8' : '#ffffff',
                          color: isSelected ? '#db2777' : '#1e293b',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                          transition: 'all 0.1s ease'
                        }}
                      >
                        <span>{preset.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Weight Increment / Decrement Steppers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleStepWeight(-0.25)}
                    style={stepBtnStyle}
                  >
                    <Minus size={13} /> 250g
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepWeight(-0.5)}
                    style={stepBtnStyle}
                  >
                    <Minus size={13} /> 500g
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepWeight(0.25)}
                    style={stepBtnStyle}
                  >
                    <Plus size={13} /> 250g
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepWeight(0.5)}
                    style={stepBtnStyle}
                  >
                    <Plus size={13} /> 500g
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Count Preset Buttons */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 8
                  }}
                >
                  {countPresets.map((val) => {
                    const isSelected = parseInt(inputValue, 10) === val
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSetPreset(val)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 10,
                          border: isSelected ? '2px solid #db2777' : '1.5px solid #e2e8f0',
                          background: isSelected ? '#fdf2f8' : '#ffffff',
                          color: isSelected ? '#db2777' : '#1e293b',
                          fontSize: 13,
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

                {/* Count Stepper Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleStepCount(-1)}
                    style={stepBtnStyle}
                  >
                    <Minus size={13} /> 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepCount(-5)}
                    style={stepBtnStyle}
                  >
                    <Minus size={13} /> 5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepCount(1)}
                    style={stepBtnStyle}
                  >
                    <Plus size={13} /> 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepCount(5)}
                    style={stepBtnStyle}
                  >
                    <Plus size={13} /> 5
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick Touch Keypad for Fast Cashier Numpad Operation */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              paddingTop: 4
            }}
          >
            {['1', '2', '3', '+1'].map((k) => (
              <KeypadButton
                key={k}
                label={k}
                onClick={() =>
                  k === '+1'
                    ? isWeightBased
                      ? handleStepWeight(1)
                      : handleStepCount(1)
                    : handleKeypadDigit(k)
                }
              />
            ))}
            {['4', '5', '6', '+2'].map((k) => (
              <KeypadButton
                key={k}
                label={k}
                onClick={() =>
                  k === '+2'
                    ? isWeightBased
                      ? handleStepWeight(2)
                      : handleStepCount(2)
                    : handleKeypadDigit(k)
                }
              />
            ))}
            {['7', '8', '9', 'C'].map((k) => (
              <KeypadButton
                key={k}
                label={k}
                isSpecial={k === 'C'}
                onClick={() => (k === 'C' ? handleKeypadClear() : handleKeypadDigit(k))}
              />
            ))}
            {['.', '0', '00', '⌫'].map((k) => (
              <KeypadButton
                key={k}
                label={k}
                isSpecial={k === '⌫'}
                onClick={() =>
                  k === '⌫'
                    ? handleKeypadBackspace()
                    : k === '00'
                    ? (handleKeypadDigit('0'), handleKeypadDigit('0'))
                    : handleKeypadDigit(k)
                }
              />
            ))}
          </div>

          {/* 🌟 Live Subtotal & Price Summary Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)'
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Calculated Price (මුළු ගාණ)
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginTop: 2 }}>
                {normalizedQty} {isWeightBased ? 'kg' : product.unit || 'pcs'} × {formatCurrency(product.price)}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80' }}>
              {formatCurrency(displaySubtotal)}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          className="modal-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1.5px solid #f1f5f9',
            display: 'flex',
            gap: 12,
            background: '#ffffff'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              fontSize: 13,
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
              padding: '14px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: normalizedQty <= 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Check size={18} />
            <span>
              {currentCartQuantity > 0 ? 'Update Item' : 'Add to Cart (Enter)'} • {formatCurrency(displaySubtotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const KeypadButton: React.FC<{
  label: string
  onClick: () => void
  isSpecial?: boolean
}> = ({ label, onClick, isSpecial }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 0',
        borderRadius: 10,
        border: '1.5px solid #e2e8f0',
        background: isSpecial ? '#f1f5f9' : '#ffffff',
        color: isSpecial ? '#ef4444' : '#0f172a',
        fontSize: 15,
        fontWeight: 800,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.1s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}
    >
      {label}
    </button>
  )
}

const stepBtnStyle: React.CSSProperties = {
  padding: '8px 4px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#475569',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4
}
