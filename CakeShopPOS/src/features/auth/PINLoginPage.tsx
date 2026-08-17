import React, { useState, useEffect } from 'react'
import { Delete, UserCheck } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

export const PINLoginPage: React.FC = () => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setUser = useAppStore((state) => state.setUser)

  const handleKeyPress = (num: string) => {
    if (pin.length < 6 && !isLoading) {
      setError(null)
      const newPin = pin + num
      setPin(newPin)
      if (newPin.length === 6) {
        verifyPin(newPin)
      }
    }
  }

  const handleDelete = () => { setError(null); setPin((prev) => prev.slice(0, -1)) }
  const handleClear = () => { setError(null); setPin('') }

  const verifyPin = async (fullPin: string) => {
    setIsLoading(true)
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.dbQuery('auth:verify-pin', {
          shopId: currentShop?.id,
          pin: fullPin
        })
        if (result.success && result.user) {
          setUser(result.user)
        } else {
          setError('Invalid PIN. Please try again.')
          setPin('')
        }
      } else {
        if (fullPin === '123456') {
          setUser({
            id: 'u0000000-0000-0000-0000-000000000002',
            tenant_id: currentShop?.tenant_id || '',
            shop_id: currentShop?.id || '',
            name: 'Kasun Bandara',
            role: 'cashier',
            is_active: true
          })
        } else {
          setError('Invalid PIN — Demo PIN is 123456')
          setPin('')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error')
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pin-screen">
      <div className="pin-card">
        {/* Logo */}
        <div className="pin-logo">N</div>

        <h1 className="pin-title">Rasa Cake House</h1>
        <p className="pin-subtitle">
          <span className="pin-branch-badge">
            {currentShop?.name || 'Kandy Branch'} · Terminal {currentTerminalId}
          </span>
        </p>

        {/* PIN Dots */}
        <div className="pin-dots">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>

        <div className={`pin-error ${error ? '' : ''}`}>{error || ''}</div>
        <div className="pin-hint">
          {isLoading ? 'Verifying PIN...' : pin.length === 0 ? 'Enter your 6-digit cashier PIN' : ''}
        </div>

        {/* Numpad */}
        <div className="pin-numpad">
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button key={d} className="numpad-key" onClick={() => handleKeyPress(d)} disabled={isLoading}>
              {d}
            </button>
          ))}
          <button className="numpad-key clear-key" onClick={handleClear} disabled={isLoading || pin.length === 0}>
            Clear
          </button>
          <button className="numpad-key" onClick={() => handleKeyPress('0')} disabled={isLoading}>
            0
          </button>
          <button className="numpad-key delete-key" onClick={handleDelete} disabled={isLoading || pin.length === 0}>
            <Delete size={20} />
          </button>
        </div>

        {/* Demo hint */}
        <div className="pin-demo-hint">
          <UserCheck size={14} style={{ color: 'var(--primary)' }} />
          <span>Demo PIN: <strong>123456</strong></span>
        </div>
      </div>
    </div>
  )
}
