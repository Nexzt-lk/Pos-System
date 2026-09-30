import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, Plus, Minus, Scale, AlertTriangle, Check, Cake, Banknote } from 'lucide-react'
import { message } from 'antd'
import { Product } from '../../types/product'
import { formatCurrency } from '../../lib/formatters'
import { getProductImageSrc } from '../../lib/imageHelper'

interface ProductQuantityModalProps {
  isOpen: boolean
  product: Product | null
  currentCartQuantity?: number
  onClose: () => void
  onConfirm: (product: Product, quantity: number, customSubtotal?: number) => void
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

  // Mode for weight-based items: 'weight' (Kg & g) or 'price' (Direct Rs. amount)
  const [entryMode, setEntryMode] = useState<'weight' | 'price'>('weight')

  // Dual Kg and Grams inputs for weight-based products
  const [kgInput, setKgInput] = useState<string>('0')
  const [gInput, setGInput] = useState<string>('500')
  // Direct price input in Rupees
  const [priceInput, setPriceInput] = useState<string>('')
  // Single input for count-based products (pcs, box, etc.)
  const [countInput, setCountInput] = useState<string>('1')

  // Active warning banner when cashier tries to exceed stock
  const [stockWarning, setStockWarning] = useState<string | null>(null)
  const warningTimeoutRef = useRef<any>(null)

  const triggerStockWarning = (msg: string) => {
    setStockWarning(msg)
    message.warning({ content: msg, key: 'pos-stock-limit', duration: 3 })
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    warningTimeoutRef.current = setTimeout(() => {
      setStockWarning(null)
    }, 4500)
  }

  const kgInputRef = useRef<HTMLInputElement>(null)
  const gInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const countInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && product) {
      setHasModalImgError(false)
      setEntryMode('weight')
      setStockWarning(null)
      const isWeight = product.unit?.toLowerCase() === 'kg' || product.unit?.toLowerCase() === 'g'
      const isBaseGram = product.unit?.toLowerCase() === 'g'
      const stock = product.current_stock ?? 0
      const isTracked = Boolean(product.track_inventory)

      if (isWeight) {
        let initialGrams = 500
        if (currentCartQuantity > 0) {
          initialGrams = isBaseGram ? Math.round(currentCartQuantity) : Math.round(currentCartQuantity * 1000)
        }
        if (isTracked && stock > 0) {
          const maxG = isBaseGram ? Math.round(stock) : Math.round(stock * 1000)
          if (initialGrams > maxG) {
            initialGrams = maxG
          }
        }
        const k = Math.floor(initialGrams / 1000)
        const g = Math.round(initialGrams % 1000)
        setKgInput(String(k))
        setGInput(String(g))

        // Precompute initial price
        const initialQty = isBaseGram ? initialGrams : initialGrams / 1000
        const initPrice = Math.round(initialQty * product.price * 100) / 100
        setPriceInput(initPrice > 0 ? (Number.isInteger(initPrice) ? String(initPrice) : initPrice.toFixed(2)) : '')

        setTimeout(() => {
          if (kgInputRef.current) {
            kgInputRef.current.focus()
            kgInputRef.current.select()
          }
        }, 60)
      } else {
        let initial = currentCartQuantity > 0 ? currentCartQuantity : 1
        if (isTracked && stock > 0 && initial > stock) {
          initial = Math.floor(stock)
        }
        setCountInput(String(initial))

        setTimeout(() => {
          if (countInputRef.current) {
            countInputRef.current.focus()
            countInputRef.current.select()
          }
        }, 60)
      }
    }
  }, [isOpen, product?.id, currentCartQuantity, product?.unit, product?.track_inventory, product?.current_stock])

  const handleSwitchMode = (mode: 'weight' | 'price') => {
    setEntryMode(mode)
    if (mode === 'price') {
      setTimeout(() => {
        if (priceInputRef.current) {
          priceInputRef.current.focus()
          priceInputRef.current.select()
        }
      }, 50)
    } else {
      setTimeout(() => {
        if (kgInputRef.current) {
          kgInputRef.current.focus()
          kgInputRef.current.select()
        }
      }, 50)
    }
  }

  // Total weight in grams (combining kg and g)
  const totalGrams = useMemo(() => {
    if (!isWeightBased) return 0
    const k = parseFloat(kgInput) || 0
    const g = parseFloat(gInput) || 0
    return Math.max(0, Math.round(k * 1000 + g))
  }, [isWeightBased, kgInput, gInput])

  // Normalized quantity according to product's base unit ('kg' or 'g' or 'pcs')
  const normalizedQty = useMemo(() => {
    if (isWeightBased) {
      if (entryMode === 'price') {
        const p = parseFloat(priceInput) || 0
        if (!product || product.price <= 0 || p <= 0) return 0
        if (isBaseUnitGram) {
          return Math.max(1, Math.round(p / product.price))
        } else {
          return Math.max(0.001, Math.round((p / product.price) * 1000) / 1000)
        }
      }
      // Weight mode
      if (totalGrams <= 0) return 0
      if (isBaseUnitGram) {
        return totalGrams // stored in grams
      } else {
        return Math.round((totalGrams / 1000) * 1000) / 1000 // stored in kg (e.g. 1.25)
      }
    }
    const raw = parseFloat(countInput) || 0
    return Math.max(1, Math.round(raw))
  }, [isWeightBased, entryMode, priceInput, isBaseUnitGram, totalGrams, countInput, product])

  const displaySubtotal = useMemo(() => {
    if (!product) return 0
    if (isWeightBased && entryMode === 'price') {
      const p = parseFloat(priceInput) || 0
      return Math.round(p * 100) / 100
    }
    if (normalizedQty <= 0) return 0
    return Math.round(product.price * normalizedQty * 100) / 100
  }, [product, isWeightBased, entryMode, priceInput, normalizedQty])

  const weightBreakdownText = useMemo(() => {
    if (!isWeightBased) {
      return `${normalizedQty} ${product.unit || 'pcs'} × ${formatCurrency(product.price)}`
    }
    const k = Math.floor(totalGrams / 1000)
    const g = Math.round(totalGrams % 1000)
    
    let weightLabel = ''
    if (k > 0 && g > 0) {
      weightLabel = `${k} kg ${g} g (${(totalGrams / 1000).toFixed(3)} kg)`
    } else if (k > 0) {
      weightLabel = `${k} kg (${(totalGrams / 1000).toFixed(2)} kg)`
    } else {
      weightLabel = `${g} g (${(totalGrams / 1000).toFixed(3)} kg)`
    }

    const unitPriceLabel = isBaseUnitGram 
      ? `${formatCurrency(product.price)} / g` 
      : `${formatCurrency(product.price)} / kg`

    if (entryMode === 'price') {
      return `Target: ${formatCurrency(displaySubtotal)} (${weightLabel} @ ${unitPriceLabel})`
    }

    return `${weightLabel} × ${unitPriceLabel}`
  }, [isWeightBased, totalGrams, normalizedQty, product, isBaseUnitGram, entryMode, displaySubtotal])

  const isStockTracked = Boolean(product.track_inventory)
  const availableStock = product.current_stock ?? 0
  const isExceedingStock = isStockTracked && normalizedQty > availableStock
  const isOutOfStock = isStockTracked && availableStock <= 0

  const maxAvailableGrams = useMemo(() => {
    if (!isStockTracked) return Infinity
    return isBaseUnitGram ? Math.round(availableStock) : Math.round(availableStock * 1000)
  }, [isStockTracked, isBaseUnitGram, availableStock])

  const maxAllowedPrice = useMemo(() => {
    if (!isStockTracked || !product.price || availableStock <= 0) return Infinity
    const maxQty = isBaseUnitGram ? maxAvailableGrams : maxAvailableGrams / 1000
    return Math.round(maxQty * product.price * 100) / 100
  }, [isStockTracked, product.price, isBaseUnitGram, maxAvailableGrams, availableStock])

  // Stepper for weight: increase/decrease by grams (e.g. +/- 250g)
  const handleStepWeight = (deltaGrams: number) => {
    let nextTotal = Math.max(50, Math.round(totalGrams + deltaGrams))
    if (isStockTracked && nextTotal > maxAvailableGrams) {
      triggerStockWarning(`Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'kg'} පමණි!`)
      nextTotal = maxAvailableGrams
    } else {
      setStockWarning(null)
    }
    const nextKg = Math.floor(nextTotal / 1000)
    const nextG = Math.round(nextTotal % 1000)
    setKgInput(String(nextKg))
    setGInput(String(nextG))
    const qty = isBaseUnitGram ? nextTotal : nextTotal / 1000
    const p = Math.round(qty * (product?.price || 0) * 100) / 100
    setPriceInput(p > 0 ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : '')
  }

  // Stepper for price: increase/decrease by Rs. 50
  const handleStepPrice = (deltaPrice: number) => {
    const currentPrice = parseFloat(priceInput) || 0
    let nextPrice = Math.max(10, Math.round(currentPrice + deltaPrice))
    if (isStockTracked && maxAllowedPrice < Infinity && nextPrice > maxAllowedPrice) {
      triggerStockWarning(`Store එකේ ඇති තොගයට (${availableStock} ${product.unit}) දැමිය හැකි උපරිම මුදල Rs. ${maxAllowedPrice} වේ!`)
      nextPrice = maxAllowedPrice
    } else {
      setStockWarning(null)
    }
    setPriceInput(Number.isInteger(nextPrice) ? String(nextPrice) : nextPrice.toFixed(2))
    if (product && product.price > 0) {
      const grams = isBaseUnitGram
        ? Math.round(nextPrice / product.price)
        : Math.round((nextPrice / product.price) * 1000)
      setKgInput(String(Math.floor(grams / 1000)))
      setGInput(String(Math.round(grams % 1000)))
    }
  }

  // Set preset for price
  const handleSetPricePreset = (val: number) => {
    let finalVal = val
    if (isStockTracked && maxAllowedPrice < Infinity && val > maxAllowedPrice) {
      triggerStockWarning(`Store එකේ ඇති තොගයට (${availableStock} ${product.unit}) දැමිය හැකි උපරිම මුදල Rs. ${maxAllowedPrice} වේ!`)
      finalVal = maxAllowedPrice
    } else {
      setStockWarning(null)
    }
    setPriceInput(Number.isInteger(finalVal) ? String(finalVal) : finalVal.toFixed(2))
    if (product && product.price > 0) {
      const grams = isBaseUnitGram
        ? Math.round(finalVal / product.price)
        : Math.round((finalVal / product.price) * 1000)
      setKgInput(String(Math.floor(grams / 1000)))
      setGInput(String(Math.round(grams % 1000)))
    }
  }

  // Stepper for piece items
  const handleStepCount = (delta: number) => {
    const current = parseFloat(countInput) || 0
    let next = Math.max(1, Math.round(current + delta))
    if (isStockTracked && next > availableStock) {
      triggerStockWarning(`Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'pcs'} පමණි!`)
      next = Math.max(1, Math.floor(availableStock))
    } else {
      setStockWarning(null)
    }
    setCountInput(String(next))
    countInputRef.current?.focus()
  }

  // Set preset for weight
  const handleSetWeightPreset = (k: number, g: number) => {
    let grams = k * 1000 + g
    if (isStockTracked && grams > maxAvailableGrams) {
      triggerStockWarning(`Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'kg'} පමණි!`)
      grams = maxAvailableGrams
    } else {
      setStockWarning(null)
    }
    const finalKg = Math.floor(grams / 1000)
    const finalG = Math.round(grams % 1000)
    setKgInput(String(finalKg))
    setGInput(String(finalG))
    const qty = isBaseUnitGram ? grams : grams / 1000
    const p = Math.round(qty * (product?.price || 0) * 100) / 100
    setPriceInput(p > 0 ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : '')
  }

  const handleKgChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '')
    const k = parseFloat(clean) || 0
    const currentG = parseFloat(gInput) || 0
    const proposedGrams = k * 1000 + currentG

    if (isStockTracked && proposedGrams > maxAvailableGrams) {
      triggerStockWarning(`Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'kg'} පමණි!`)
      const maxKg = Math.floor(maxAvailableGrams / 1000)
      const remG = Math.round(maxAvailableGrams % 1000)
      setKgInput(String(maxKg))
      setGInput(String(remG))
      const qty = isBaseUnitGram ? maxAvailableGrams : maxAvailableGrams / 1000
      const p = Math.round(qty * (product?.price || 0) * 100) / 100
      setPriceInput(p > 0 ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : '')
      return
    }

    setKgInput(clean)
    setStockWarning(null)
    const grams = k * 1000 + currentG
    const qty = isBaseUnitGram ? grams : grams / 1000
    const p = Math.round(qty * (product?.price || 0) * 100) / 100
    setPriceInput(p > 0 ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : '')
  }

  const handleGChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '')
    const g = parseFloat(clean) || 0
    const currentK = parseFloat(kgInput) || 0
    const proposedGrams = currentK * 1000 + g

    if (isStockTracked && proposedGrams > maxAvailableGrams) {
      triggerStockWarning(`Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'kg'} පමණි!`)
      const maxKg = Math.floor(maxAvailableGrams / 1000)
      const remG = Math.round(maxAvailableGrams % 1000)
      setKgInput(String(maxKg))
      setGInput(String(remG))
      const qty = isBaseUnitGram ? maxAvailableGrams : maxAvailableGrams / 1000
      const p = Math.round(qty * (product?.price || 0) * 100) / 100
      setPriceInput(p > 0 ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : '')
      return
    }

    setGInput(clean)
    setStockWarning(null)
    const grams = currentK * 1000 + g
    const qty = isBaseUnitGram ? grams : grams / 1000
    const p = Math.round(qty * (product?.price || 0) * 100) / 100
    setPriceInput(p > 0 ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : '')
  }

  const handlePriceChange = (val: string) => {
    const clean = val.replace(/[^\d.]/g, '')
    const p = parseFloat(clean) || 0

    if (isStockTracked && maxAllowedPrice < Infinity && p > maxAllowedPrice) {
      triggerStockWarning(`Store එකේ ඇති තොගයට (${availableStock} ${product.unit}) දැමිය හැකි උපරිම මුදල Rs. ${maxAllowedPrice} වේ!`)
      setPriceInput(Number.isInteger(maxAllowedPrice) ? String(maxAllowedPrice) : maxAllowedPrice.toFixed(2))
      const maxKg = Math.floor(maxAvailableGrams / 1000)
      const remG = Math.round(maxAvailableGrams % 1000)
      setKgInput(String(maxKg))
      setGInput(String(remG))
      return
    }

    setPriceInput(clean)
    setStockWarning(null)
    if (product && product.price > 0 && p > 0) {
      const grams = isBaseUnitGram
        ? Math.round(p / product.price)
        : Math.round((p / product.price) * 1000)
      const k = Math.floor(grams / 1000)
      const g = Math.round(grams % 1000)
      setKgInput(String(k))
      setGInput(String(g))
    } else {
      setKgInput('0')
      setGInput('0')
    }
  }

  const handleCountChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '')
    const num = parseFloat(clean) || 0
    if (isStockTracked && num > availableStock) {
      triggerStockWarning(`Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'pcs'} පමණි!`)
      setCountInput(String(Math.max(0, Math.floor(availableStock))))
      return
    }
    setCountInput(clean)
    setStockWarning(null)
  }

  // On blur of grams, if cashier typed 1000 or more, roll it over to kg cleanly
  const handleGBlur = () => {
    const gNum = parseFloat(gInput) || 0
    if (gNum >= 1000) {
      const extraKg = Math.floor(gNum / 1000)
      const remG = Math.round(gNum % 1000)
      const currentKg = parseFloat(kgInput) || 0
      setKgInput(String(currentKg + extraKg))
      setGInput(String(remG))
    }
  }

  const handleConfirm = () => {
    if (isExceedingStock) {
      triggerStockWarning(`Store එකේ ඇත්තේ ${availableStock} ${product.unit || 'pcs'} පමණි!`)
      return
    }
    if (normalizedQty > 0) {
      const customSubtotal = (isWeightBased && entryMode === 'price')
        ? Math.round((parseFloat(priceInput) || 0) * 100) / 100
        : undefined

      onConfirm(product, normalizedQty, customSubtotal)
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
        if (!isExceedingStock && normalizedQty > 0) {
          handleConfirm()
        }
      } else if (e.key === 'F2' || (e.altKey && (e.key === 'w' || e.key === 'W' || e.key === 'p' || e.key === 'P'))) {
        e.preventDefault()
        if (isWeightBased) {
          handleSwitchMode(entryMode === 'weight' ? 'price' : 'weight')
        }
      } else if (e.key === 'ArrowUp' || e.key === '+') {
        e.preventDefault()
        if (isWeightBased) {
          if (entryMode === 'price') {
            handleStepPrice(50)
          } else {
            handleStepWeight(250)
          }
        } else {
          handleStepCount(1)
        }
      } else if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault()
        if (isWeightBased) {
          if (entryMode === 'price') {
            handleStepPrice(-50)
          } else {
            handleStepWeight(-250)
          }
        } else {
          handleStepCount(-1)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [totalGrams, countInput, priceInput, entryMode, product, normalizedQty, isWeightBased])

  // Standard Sri Lankan cake weight presets
  const cakeWeightPresets = [
    { label: '250 g', kg: 0, g: 250, grams: 250 },
    { label: '500 g', kg: 0, g: 500, grams: 500 },
    { label: '750 g', kg: 0, g: 750, grams: 750 },
    { label: '1.0 kg', kg: 1, g: 0, grams: 1000 },
    { label: '1.25 kg', kg: 1, g: 250, grams: 1250 },
    { label: '1.5 kg', kg: 1, g: 500, grams: 1500 },
    { label: '2.0 kg', kg: 2, g: 0, grams: 2000 },
    { label: '2.5 kg', kg: 2, g: 500, grams: 2500 },
    { label: '3.0 kg', kg: 3, g: 0, grams: 3000 },
    { label: '5.0 kg', kg: 5, g: 0, grams: 5000 }
  ]

  const countPresets = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]

  return (
    <div className="qty-modal-overlay" onClick={onClose}>
      <div className="qty-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Left Column: Product Information & Live Price Summary */}
        <div className="qty-modal-sidebar">
          {/* Product Header Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 18,
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1.5px solid rgba(255, 255, 255, 0.18)'
                }}
              >
                {!hasModalImgError && modalImgSrc ? (
                  <img
                    src={modalImgSrc}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setHasModalImgError(true)}
                  />
                ) : (
                  <Cake size={34} color="#4ade80" />
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 17.5,
                    fontWeight: 800,
                    color: '#ffffff',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                  title={product.name}
                >
                  {product.name}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: '#94a3b8',
                    fontWeight: 600,
                    marginTop: 4
                  }}
                >
                  {formatCurrency(product.price)} / {product.unit || 'pcs'}
                </div>
              </div>
            </div>

            {/* Inventory / Unit Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.12)'
                }}
              >
                Unit: {product.unit || 'pcs'}
              </span>
              {isStockTracked ? (
                <span
                  style={{
                    background: isOutOfStock
                      ? 'rgba(239, 68, 68, 0.25)'
                      : availableStock <= 5
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(34, 197, 94, 0.25)',
                    color: isOutOfStock
                      ? '#fca5a5'
                      : availableStock <= 5
                      ? '#fcd34d'
                      : '#86efac',
                    padding: '5px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 800,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>Store:</span>
                  <span style={{ fontWeight: 900 }}>
                    {availableStock} {product.unit || 'pcs'}
                  </span>
                  {isOutOfStock && <span style={{ color: '#ef4444' }}>(අවසන්)</span>}
                </span>
              ) : (
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    padding: '5px 12px',
                    borderRadius: 20,
                    fontSize: 11.5,
                    fontWeight: 700
                  }}
                >
                  Unmetered Stock
                </span>
              )}
            </div>
          </div>

          {/* Subtotal Display Card */}
          <div
            style={{
              background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
              border: '1.5px solid rgba(74, 222, 128, 0.3)',
              borderRadius: 20,
              padding: '18px 16px',
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#94a3b8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 6
              }}
            >
              Estimated Amount
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#4ade80',
                letterSpacing: '-0.02em',
                lineHeight: 1.15
              }}
            >
              {formatCurrency(displaySubtotal)}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#cbd5e1',
                fontWeight: 600,
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                wordBreak: 'break-word'
              }}
            >
              {weightBreakdownText}
            </div>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 14,
              padding: '10px 12px',
              fontSize: 11,
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Confirm & Add:</span>
              <kbd style={{ background: '#334155', color: '#f8fafc', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Enter</kbd>
            </div>
            {isWeightBased && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Switch Mode:</span>
                <kbd style={{ background: '#334155', color: '#f8fafc', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>F2</kbd>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Step (+ / -):</span>
              <kbd style={{ background: '#334155', color: '#f8fafc', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>↑ / ↓</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cancel:</span>
              <kbd style={{ background: '#334155', color: '#f8fafc', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Esc</kbd>
            </div>
          </div>
        </div>

        {/* Right Column: Keypad, Inputs, Presets & Actions */}
        <div className="qty-modal-content">
          {/* Top Row: Mode Switcher & Close button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            {isWeightBased ? (
              <div
                style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  padding: 4,
                  borderRadius: 15,
                  flex: 1,
                  maxWidth: 420,
                  border: '1.5px solid #e2e8f0'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSwitchMode('weight')}
                  className={`qty-mode-tab ${entryMode === 'weight' ? 'active' : 'inactive'}`}
                >
                  <Scale size={18} strokeWidth={2.5} />
                  <span>By Weight (Kg & g)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('price')}
                  className={`qty-mode-tab ${entryMode === 'price' ? 'active' : 'inactive'}`}
                >
                  <Banknote size={18} strokeWidth={2.5} />
                  <span>By Price (Rs.)</span>
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 17.5, fontWeight: 800, color: '#1e293b' }}>
                Enter Item Quantity ({product.unit || 'pcs'})
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'all 0.15s ease'
              }}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Active Stock Typing Warning Alert */}
          {stockWarning && (
            <div
              style={{
                background: '#fef2f2',
                border: '2px solid #ef4444',
                borderRadius: 14,
                padding: '9px 14px',
                color: '#b91c1c',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                animation: 'shake 0.35s ease',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                <span>{stockWarning}</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  background: '#dc2626',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}
              >
                තොගය ඉක්මවිය නොහැක
              </span>
            </div>
          )}

          {/* Stepper & Input Row */}
          {isWeightBased ? (
            entryMode === 'weight' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#f8fafc',
                  border: '2px solid #e2e8f0',
                  borderRadius: 20,
                  padding: '10px 16px'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleStepWeight(-250)}
                  className="qty-stepper-btn"
                  title="Decrease 250g (-)"
                >
                  <Minus size={22} strokeWidth={3} />
                </button>

                {/* Kg Input */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Kilograms (kg)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, width: '100%', justifyContent: 'center' }}>
                    <input
                      ref={kgInputRef}
                      type="text"
                      inputMode="numeric"
                      value={kgInput}
                      onChange={(e) => handleKgChange(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '85px',
                        textAlign: 'center',
                        fontSize: 30,
                        fontWeight: 900,
                        color: '#0f172a',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8' }}>kg</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 46, background: '#cbd5e1' }} />

                {/* Grams Input */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Grams (g)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, width: '100%', justifyContent: 'center' }}>
                    <input
                      ref={gInputRef}
                      type="text"
                      inputMode="numeric"
                      value={gInput}
                      onChange={(e) => handleGChange(e.target.value)}
                      onBlur={handleGBlur}
                      placeholder="0"
                      style={{
                        width: '105px',
                        textAlign: 'center',
                        fontSize: 30,
                        fontWeight: 900,
                        color: '#0f172a',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8' }}>g</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepWeight(250)}
                  className="qty-stepper-btn primary"
                  title="Increase 250g (+)"
                >
                  <Plus size={22} strokeWidth={3} />
                </button>
              </div>
            ) : (
              /* Price Entry Mode */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#f0fdf4',
                  border: '2px solid #86efac',
                  borderRadius: 20,
                  padding: '10px 16px'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleStepPrice(-50)}
                  className="qty-stepper-btn"
                  title="Decrease Rs. 50 (-)"
                >
                  <Minus size={22} strokeWidth={3} />
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>
                    Desired Customer Bill Amount
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>Rs.</span>
                    <input
                      ref={priceInputRef}
                      type="text"
                      inputMode="decimal"
                      value={priceInput}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '210px',
                        textAlign: 'center',
                        fontSize: 32,
                        fontWeight: 900,
                        color: '#15803d',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepPrice(50)}
                  className="qty-stepper-btn primary"
                  title="Increase Rs. 50 (+)"
                >
                  <Plus size={22} strokeWidth={3} />
                </button>
              </div>
            )
          ) : (
            /* Count / Pcs Entry */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: '#f8fafc',
                border: '2px solid #e2e8f0',
                borderRadius: 18,
                padding: '8px 14px'
              }}
            >
              <button
                type="button"
                onClick={() => handleStepCount(-1)}
                className="qty-stepper-btn"
                title="Decrease 1 (-)"
              >
                <Minus size={20} strokeWidth={3} />
              </button>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Quantity ({product.unit || 'pcs'})
                </div>
                <input
                  ref={countInputRef}
                  type="text"
                  inputMode="numeric"
                  value={countInput}
                  onChange={(e) => handleCountChange(e.target.value)}
                  placeholder="1"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 28,
                    fontWeight: 900,
                    color: '#0f172a',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleStepCount(1)}
                className="qty-stepper-btn primary"
                title="Increase 1 (+)"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>
          )}

          {/* Quick Preset Buttons Grid */}
          <div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                marginBottom: 6,
                letterSpacing: '0.04em'
              }}
            >
              {isWeightBased
                ? entryMode === 'weight'
                  ? 'Standard Weight Presets'
                  : 'Quick Cash Amounts'
                : 'Quick Quantities'}
            </div>

            {isWeightBased ? (
              entryMode === 'weight' ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 6
                  }}
                >
                  {cakeWeightPresets.map((preset) => {
                    const isSelected = totalGrams === preset.grams
                    const isOverStock = isStockTracked && preset.grams > maxAvailableGrams
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSetWeightPreset(preset.kg, preset.g)}
                        className={`qty-preset-btn ${isSelected ? 'active' : ''}`}
                        style={isOverStock ? { opacity: 0.45 } : undefined}
                        title={isOverStock ? `Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'kg'} පමණි` : undefined}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                /* Price Presets */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6
                  }}
                >
                  {[200, 300, 500, 750, 1000, 1500, 2000, 2500].map((presetVal) => {
                    const isSelected = parseFloat(priceInput) === presetVal
                    const isOverStock = isStockTracked && maxAllowedPrice < Infinity && presetVal > maxAllowedPrice
                    return (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => handleSetPricePreset(presetVal)}
                        className={`qty-preset-btn ${isSelected ? 'active' : ''}`}
                        style={isOverStock ? { opacity: 0.45 } : undefined}
                        title={isOverStock ? `Store එකේ ඇති තොගයට උපරිම මුදල Rs. ${maxAllowedPrice}` : undefined}
                      >
                        Rs. {presetVal}
                      </button>
                    )
                  })}
                </div>
              )
            ) : (
              /* Count Presets */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 6
                }}
              >
                {countPresets.map((num) => {
                  const isSelected = parseFloat(countInput) === num
                  const isOverStock = isStockTracked && num > availableStock
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        handleCountChange(String(num))
                        countInputRef.current?.focus()
                      }}
                      className={`qty-preset-btn ${isSelected ? 'active' : ''}`}
                      style={isOverStock ? { opacity: 0.45 } : undefined}
                      title={isOverStock ? `Store එකේ ඇත්තේ උපරිම ${availableStock} ${product.unit || 'pcs'} පමණි` : undefined}
                    >
                      {num} {product.unit || ''}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Increment Chips */}
          <div style={{ display: 'flex', gap: 6 }}>
            {isWeightBased ? (
              entryMode === 'weight' ? (
                <>
                  <button type="button" onClick={() => handleStepWeight(100)} className="qty-chip-btn">+100 g</button>
                  <button type="button" onClick={() => handleStepWeight(250)} className="qty-chip-btn">+250 g</button>
                  <button type="button" onClick={() => handleStepWeight(500)} className="qty-chip-btn">+500 g</button>
                  <button type="button" onClick={() => handleStepWeight(1000)} className="qty-chip-btn">+1 kg</button>
                  <button
                    type="button"
                    onClick={() => {
                      setKgInput('0')
                      setGInput('0')
                      setPriceInput('')
                    }}
                    className="qty-chip-btn"
                    style={{ color: '#ef4444' }}
                  >
                    Clear
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => handleStepPrice(50)} className="qty-chip-btn">+Rs. 50</button>
                  <button type="button" onClick={() => handleStepPrice(100)} className="qty-chip-btn">+Rs. 100</button>
                  <button type="button" onClick={() => handleStepPrice(200)} className="qty-chip-btn">+Rs. 200</button>
                  <button type="button" onClick={() => handleStepPrice(500)} className="qty-chip-btn">+Rs. 500</button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceInput('')
                      setKgInput('0')
                      setGInput('0')
                    }}
                    className="qty-chip-btn"
                    style={{ color: '#ef4444' }}
                  >
                    Clear
                  </button>
                </>
              )
            ) : (
              <>
                <button type="button" onClick={() => handleStepCount(1)} className="qty-chip-btn">+1</button>
                <button type="button" onClick={() => handleStepCount(2)} className="qty-chip-btn">+2</button>
                <button type="button" onClick={() => handleStepCount(5)} className="qty-chip-btn">+5</button>
                <button type="button" onClick={() => handleStepCount(10)} className="qty-chip-btn">+10</button>
                <button
                  type="button"
                  onClick={() => setCountInput('1')}
                  className="qty-chip-btn"
                  style={{ color: '#ef4444' }}
                >
                  Reset
                </button>
              </>
            )}
          </div>

          {/* Exceeding Stock Warning Ribbon */}
          {isExceedingStock && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: 14,
                padding: '10px 14px',
                color: '#b91c1c',
                fontSize: 12.5,
                fontWeight: 700
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#dc2626" />
                <span>
                  Store එකේ ඇත්තේ <strong>{availableStock} {product.unit || 'pcs'}</strong> පමණි! ({normalizedQty} {product.unit || 'pcs'} ඇතුලත් කළ නොහැක)
                </span>
              </div>
              {availableStock > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (isWeightBased) {
                      const totalG = isBaseUnitGram ? Math.round(availableStock) : Math.round(availableStock * 1000)
                      handleSetWeightPreset(Math.floor(totalG / 1000), Math.round(totalG % 1000))
                    } else {
                      setCountInput(String(Math.floor(availableStock)))
                    }
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: '1px solid #dc2626',
                    background: '#ffffff',
                    color: '#dc2626',
                    fontWeight: 800,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  උපරිම ප්‍රමාණය ({availableStock}) යොදන්න
                </button>
              )}
            </div>
          )}

          {/* Action Buttons Footer */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              paddingTop: 10,
              borderTop: '1px solid #f1f5f9',
              marginTop: 'auto'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 14,
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease'
              }}
            >
              Cancel (Esc)
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={normalizedQty <= 0 || isExceedingStock}
              style={{
                flex: 2,
                padding: '14px 24px',
                borderRadius: 14,
                border: 'none',
                background: (normalizedQty <= 0 || isExceedingStock)
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: (normalizedQty <= 0 || isExceedingStock) ? 'not-allowed' : 'pointer',
                boxShadow: (normalizedQty <= 0 || isExceedingStock) ? 'none' : '0 4px 14px rgba(22, 163, 74, 0.35)',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease'
              }}
            >
              <Check size={20} strokeWidth={3} />
              <span>
                {isExceedingStock
                  ? `Store තොගය ඉක්මවා ඇත (Max: ${availableStock})`
                  : currentCartQuantity > 0
                  ? 'Update Item (Enter)'
                  : 'Add to Cart (Enter)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
