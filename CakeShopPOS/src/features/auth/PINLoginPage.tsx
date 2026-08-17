import React, { useState } from 'react'
import { Lock, Delete, UserCheck, Cake } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

export const PINLoginPage: React.FC = () => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setUser = useAppStore((state) => state.setUser)

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setError(null)
      const newPin = pin + num
      setPin(newPin)

      if (newPin.length === 6) {
        verifyPin(newPin)
      }
    }
  }

  const handleDelete = () => {
    setError(null)
    setPin((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    setError(null)
    setPin('')
  }

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
          setError(result.message || 'Invalid PIN. Please try again.')
          setPin('')
        }
      } else {
        // Browser development fallback (PIN: 123456)
        if (fullPin === '123456') {
          setUser({
            id: 'u0000000-0000-0000-0000-000000000002',
            tenant_id: currentShop?.tenant_id || '',
            shop_id: currentShop?.id || '',
            name: 'Kasun Bandara (Cashier 1)',
            role: 'cashier',
            is_active: true
          })
        } else {
          setError('Invalid PIN (Try default: 123456)')
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
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-pink-950 p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl text-center">
        {/* Logo & Header */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400 glow-pink">
          <Cake size={36} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Rasa Cake House</h1>
        <p className="mt-1 text-sm font-medium text-slate-400">
          {currentShop?.name} • <span className="text-brand-400">Counter {currentTerminalId}</span>
        </p>

        {/* PIN Dots Display */}
        <div className="my-6">
          <div className="flex justify-center gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? 'bg-brand-500 scale-125 glow-pink'
                    : 'bg-slate-700/60 border border-slate-600'
                }`}
              />
            ))}
          </div>

          {error ? (
            <p className="mt-3 text-xs font-semibold text-rose-400 animate-pulse">{error}</p>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Enter your 6-digit cashier PIN</p>
          )}
        </div>

        {/* Touch Numpad Grid */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              disabled={isLoading}
              onClick={() => handleKeyPress(digit)}
              className="numpad-btn glass-card flex h-16 items-center justify-center rounded-2xl text-2xl font-bold text-white transition-colors hover:bg-slate-700/80 active:bg-brand-600"
            >
              {digit}
            </button>
          ))}
          <button
            disabled={isLoading || pin.length === 0}
            onClick={handleClear}
            className="numpad-btn glass-card flex h-16 items-center justify-center rounded-2xl text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white"
          >
            Clear
          </button>
          <button
            disabled={isLoading}
            onClick={() => handleKeyPress('0')}
            className="numpad-btn glass-card flex h-16 items-center justify-center rounded-2xl text-2xl font-bold text-white transition-colors hover:bg-slate-700/80 active:bg-brand-600"
          >
            0
          </button>
          <button
            disabled={isLoading || pin.length === 0}
            onClick={handleDelete}
            className="numpad-btn glass-card flex h-16 items-center justify-center rounded-2xl text-rose-400 hover:bg-rose-500/20 active:bg-rose-600 active:text-white"
          >
            <Delete size={24} />
          </button>
        </div>

        {/* Quick Demo Helper Pill */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-800/40 py-2 text-xs text-slate-400">
          <UserCheck size={14} className="text-emerald-400" />
          <span>Demo Cashier PIN: <strong className="text-white">123456</strong></span>
        </div>
      </div>
    </div>
  )
}
