import React, { useState } from 'react'
import { Banknote, Shield } from 'lucide-react'

interface OpeningFloatModalProps {
  cashierName: string
  _cashierId?: string
  terminalId: string
  onConfirm: (amount: number, notes: string) => Promise<void>
}

export const OpeningFloatModal: React.FC<OpeningFloatModalProps> = ({
  cashierName,
  terminalId,
  onConfirm
}) => {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parsed = parseFloat(amount.replace(/,/g, '')) || 0

  const handleSubmit = async () => {
    if (parsed <= 0) {
      setError('Please enter the cash amount in the drawer.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onConfirm(parsed, notes)
    } catch (e: any) {
      setError(e.message || 'Failed to save. Please try again.')
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: 420,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '24px 28px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(22, 163, 74, 0.15)',
              border: '1.5px solid rgba(22, 163, 74, 0.4)',
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
              Opening Cash Count
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>
              Count and enter the cash in the drawer to begin
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          {/* Cashier & Terminal info */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              fontSize: 12.5
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600 }}>
              <Shield size={13} color="#64748b" />
              <span>{cashierName}</span>
            </div>
            <div style={{ color: '#94a3b8', fontWeight: 500 }}>
              Terminal {terminalId} · {new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          </div>

          {/* Amount input */}
          <div style={{ marginBottom: 16 }}>
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
            <div style={{ position: 'relative' }}>
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
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError('')
                }}
                onKeyDown={handleKeyDown}
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
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#16a34a' }}
                onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = '#e2e8f0' }}
              />
            </div>
            {error && (
              <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                {error}
              </div>
            )}
          </div>

          {/* Notes (optional) */}
          <div style={{ marginBottom: 20 }}>
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
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Float carried over from yesterday"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 40,
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                padding: '0 14px',
                fontSize: 13,
                color: '#334155',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#16a34a' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
            />
          </div>

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            disabled={loading || parsed <= 0}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 12,
              border: 'none',
              background: parsed > 0 ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#e2e8f0',
              color: parsed > 0 ? '#ffffff' : '#94a3b8',
              fontSize: 15,
              fontWeight: 800,
              cursor: parsed > 0 && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s',
              boxShadow: parsed > 0 ? '0 4px 14px rgba(22,163,74,0.3)' : 'none',
              letterSpacing: '-0.01em',
              fontFamily: 'inherit'
            }}
          >
            {loading ? (
              'Saving...'
            ) : (
              <>
                <Banknote size={18} />
                {parsed > 0
                  ? `Confirm Opening Float — Rs. ${parsed.toLocaleString()}`
                  : 'Enter cash amount to continue'}
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>
            This amount will be recorded for today's cash drawer reconciliation
          </div>
        </div>
      </div>
    </div>
  )
}
