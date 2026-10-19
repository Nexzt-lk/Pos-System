import React, { useState, useMemo } from 'react'
import { Banknote, Shield, Coins, Calculator, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react'
import { formatCurrency } from '../lib/formatters'

interface OpeningFloatModalProps {
  cashierName: string
  _cashierId?: string
  terminalId: string
  onConfirm: (amount: number, notes: string) => Promise<void>
}

// Sri Lankan Currency Denominations (Black, Green & Ash theme)
const NOTE_DENOMINATIONS = [
  { value: 5000, label: 'Rs. 5,000' },
  { value: 1000, label: 'Rs. 1,000' },
  { value: 500, label: 'Rs. 500' },
  { value: 100, label: 'Rs. 100' },
  { value: 50, label: 'Rs. 50' },
  { value: 20, label: 'Rs. 20' }
]

const COIN_DENOMINATIONS = [
  { value: 10, label: 'Rs. 10' },
  { value: 5, label: 'Rs. 5' },
  { value: 2, label: 'Rs. 2' },
  { value: 1, label: 'Rs. 1' }
]

export const OpeningFloatModal: React.FC<OpeningFloatModalProps> = ({
  cashierName,
  terminalId,
  onConfirm
}) => {
  const [entryMode, setEntryMode] = useState<'denominations' | 'direct'>('denominations')
  
  // Note counts
  const [noteCounts, setNoteCounts] = useState<Record<number, string>>({
    5000: '',
    1000: '',
    500: '',
    100: '',
    50: '',
    20: ''
  })

  // Coin counts
  const [coinCounts, setCoinCounts] = useState<Record<number, string>>({
    10: '',
    5: '',
    2: '',
    1: ''
  })

  // Direct Amount State
  const [directAmount, setDirectAmount] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate total from denominations
  const denominationTotal = useMemo(() => {
    let sum = 0
    for (const [val, countStr] of Object.entries(noteCounts)) {
      const qty = parseInt(countStr, 10) || 0
      sum += parseInt(val, 10) * qty
    }
    for (const [val, countStr] of Object.entries(coinCounts)) {
      const qty = parseInt(countStr, 10) || 0
      sum += parseInt(val, 10) * qty
    }
    return sum
  }, [noteCounts, coinCounts])

  const parsedDirect = parseFloat(directAmount.replace(/,/g, '')) || 0
  const finalTotal = entryMode === 'denominations' ? denominationTotal : parsedDirect

  const handleNoteCountChange = (val: number, text: string) => {
    // Only allow positive integers
    const cleaned = text.replace(/[^0-9]/g, '')
    setNoteCounts((prev) => ({ ...prev, [val]: cleaned }))
    setError('')
  }

  const handleCoinCountChange = (val: number, text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '')
    setCoinCounts((prev) => ({ ...prev, [val]: cleaned }))
    setError('')
  }

  const handleResetCounts = () => {
    setNoteCounts({ 5000: '', 1000: '', 500: '', 100: '', 50: '', 20: '' })
    setCoinCounts({ 10: '', 5: '', 2: '', 1: '' })
    setError('')
  }

  const handleSubmit = async () => {
    if (finalTotal <= 0) {
      setError('Please enter the cash notes/coins in the drawer.')
      return
    }

    setError('')
    setLoading(true)

    // Build breakdown summary for audit
    let breakdownText = ''
    if (entryMode === 'denominations') {
      const parts: string[] = []
      for (const d of NOTE_DENOMINATIONS) {
        const count = parseInt(noteCounts[d.value] || '0', 10)
        if (count > 0) parts.push(`Rs.${d.value}x${count}`)
      }
      for (const d of COIN_DENOMINATIONS) {
        const count = parseInt(coinCounts[d.value] || '0', 10)
        if (count > 0) parts.push(`Rs.${d.value}x${count}`)
      }
      breakdownText = `[Denominations: ${parts.join(', ')}]`
      if (customNotes) breakdownText += ` ${customNotes}`
    } else {
      breakdownText = customNotes || 'Direct entry'
    }

    try {
      await onConfirm(finalTotal, breakdownText)
    } catch (e: any) {
      setError(e.message || 'Failed to save cash float. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: 580,
          maxWidth: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(22, 163, 74, 0.18)',
                border: '1.5px solid rgba(22, 163, 74, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Banknote size={24} color="#4ade80" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Counter Cash Opening Float
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>
                Count drawer currency notes &amp; coins to start POS counter
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: 11.5,
              color: '#cbd5e1',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Shield size={13} color="#38bdf8" />
            <span>Terminal {terminalId}</span>
          </div>
        </div>

        {/* Cashier Bar & Mode Switcher */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Cashier:</span>
            <strong style={{ color: '#0f172a' }}>{cashierName}</strong>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => setEntryMode('denominations')}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: entryMode === 'denominations' ? '#ffffff' : 'transparent',
                color: entryMode === 'denominations' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: entryMode === 'denominations' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Coins size={13} color={entryMode === 'denominations' ? '#16a34a' : '#64748b'} />
              <span>Notes &amp; Coins</span>
            </button>
            <button
              onClick={() => setEntryMode('direct')}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: entryMode === 'direct' ? '#ffffff' : 'transparent',
                color: entryMode === 'direct' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: entryMode === 'direct' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Calculator size={13} color={entryMode === 'direct' ? '#0284c7' : '#64748b'} />
              <span>Direct Total</span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {entryMode === 'denominations' ? (
            <div>
              {/* Currency Notes Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Banknote size={15} color="#16a34a" />
                  <span>Currency Notes (රුපියල් නෝට්ටු)</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetCounts}
                  title="Clear all counts"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <RotateCcw size={12} /> Clear
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
                {NOTE_DENOMINATIONS.map((d, index) => {
                  const qty = parseInt(noteCounts[d.value] || '0', 10)
                  const lineTotal = d.value * qty
                  return (
                    <div
                      key={d.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: qty > 0 ? '#f0fdf4' : '#f8fafc',
                        border: `1.5px solid ${qty > 0 ? '#16a34a' : '#e2e8f0'}`,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ minWidth: 78 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: qty > 0 ? '#15803d' : '#0f172a' }}>{d.label}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>×</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          autoFocus={index === 0}
                          value={noteCounts[d.value]}
                          onChange={(e) => handleNoteCountChange(d.value, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit()
                          }}
                          style={{
                            width: 60,
                            height: 36,
                            textAlign: 'center',
                            borderRadius: 8,
                            border: `1.5px solid ${qty > 0 ? '#86efac' : '#cbd5e1'}`,
                            background: '#ffffff',
                            fontSize: 15,
                            fontWeight: 800,
                            color: '#0f172a',
                            outline: 'none'
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#16a34a' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = qty > 0 ? '#86efac' : '#cbd5e1' }}
                        />
                      </div>

                      <div style={{ width: 85, textAlign: 'right' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: qty > 0 ? '#15803d' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                          {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Coins Section */}
              <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coins size={15} color="#64748b" />
                <span>Coins (සිල්ලර කාසි)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                {COIN_DENOMINATIONS.map((d) => {
                  const qty = parseInt(coinCounts[d.value] || '0', 10)
                  const lineTotal = d.value * qty
                  return (
                    <div
                      key={d.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: `1.5px solid ${qty > 0 ? '#16a34a' : '#e2e8f0'}`,
                        transition: 'border-color 0.15s'
                      }}
                    >
                      <div style={{ minWidth: 78 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>{d.label}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>×</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={coinCounts[d.value]}
                          onChange={(e) => handleCoinCountChange(d.value, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit()
                          }}
                          style={{
                            width: 60,
                            height: 36,
                            textAlign: 'center',
                            borderRadius: 8,
                            border: '1.5px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: 15,
                            fontWeight: 800,
                            color: '#0f172a',
                            outline: 'none'
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#16a34a' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1' }}
                        />
                      </div>

                      <div style={{ width: 85, textAlign: 'right' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: qty > 0 ? '#0f172a' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                          {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Direct Total Input */
            <div style={{ padding: '8px 0 16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#374151',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Cash Amount in Drawer (LKR) *
              </label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#64748b'
                  }}
                >
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  autoFocus
                  value={directAmount}
                  onChange={(e) => {
                    setDirectAmount(e.target.value)
                    setError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit()
                  }}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: 54,
                    borderRadius: 10,
                    border: error ? '2px solid #ef4444' : '2px solid #e2e8f0',
                    paddingLeft: 52,
                    paddingRight: 16,
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#16a34a' }}
                  onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = '#e2e8f0' }}
                />
              </div>
            </div>
          )}

          {/* Notes (optional) */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#64748b',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Carried over from yesterday's closing"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 38,
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                padding: '0 12px',
                fontSize: 13,
                color: '#334155',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} color="#ef4444" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer with Calculated Total & Action Button */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1.5px solid #e2e8f0',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Opening Float
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: finalTotal > 0 ? '#15803d' : '#94a3b8', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
              {formatCurrency(finalTotal)}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || finalTotal <= 0}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: finalTotal > 0 ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#cbd5e1',
              color: '#ffffff',
              fontSize: 14.5,
              fontWeight: 800,
              cursor: finalTotal > 0 && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: finalTotal > 0 ? '0 4px 14px rgba(22,163,74,0.3)' : 'none',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit'
            }}
          >
            <CheckCircle2 size={17} />
            <span>{loading ? 'Confirming...' : 'Confirm Opening Float'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
