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
  const isBaseUnitGram = product.unit?.toLowerCase() === 'g'
  const [hasModalImgError, setHasModalImgError] = useState(false)
  const modalImgSrc = getProductImageSrc(product.image_path, product.name)

  const [weightInputMode, setWeightInputMode] = useState<'kg' | 'g'>('g')
  const [inputValue, setInputValue] = useState<string>('1')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && product) {
      setHasModalImgError(false)
      const isWeight = product.unit?.toLowerCase() === 'kg' || product.unit?.toLowerCase() === 'g'
      
      if (isWeight) {
        if (currentCartQuantity > 0) {
          if (product.unit?.toLowerCase() === 'g') {
            setWeightInputMode('g')
            setInputValue(String(Math.round(currentCartQuantity)))
          } else {
            if (currentCartQuantity < 3) {
              setWeightInputMode('g')
              setInputValue(String(Math.round(currentCartQuantity * 1000)))
            } else {
              setWeightInputMode('kg')
              setInputValue(String(currentCartQuantity))
            }
          }
        } else {
          setWeightInputMode('g')
          setInputValue('500')
        }
      } else {
        const initial = currentCartQuantity > 0 ? String(currentCartQuantity) : '1'
        setInputValue(initial)
      }

      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen, product?.id, currentCartQuantity, product?.unit])

  const normalizedQty = useMemo(() => {
    const raw = parseFloat(inputValue) || 0
    if (raw <= 0) return 0
    if (isWeightBased) {
      if (isBaseUnitGram) {
        return weightInputMode === 'kg' ? Math.round(raw * 1000) : Math.round(raw)
      } else {
        return weightInputMode === 'g' ? Math.round((raw / 1000) * 1000) / 1000 : Math.round(raw * 1000) / 1000
      }
    }
    return Math.max(1, Math.round(raw))
  }, [inputValue, weightInputMode, isWeightBased, isBaseUnitGram])

  const displaySubtotal = useMemo(() => {
    if (!product || normalizedQty <= 0) return 0
    return Math.round(product.price * normalizedQty * 100) / 100
  }, [product, normalizedQty])

  const weightBreakdownText = useMemo(() => {
    if (!isWeightBased) {
      return `${normalizedQty} ${product.unit || 'pcs'} × ${formatCurrency(product.price)}`
    }
    const raw = parseFloat(inputValue) || 0
    if (isBaseUnitGram) {
      if (weightInputMode === 'kg') {
        return `${raw} kg (${Math.round(raw * 1000)}g) × ${formatCurrency(product.price)} / g`
      }
      return `${raw}g × ${formatCurrency(product.price)} / g`
    } else {
      if (weightInputMode === 'g') {
        return `${raw}g (${normalizedQty} kg) × ${formatCurrency(product.price)} / kg`
      }
      return `${raw} kg (${Math.round(raw * 1000)}g) × ${formatCurrency(product.price)} / kg`
    }
  }, [isWeightBased, isBaseUnitGram, weightInputMode, inputValue, normalizedQty, product])

  const isStockTracked = product.track_inventory && (product.current_stock ?? 0) > 0
  const isExceedingStock = isStockTracked && normalizedQty > (product.current_stock ?? 0)

  const handleStep = (delta: number) => {
    const current = parseFloat(inputValue) || 0
    let next: number
    if (isWeightBased) {
      if (weightInputMode === 'g') {
        const deltaGrams = delta >= 1 ? delta : delta * 1000
        next = Math.max(50, Math.round(current + deltaGrams))
      } else {
        const deltaKg = delta >= 10 ? delta / 1000 : delta
        next = Math.max(0.05, Math.round((current + deltaKg) * 100) / 100)
      }
    } else {
      next = Math.max(1, Math.round(current + delta))
    }
    setInputValue(String(next))
    inputRef.current?.focus()
  }

  const handleSetPreset = (val: number, mode: 'kg' | 'g') => {
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
        handleStep(isWeightBased ? (weightInputMode === 'g' ? 50 : 0.25) : 1)
      } else if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault()
        handleStep(isWeightBased ? (weightInputMode === 'g' ? -50 : -0.25) : -1)
      } else if (isWeightBased && (e.key === 'g' || e.key === 'G') && document.activeElement !== inputRef.current) {
        e.preventDefault()
        handleToggleWeightMode('g')
      } else if (isWeightBased && (e.key === 'k' || e.key === 'K') && document.activeElement !== inputRef.current) {
        e.preventDefault()
        handleToggleWeightMode('kg')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inputValue, weightInputMode, product, normalizedQty, isWeightBased])

  // Clean, uncluttered Presets with single-line labels
  const gramPresets = [
    { label: '100g', val: 100, mode: 'g' as const },
    { label: '250g', val: 250, mode: 'g' as const },
    { label: '500g', val: 500, mode: 'g' as const },
    { label: '750g', val: 750, mode: 'g' as const },
    { label: '1 kg', val: 1000, mode: 'g' as const },
    { label: '1.5 kg', val: 1500, mode: 'g' as const },
    { label: '2 kg', val: 2000, mode: 'g' as const },
    { label: '3 kg', val: 3000, mode: 'g' as const }
  ]

  const kgPresets = [
    { label: '0.25 kg', val: 0.25, mode: 'kg' as const },
    { label: '0.5 kg', val: 0.5, mode: 'kg' as const },
    { label: '0.75 kg', val: 0.75, mode: 'kg' as const },
    { label: '1.0 kg', val: 1, mode: 'kg' as const },
    { label: '1.5 kg', val: 1.5, mode: 'kg' as const },
    { label: '2.0 kg', val: 2, mode: 'kg' as const },
    { label: '2.5 kg', val: 2.5, mode: 'kg' as const },
    { label: '3.0 kg', val: 3, mode: 'kg' as const }
  ]

  const countPresets = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 1100,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 22,
          background: '#ffffff',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.9)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
            borderBottom: '1.5px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                overflow: 'hidden',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
                <Scale size={26} color="#16a34a" />
              ) : (
                <Cake size={26} color="#16a34a" />
              )}
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', lineHeight: 1.25, letterSpacing: '-0.3px' }}>
                {product.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#059669',
                    background: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    padding: '3px 10px',
                    borderRadius: 8
                  }}
                >
                  {formatCurrency(product.price)} / {product.unit || 'pcs'}
                </span>
                {isStockTracked && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isExceedingStock ? '#dc2626' : '#475569',
                      background: isExceedingStock ? '#fef2f2' : '#f1f5f9',
                      border: isExceedingStock ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      padding: '3px 10px',
                      borderRadius: 8
                    }}
                  >
                    Stock: {product.current_stock} {product.unit}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Main Quantity Stepper & Control Card */}
          <div
            style={{
              background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '2px solid #cbd5e1',
              borderRadius: 18,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            {/* Top Row: Unit Selector or Label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isWeightBased ? 'Unit (ඒකකය)' : 'Quantity (ප්‍රමාණය)'}
              </span>

              {isWeightBased ? (
                <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleWeightMode('g')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: weightInputMode === 'g' ? '#16a34a' : 'transparent',
                      color: weightInputMode === 'g' ? '#ffffff' : '#475569',
                      boxShadow: weightInputMode === 'g' ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title="Enter weight in Grams (Press G)"
                  >
                    Grams (g)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleWeightMode('kg')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: weightInputMode === 'kg' ? '#16a34a' : 'transparent',
                      color: weightInputMode === 'kg' ? '#ffffff' : '#475569',
                      boxShadow: weightInputMode === 'kg' ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title="Enter weight in Kilograms (Press K)"
                  >
                    Kilograms (kg)
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155', background: '#e2e8f0', padding: '3px 10px', borderRadius: 6 }}>
                  {product.unit || 'pcs'}
                </span>
              )}
            </div>

            {/* Bottom Row: Spacious Stepper Buttons + High-Contrast Input Display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
              {/* Big Minus Button */}
              <button
                type="button"
                onClick={() => handleStep(isWeightBased ? (weightInputMode === 'g' ? -50 : -0.25) : -1)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  border: '2px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  transition: 'all 0.12s ease'
                }}
                title="Decrease (-)"
              >
                <Minus size={22} strokeWidth={3} />
              </button>

              {/* Large High-Contrast Numerical Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#ffffff',
                  border: isExceedingStock ? '2px solid #ef4444' : '2px solid #16a34a',
                  borderRadius: 14,
                  padding: '4px 16px',
                  minWidth: 160,
                  height: 50,
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
                }}
              >
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
                    fontSize: 28,
                    fontWeight: 900,
                    color: isExceedingStock ? '#dc2626' : '#0f172a',
                    width: '100%',
                    textAlign: 'center',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.5px'
                  }}
                  autoFocus
                />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#64748b', marginLeft: 4, userSelect: 'none' }}>
                  {isWeightBased ? weightInputMode : product.unit || 'pcs'}
                </span>
              </div>

              {/* Big Plus Button */}
              <button
                type="button"
                onClick={() => handleStep(isWeightBased ? (weightInputMode === 'g' ? 50 : 0.25) : 1)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  border: '2px solid #16a34a',
                  background: '#16a34a',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                  transition: 'all 0.12s ease'
                }}
                title="Increase (+)"
              >
                <Plus size={22} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Stock Warning Alert */}
          {isExceedingStock && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                color: '#b91c1c',
                fontSize: 12.5,
                fontWeight: 800
              }}
            >
              <AlertTriangle size={17} style={{ flexShrink: 0 }} />
              <span>
                Quantity exceeds available stock ({product.current_stock} {product.unit})
              </span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Presets ({isWeightBased ? (weightInputMode === 'g' ? 'Grams' : 'Kilograms') : 'Quantity'})
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                Click to pick instantly
              </span>
            </div>

            {isWeightBased ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {(weightInputMode === 'g' ? gramPresets : kgPresets).map((p) => {
                  const isMatch =
                    (p.mode === 'g' && weightInputMode === 'g' && parseFloat(inputValue) === p.val) ||
                    (p.mode === 'kg' && weightInputMode === 'kg' && parseFloat(inputValue) === p.val)
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSetPreset(p.val, p.mode)}
                      style={{
                        padding: '12px 8px',
                        minHeight: 46,
                        borderRadius: 12,
                        border: isMatch ? '2px solid #16a34a' : '1.5px solid #cbd5e1',
                        background: isMatch ? '#16a34a' : '#ffffff',
                        color: isMatch ? '#ffffff' : '#1e293b',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: isMatch ? '0 4px 12px rgba(22, 163, 74, 0.25)' : '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.12s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {countPresets.map((val) => {
                  const isMatch = parseInt(inputValue, 10) === val
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setInputValue(String(val))
                        inputRef.current?.focus()
                      }}
                      style={{
                        padding: '12px 8px',
                        minHeight: 46,
                        borderRadius: 12,
                        border: isMatch ? '2px solid #16a34a' : '1.5px solid #cbd5e1',
                        background: isMatch ? '#16a34a' : '#ffffff',
                        color: isMatch ? '#ffffff' : '#1e293b',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: isMatch ? '0 4px 12px rgba(22, 163, 74, 0.25)' : '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Increment Chips */}
          <div style={{ display: 'flex', gap: 10 }}>
            {isWeightBased ? (
              weightInputMode === 'g' ? (
                <>
                  <button type="button" onClick={() => handleStep(100)} style={chipBtnStyle}>
                    +100g
                  </button>
                  <button type="button" onClick={() => handleStep(250)} style={chipBtnStyle}>
                    +250g
                  </button>
                  <button type="button" onClick={() => handleStep(500)} style={chipBtnStyle}>
                    +500g
                  </button>
                  <button type="button" onClick={() => handleStep(1000)} style={chipBtnStyle}>
                    +1000g (1kg)
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => handleStep(0.25)} style={chipBtnStyle}>
                    +0.25 kg
                  </button>
                  <button type="button" onClick={() => handleStep(0.5)} style={chipBtnStyle}>
                    +0.5 kg
                  </button>
                  <button type="button" onClick={() => handleStep(1)} style={chipBtnStyle}>
                    +1.0 kg
                  </button>
                  <button type="button" onClick={() => handleStep(2)} style={chipBtnStyle}>
                    +2.0 kg
                  </button>
                </>
              )
            ) : (
              <>
                <button type="button" onClick={() => handleStep(1)} style={chipBtnStyle}>
                  +1 pcs
                </button>
                <button type="button" onClick={() => handleStep(2)} style={chipBtnStyle}>
                  +2 pcs
                </button>
                <button type="button" onClick={() => handleStep(5)} style={chipBtnStyle}>
                  +5 pcs
                </button>
                <button type="button" onClick={() => handleStep(10)} style={chipBtnStyle}>
                  +10 pcs
                </button>
              </>
            )}
          </div>

          {/* 🌟 Live Total Item Price Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Item Price (මුළු ගාණ)
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginTop: 4 }}>
                {weightBreakdownText}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', letterSpacing: '-0.5px' }}>
              {formatCurrency(displaySubtotal)}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1.5px solid #f1f5f9',
            display: 'flex',
            gap: 14,
            background: '#ffffff'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 14,
              border: '2px solid #cbd5e1',
              background: '#ffffff',
              fontSize: 14,
              fontWeight: 800,
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={normalizedQty <= 0}
            style={{
              flex: 2,
              padding: '14px 20px',
              borderRadius: 14,
              border: 'none',
              background: normalizedQty <= 0 ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: normalizedQty <= 0 ? 'not-allowed' : 'pointer',
              boxShadow: normalizedQty <= 0 ? 'none' : '0 6px 18px rgba(22, 163, 74, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <Check size={20} strokeWidth={3} />
            <span>
              {currentCartQuantity > 0 ? 'Update Item (Enter)' : 'Add to Cart (Enter)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const chipBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 8px',
  borderRadius: 12,
  border: '1.5px solid #cbd5e1',
  background: '#f8fafc',
  color: '#334155',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  transition: 'all 0.12s ease'
}


