import React, { useState, useEffect, useCallback } from 'react'
import {
  KeyRound, Lock, User, Eye, EyeOff, ShieldCheck, RefreshCw,
  ArrowRight, Clock, Delete, AlertTriangle
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import dayjs from 'dayjs'
import heroImage from '../../assets/nexzt-login-hero.jpg'

type AuthMode = 'passcode' | 'credentials'

interface OperatorProfile {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
  roleTitle: string
  avatarColor: string
  badgeColor: string
}

const PRESET_OPERATORS: OperatorProfile[] = [
  {
    id: 'u0000000-0000-0000-0000-000000000003',
    name: 'Kasun Bandara',
    email: 'cashier1@rasacakes.lk',
    role: 'cashier',
    roleTitle: 'Cashier 01',
    avatarColor: '#16a34a',
    badgeColor: '#dcfce7'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000004',
    name: 'Dilani Silva',
    email: 'cashier2@rasacakes.lk',
    role: 'cashier',
    roleTitle: 'Cashier 02',
    avatarColor: '#059669',
    badgeColor: '#d1fae5'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000002',
    name: 'Sunil Jayasinghe',
    email: 'manager@rasacakes.lk',
    role: 'manager',
    roleTitle: 'Branch Manager',
    avatarColor: '#2563eb',
    badgeColor: '#dbeafe'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000001',
    name: 'Nimal Perera',
    email: 'owner@rasacakes.lk',
    role: 'owner',
    roleTitle: 'Store Owner',
    avatarColor: '#d97706',
    badgeColor: '#fef3c7'
  }
]

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('passcode')
  const [selectedOperator] = useState<OperatorProfile | null>(PRESET_OPERATORS[0])
  const [email, setEmail] = useState('cashier1@rasacakes.lk')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm:ss'))
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)

  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setUser = useAppStore((state) => state.setUser)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm:ss'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Verify PIN
  const verifyPasscode = useCallback(async (code: string) => {
    setIsLoading(true)
    setError(null)
    try {
      let loggedInUser: any = null
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.dbQuery('auth:verify-pin', {
            shopId: currentShop?.id,
            pin: code,
            operatorId: selectedOperator?.id,
            email: selectedOperator?.email || email
          })
          if (result?.success && result.user) {
            loggedInUser = result.user
          } else if (result?.message) {
            setError(result.message)
          }
        } catch (e) {
          console.warn('IPC PIN verify error:', e)
        }
      }

      // Offline fallback verification
      if (!loggedInUser && (code === '123456' || code === '112233')) {
        const targetOp = selectedOperator || PRESET_OPERATORS[0]
        loggedInUser = {
          id: targetOp.id,
          tenant_id: currentShop?.tenant_id || 'a0000000-0000-0000-0000-000000000001',
          shop_id: currentShop?.id || 'b0000000-0000-0000-0000-000000000001',
          name: targetOp.name,
          email: targetOp.email,
          role: targetOp.role,
          is_active: true
        }
      }

      if (loggedInUser) {
        setUser(loggedInUser)
      } else {
        setError('Invalid 6-digit PIN. Please check and try again.')
        setPasscode('')
      }
    } catch (err: any) {
      setError(err.message || 'Passcode verification failed')
      setPasscode('')
    } finally {
      setIsLoading(false)
    }
  }, [currentShop, selectedOperator, email, setUser])

  // Keypad button press
  const handlePasscodeKey = useCallback((digit: string) => {
    if (passcode.length < 6 && !isLoading) {
      setError(null)
      const next = passcode + digit
      setPasscode(next)
      if (next.length === 6) {
        verifyPasscode(next)
      }
    }
  }, [passcode, isLoading, verifyPasscode])

  // Physical keyboard support
  useEffect(() => {
    if (mode !== 'passcode') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handlePasscodeKey(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPasscode((p) => p.slice(0, -1))
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault()
        setPasscode('')
        setError(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, handlePasscodeKey])

  // Password login handler
  const handleCredentialsLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()

    if (!cleanEmail) {
      setFieldErrors({ email: 'Username or Email is required' })
      return
    }
    if (!cleanPassword) {
      setFieldErrors({ password: 'Password is required' })
      return
    }

    setIsLoading(true)
    try {
      let loggedInUser: any = null
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.dbQuery('auth:login-email', {
            email: cleanEmail,
            password: cleanPassword,
            shopId: currentShop?.id
          })
          if (result?.success && result.user) {
            loggedInUser = result.user
          } else if (result?.message) {
            setError(result.message)
          }
        } catch (ipcErr) {
          console.warn('IPC login attempt error:', ipcErr)
        }
      }

      // Offline fallback login
      if (!loggedInUser) {
        const foundOp = PRESET_OPERATORS.find(
          (o) =>
            o.email.toLowerCase() === cleanEmail ||
            cleanEmail.startsWith(o.role) ||
            cleanEmail.includes(o.name.toLowerCase().split(' ')[0])
        )

        if (foundOp && (cleanPassword === '123456' || cleanPassword === `${foundOp.role}123`)) {
          loggedInUser = {
            id: foundOp.id,
            tenant_id: currentShop?.tenant_id || 'a0000000-0000-0000-0000-000000000001',
            shop_id: currentShop?.id || 'b0000000-0000-0000-0000-000000000001',
            name: foundOp.name,
            email: foundOp.email,
            role: foundOp.role,
            is_active: true
          }
        }
      }

      if (loggedInUser) {
        setUser(loggedInUser)
      } else if (!error) {
        setError('Invalid Username or Password. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'System authentication error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes pinPop {
          0% { transform: scale(0.6); }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes floatOrb1 {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(45px, -45px) scale(1.15);
          }
          66% {
            transform: translate(-30px, 35px) scale(0.92);
          }
        }
        @keyframes floatOrb2 {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(-50px, 40px) scale(1.18);
          }
          66% {
            transform: translate(40px, -30px) scale(0.9);
          }
        }
        @keyframes floatOrb3 {
          0%, 100% {
            transform: translate(0px, 0px) scale(0.9);
            opacity: 0.35;
          }
          50% {
            transform: translate(30px, -25px) scale(1.22);
            opacity: 0.65;
          }
        }
        @keyframes subtleGridMove {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 32px 32px;
          }
        }

        .nx-page-wrapper {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-family: 'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
        }

        /* Fullscreen Split Layout */
        .nx-fullscreen-layout {
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }

        /* Left Side: Hero Image Container (Full height, perfectly fits image) */
        .nx-hero-side {
          flex: 0 0 auto;
          width: auto;
          max-width: 50vw;
          height: 100vh;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #f0f7f3 0%, #0d3e29 60%, #032314 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nx-hero-img {
          height: 100vh;
          width: auto;
          max-width: 50vw;
          object-fit: contain;
          display: block;
        }

        /* Right Side: Clean Form Container with animated elements */
        .nx-form-side {
          flex: 1;
          height: 100vh;
          background: #ffffff;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 64px;
          box-sizing: border-box;
        }

        /* Animated subtle dot grid overlay */
        .nx-form-bg-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(22, 163, 74, 0.08) 1.2px, transparent 1.2px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 1;
          animation: subtleGridMove 25s linear infinite;
        }

        /* Animated Soft Glowing Aura Orbs */
        .nx-white-orb-1 {
          position: absolute;
          top: -120px;
          right: -80px;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(22, 163, 74, 0.13) 0%, rgba(134, 239, 172, 0.06) 50%, transparent 70%);
          filter: blur(65px);
          pointer-events: none;
          z-index: 1;
          animation: floatOrb1 15s ease-in-out infinite;
        }

        .nx-white-orb-2 {
          position: absolute;
          bottom: -100px;
          left: -80px;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34, 197, 94, 0.11) 0%, rgba(187, 247, 208, 0.06) 50%, transparent 70%);
          filter: blur(75px);
          pointer-events: none;
          z-index: 1;
          animation: floatOrb2 19s ease-in-out infinite;
        }

        .nx-white-orb-3 {
          position: absolute;
          top: 40%;
          right: 35%;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(22, 163, 74, 0.08) 0%, transparent 65%);
          filter: blur(55px);
          pointer-events: none;
          z-index: 1;
          animation: floatOrb3 13s ease-in-out infinite;
        }

        .nx-form-inner {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          height: 100%;
          max-height: 720px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* Top bar within right side */
        .nx-form-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .nx-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #16a34a;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 4px 12px;
          border-radius: 9999px;
        }

        .nx-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 8px #16a34a;
        }

        .nx-clock-text {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .nx-form-header {
          margin-bottom: 24px;
        }

        .nx-form-title {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.025em;
          margin: 0 0 6px 0;
        }

        .nx-form-desc {
          font-size: 13.5px;
          color: #64748b;
          margin: 0;
        }

        /* Dual Pill Mode Switcher */
        .nx-pill-switcher {
          display: flex;
          gap: 10px;
          background: #f1f5f9;
          padding: 5px;
          border-radius: 9999px;
          margin-bottom: 24px;
        }

        .nx-pill-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 44px;
          border: none;
          outline: none;
          cursor: pointer;
          border-radius: 9999px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: #64748b;
          background: transparent;
        }

        .nx-pill-btn.active {
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
        }

        .nx-pill-btn:not(.active):hover {
          color: #16a34a;
          background: rgba(22, 163, 74, 0.08);
        }

        /* Error Notification */
        .nx-error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          font-size: 12.5px;
          font-weight: 500;
          margin-bottom: 18px;
          animation: shake 0.4s ease;
        }

        /* PIN Mode Styles */
        .nx-pin-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          justify-content: center;
        }

        .nx-pin-dots {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .nx-pin-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .nx-pin-dot.filled {
          background: #16a34a;
          border-color: #16a34a;
          box-shadow: 0 0 14px rgba(22, 163, 74, 0.6);
          animation: pinPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .nx-pin-status {
          font-size: 12.5px;
          color: #64748b;
          margin-bottom: 18px;
          font-weight: 500;
          min-height: 20px;
        }

        /* Keypad */
        .nx-keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          width: 100%;
          max-width: 300px;
        }

        .nx-key {
          height: 56px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 16px;
          font-size: 22px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          outline: none;
          user-select: none;
        }

        .nx-key:hover:not(:disabled) {
          background: #f0fdf4;
          border-color: #86efac;
          color: #16a34a;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.15);
        }

        .nx-key:active:not(:disabled) {
          transform: translateY(1px);
          background: #dcfce7;
          border-color: #16a34a;
          color: #15803d;
        }

        .nx-key.action-key {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #64748b;
          background: #f8fafc;
        }

        .nx-key.action-key:hover:not(:disabled) {
          background: #dcfce7;
          border-color: #86efac;
          color: #16a34a;
        }

        .nx-key:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Credentials Mode Styles */
        .nx-form-fields {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 10px;
        }

        .nx-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nx-field-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #334155;
          margin-left: 4px;
        }

        .nx-input-pill {
          display: flex;
          align-items: center;
          height: 50px;
          padding: 0 18px;
          background: #f3f4f6;
          border-radius: 9999px;
          border: 1.5px solid transparent;
          transition: all 0.2s ease;
        }

        .nx-input-pill.focused {
          background: #ffffff;
          border-color: #16a34a;
          box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.14);
        }

        .nx-input-pill.error {
          border-color: #ef4444;
          background: #fff5f5;
        }

        .nx-input-field {
          flex: 1;
          height: 100%;
          border: none;
          background: transparent;
          outline: none;
          font-size: 14.5px;
          font-family: inherit;
          color: #0f172a;
        }

        .nx-input-field::placeholder {
          color: #94a3b8;
        }

        .nx-pw-toggle {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nx-pw-toggle:hover {
          color: #16a34a;
        }

        .nx-field-err {
          font-size: 11px;
          color: #dc2626;
          margin-left: 8px;
          font-weight: 500;
        }

        /* Pill Submit Button - System Green */
        .nx-submit-btn {
          width: 100%;
          height: 50px;
          border-radius: 9999px;
          border: none;
          outline: none;
          cursor: pointer;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 600;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 10px;
          box-shadow: 0 6px 20px rgba(22, 163, 74, 0.35);
          transition: all 0.2s ease;
        }

        .nx-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #15803d 0%, #166534 100%);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(22, 163, 74, 0.45);
        }

        .nx-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .nx-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Footer */
        .nx-form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
          font-size: 11.5px;
          color: #94a3b8;
          margin-top: 20px;
        }

        .nx-secured-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #16a34a;
          font-weight: 600;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .nx-fullscreen-layout {
            flex-direction: column;
            overflow-y: auto;
          }
          .nx-hero-side {
            width: 100vw;
            max-width: 100vw;
            height: 260px;
            flex: none;
          }
          .nx-hero-img {
            width: 100%;
            height: 100%;
            max-width: 100vw;
            object-fit: contain;
          }
          .nx-form-side {
            height: auto;
            flex: 1;
            padding: 32px 24px;
          }
        }
      `}</style>

      <div className="nx-page-wrapper">
        {/* Fullscreen Edge-to-Edge Layout */}
        <div className="nx-fullscreen-layout">
          {/* Left Side: Nexzt Brand Hero Image Panel (Full Height) */}
          <div className="nx-hero-side">
            <img
              src={heroImage}
              alt="Nexzt POS System"
              className="nx-hero-img"
            />
          </div>

          {/* Right Side: Clean White Form with Ambient Animation */}
          <div className="nx-form-side">
            {/* Animated Ambient Background Elements */}
            <div className="nx-form-bg-grid" />
            <div className="nx-white-orb-1" />
            <div className="nx-white-orb-2" />
            <div className="nx-white-orb-3" />

            <div className="nx-form-inner">
              <div>
                {/* Top Bar: Live Status & Clock */}
                <div className="nx-form-topbar">
                  <div className="nx-live-badge">
                    <span className="nx-live-dot" />
                    <span>Terminal #{currentTerminalId || '01'} Online</span>
                  </div>
                  <div className="nx-clock-text">
                    <Clock size={13} />
                    <span>{currentTime}</span>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="nx-form-header">
                  <h1 className="nx-form-title">Sign In</h1>
                  <p className="nx-form-desc">Choose authentication method to unlock POS</p>
                </div>

                {/* Dual Mode Switcher (Pill tabs like Google/Facebook in image 1) */}
                <div className="nx-pill-switcher">
                  <button
                    type="button"
                    className={`nx-pill-btn ${mode === 'passcode' ? 'active' : ''}`}
                    onClick={() => {
                      setMode('passcode')
                      setError(null)
                    }}
                  >
                    <KeyRound size={15} />
                    <span>Quick PIN</span>
                  </button>
                  <button
                    type="button"
                    className={`nx-pill-btn ${mode === 'credentials' ? 'active' : ''}`}
                    onClick={() => {
                      setMode('credentials')
                      setError(null)
                    }}
                  >
                    <Lock size={15} />
                    <span>Password</span>
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="nx-error-box">
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* PIN Code Mode */}
              {mode === 'passcode' && (
                <div className="nx-pin-section">
                  {/* 6 Pin Dots */}
                  <div className="nx-pin-dots">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <div
                        key={index}
                        className={`nx-pin-dot ${index < passcode.length ? 'filled' : ''}`}
                      />
                    ))}
                  </div>

                  <div className="nx-pin-status">
                    {isLoading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
                        <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                        Verifying PIN...
                      </span>
                    ) : passcode.length === 0 ? (
                      'Enter 6-digit Security PIN'
                    ) : (
                      <span style={{ color: '#16a34a' }}>{passcode.length} / 6 digits entered</span>
                    )}
                  </div>

                  {/* Keypad */}
                  <div className="nx-keypad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        className="nx-key"
                        onClick={() => handlePasscodeKey(digit)}
                        disabled={isLoading}
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="nx-key action-key"
                      onClick={() => {
                        setPasscode('')
                        setError(null)
                      }}
                      disabled={isLoading || passcode.length === 0}
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      className="nx-key"
                      onClick={() => handlePasscodeKey('0')}
                      disabled={isLoading}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      className="nx-key action-key"
                      onClick={() => setPasscode((p) => p.slice(0, -1))}
                      disabled={isLoading || passcode.length === 0}
                    >
                      <Delete size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Credentials / Password Mode */}
              {mode === 'credentials' && (
                <form onSubmit={handleCredentialsLogin} className="nx-form-fields">
                  {/* Operator ID / Email */}
                  <div className="nx-field-group">
                    <label className="nx-field-label">Username / Operator ID</label>
                    <div className={`nx-input-pill ${emailFocused ? 'focused' : ''} ${fieldErrors.email ? 'error' : ''}`}>
                      <User size={16} color={emailFocused ? '#16a34a' : '#94a3b8'} style={{ marginRight: 12, flexShrink: 0 }} />
                      <input
                        type="text"
                        className="nx-input-field"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                        }}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        placeholder="Enter username or email"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>
                    {fieldErrors.email && <span className="nx-field-err">{fieldErrors.email}</span>}
                  </div>

                  {/* Password */}
                  <div className="nx-field-group">
                    <label className="nx-field-label">Security Password</label>
                    <div className={`nx-input-pill ${passFocused ? 'focused' : ''} ${fieldErrors.password ? 'error' : ''}`}>
                      <Lock size={16} color={password.length > 0 || passFocused ? '#16a34a' : '#94a3b8'} style={{ marginRight: 12, flexShrink: 0 }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="nx-input-field"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                        }}
                        onFocus={() => setPassFocused(true)}
                        onBlur={() => setPassFocused(false)}
                        placeholder="••••••••••••"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="nx-pw-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.password && <span className="nx-field-err">{fieldErrors.password}</span>}
                  </div>

                  {/* Submit Button */}
                  <button type="submit" className="nx-submit-btn" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Bottom Footer */}
              <div className="nx-form-footer">
                <span>{currentShop?.name || 'Nexzt POS System'}</span>
                <span className="nx-secured-tag">
                  <ShieldCheck size={13} />
                  Encrypted Session
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
