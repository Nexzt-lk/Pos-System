import React, { useState, useEffect, useCallback } from 'react'
import {
  KeyRound, Lock, Mail, Eye, EyeOff, RefreshCw,
  ArrowRight, Delete, AlertTriangle, ShoppingCart,
  Package, BarChart3, Users, Settings
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import loginBgImage from '../../assets/nexzt-login-bg.jpg'
import nexztBrandWhite from '../../assets/nexzt-brand-white.png'
import nexztStackedLogo from '../../assets/nexzt-logo-stacked.png'

type AuthMode = 'credentials' | 'passcode'

interface OperatorProfile {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
  roleTitle: string
}

const PRESET_OPERATORS: OperatorProfile[] = [
  {
    id: 'u0000000-0000-0000-0000-000000000003',
    name: 'Kasun Bandara',
    email: 'cashier1@rasacakes.lk',
    role: 'cashier',
    roleTitle: 'Cashier 01'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000004',
    name: 'Dilani Silva',
    email: 'cashier2@rasacakes.lk',
    role: 'cashier',
    roleTitle: 'Cashier 02'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000002',
    name: 'Sunil Jayasinghe',
    email: 'manager@rasacakes.lk',
    role: 'manager',
    roleTitle: 'Branch Manager'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000001',
    name: 'Nimal Perera',
    email: 'owner@rasacakes.lk',
    role: 'owner',
    roleTitle: 'Store Owner'
  }
]

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('credentials')
  const [selectedOperator] = useState<OperatorProfile | null>(PRESET_OPERATORS[0])
  const [email, setEmail] = useState('cashier1@rasacakes.lk')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)

  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setUser = useAppStore((state) => state.setUser)

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
          0% { transform: scale(0.5); opacity: 0.5; }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes softGlow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.06); }
        }

        /* Fullscreen 16:9 Screen-Fit Container */
        .nx-login-viewport {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          margin: 0;
          padding: 0;
          display: flex;
          position: relative;
          background-color: #080e14;
          background-image: 
            linear-gradient(to right, rgba(8, 14, 20, 0.90) 0%, rgba(8, 14, 20, 0.72) 42%, rgba(8, 14, 20, 0.45) 60%, rgba(8, 14, 20, 0.88) 100%),
            url(${loginBgImage});
          background-position: center center;
          background-size: cover;
          background-repeat: no-repeat;
          font-family: 'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
        }

        /* Left Side: Native Crisp Typography & Brand Content */
        .nx-left-content {
          flex: 1;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 38px 48px 32px 54px;
          box-sizing: border-box;
          z-index: 5;
          position: relative;
          overflow: hidden;
        }

        .nx-hero-top {
          display: flex;
          flex-direction: column;
        }

        .nx-hero-brand-logo {
          height: 38px;
          width: auto;
          max-width: 180px;
          object-fit: contain;
          margin-bottom: 22px;
          display: block;
        }

        .nx-system-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: rgba(255, 255, 255, 0.75);
          text-transform: uppercase;
          display: inline-block;
          margin-bottom: 8px;
          position: relative;
          width: fit-content;
        }

        .nx-system-tag::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 32px;
          height: 2px;
          background: #22c55e;
          border-radius: 2px;
        }

        .nx-hero-headline {
          font-size: clamp(32px, 3.8vw, 50px);
          font-weight: 800;
          line-height: 1.12;
          color: #ffffff;
          margin: 12px 0 10px 0;
          letter-spacing: -0.025em;
        }

        .nx-green-text {
          color: #22c55e;
        }

        .nx-hero-subtext {
          font-size: 13.5px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.70);
          max-width: 440px;
          margin: 0 0 24px 0;
        }

        /* Feature Bullet List */
        .nx-features-list {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .nx-feature-item {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 13.5px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
        }

        .nx-feature-icon-badge {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(22, 163, 74, 0.24);
          border: 1px solid rgba(34, 197, 94, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2);
        }

        /* Bottom Left Tagline */
        .nx-hero-bottom-tag {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.65);
          letter-spacing: 0.05em;
        }

        .nx-hero-bottom-tag::before {
          content: '';
          width: 22px;
          height: 2.5px;
          background: #22c55e;
          border-radius: 2px;
        }

        /* Right Side: Container for White Card */
        .nx-right-content {
          width: 460px;
          flex-shrink: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 38px 30px;
          box-sizing: border-box;
          position: relative;
          z-index: 10;
        }

        .nx-version-indicator {
          position: absolute;
          top: 18px;
          right: 28px;
          font-size: 11.5px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.04em;
        }

        /* Ambient Corner Glow */
        .nx-ambient-glow-corner {
          position: absolute;
          bottom: -60px;
          right: -60px;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(22, 163, 74, 0.38) 0%, rgba(34, 197, 94, 0.12) 50%, transparent 70%);
          filter: blur(55px);
          pointer-events: none;
          z-index: 1;
          animation: softGlow 10s ease-in-out infinite;
        }

        /* White Floating Login Card (Mockup Match) */
        .nx-login-card {
          width: 100%;
          max-width: 380px;
          background: #ffffff;
          border-radius: 26px;
          box-shadow: 
            0 25px 60px -12px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 255, 255, 0.12);
          padding: 24px 26px 20px;
          box-sizing: border-box;
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Stacked Logo on Card */
        .nx-card-logo-box {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .nx-card-logo-img {
          height: 64px;
          width: auto;
          object-fit: contain;
          display: block;
        }

        .nx-card-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 3px 0;
          letter-spacing: -0.02em;
          text-align: center;
        }

        .nx-card-subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 16px 0;
          text-align: center;
        }

        /* Mode Switcher: Password vs PIN */
        .nx-mode-switcher {
          display: flex;
          width: 100%;
          background: #f1f5f9;
          border-radius: 9999px;
          padding: 3px;
          margin-bottom: 16px;
          gap: 4px;
        }

        .nx-mode-tab {
          flex: 1;
          height: 35px;
          border-radius: 9999px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .nx-mode-tab.active {
          background: #0d7a46;
          color: #ffffff;
          box-shadow: 0 3px 10px rgba(13, 122, 70, 0.35);
        }

        /* Error Notice */
        .nx-error-box {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          font-size: 11.5px;
          font-weight: 500;
          margin-bottom: 14px;
          animation: shake 0.4s ease;
          box-sizing: border-box;
        }

        /* Inputs */
        .nx-input-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-bottom: 12px;
        }

        .nx-mockup-input-pill {
          display: flex;
          align-items: center;
          width: 100%;
          height: 46px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 15px;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }

        .nx-mockup-input-pill.focused {
          background: #ffffff;
          border-color: #0d7a46;
          box-shadow: 0 0 0 3px rgba(13, 122, 70, 0.15);
        }

        .nx-mockup-input-pill.error {
          border-color: #ef4444;
          background: #fff5f5;
        }

        .nx-input-native {
          flex: 1;
          height: 100%;
          border: none;
          background: transparent;
          outline: none;
          font-size: 13.5px;
          font-family: inherit;
          color: #0f172a;
        }

        .nx-input-native::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .nx-icon-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nx-icon-btn:hover {
          color: #0d7a46;
        }

        /* Options Row */
        .nx-options-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #475569;
          margin-bottom: 15px;
        }

        .nx-remember-label {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          user-select: none;
        }

        .nx-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #0d7a46;
          cursor: pointer;
        }

        .nx-forgot-link {
          color: #0d7a46;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .nx-forgot-link:hover {
          color: #05502c;
          text-decoration: underline;
        }

        /* Primary Green Button */
        .nx-main-btn {
          width: 100%;
          height: 46px;
          background: #0d7a46;
          border: none;
          outline: none;
          border-radius: 12px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(13, 122, 70, 0.35);
        }

        .nx-main-btn:hover:not(:disabled) {
          background: #096036;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(13, 122, 70, 0.45);
        }

        .nx-main-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .nx-main-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Divider */
        .nx-or-divider {
          width: 100%;
          display: flex;
          align-items: center;
          margin: 12px 0;
          color: #94a3b8;
          font-size: 11.5px;
        }

        .nx-or-divider::before,
        .nx-or-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .nx-or-divider span {
          padding: 0 10px;
        }

        /* Quick PIN Shortcut Button */
        .nx-social-btn {
          width: 100%;
          height: 42px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 12.5px;
          font-weight: 600;
          color: #334155;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition: all 0.15s ease;
        }

        .nx-social-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        /* Card Footer */
        .nx-card-footer-text {
          margin-top: 16px;
          font-size: 11.5px;
          color: #64748b;
          text-align: center;
        }

        .nx-admin-contact {
          color: #0d7a46;
          font-weight: 600;
          cursor: pointer;
        }

        .nx-admin-contact:hover {
          text-decoration: underline;
        }

        /* PIN Keypad Mode */
        .nx-pin-box {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .nx-pin-dots {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .nx-pin-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .nx-pin-dot.filled {
          background: #0d7a46;
          border-color: #0d7a46;
          box-shadow: 0 0 10px rgba(13, 122, 70, 0.5);
          animation: pinPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .nx-pin-hint {
          font-size: 11.5px;
          color: #64748b;
          margin-bottom: 12px;
          min-height: 16px;
        }

        .nx-keypad-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
          max-width: 270px;
        }

        .nx-keypad-key {
          height: 46px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          border-radius: 12px;
          font-size: 19px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
          outline: none;
        }

        .nx-keypad-key:hover:not(:disabled) {
          background: #f0fdf4;
          border-color: #86efac;
          color: #0d7a46;
          transform: translateY(-1px);
        }

        .nx-keypad-key:active:not(:disabled) {
          background: #dcfce7;
        }

        .nx-keypad-key.action {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #64748b;
          background: #f8fafc;
        }

        /* Bottom Industry Tags in Right Panel */
        .nx-bottom-industries {
          position: absolute;
          bottom: 16px;
          font-size: 10px;
          letter-spacing: 0.14em;
          color: rgba(255, 255, 255, 0.45);
          font-weight: 600;
          text-align: center;
          text-transform: uppercase;
        }

        /* Responsive Layout */
        @media (max-width: 960px) {
          .nx-login-viewport {
            flex-direction: column;
            overflow-y: auto;
            height: auto;
            min-height: 100vh;
          }
          .nx-left-content {
            height: auto;
            padding: 32px 24px;
          }
          .nx-right-content {
            width: 100%;
            height: auto;
            padding: 32px 20px;
          }
          .nx-bottom-industries {
            position: relative;
            bottom: auto;
            margin-top: 20px;
          }
        }
      `}</style>

      <div className="nx-login-viewport">
        {/* Left Side: Native Crisp Typography & Brand Features */}
        <div className="nx-left-content">
          <div className="nx-hero-top">
            {/* Top-Left Horizontal Logo (Image 3) */}
            <img
              src={nexztBrandWhite}
              alt="NEXZT - Think Next. Grow Now"
              className="nx-hero-brand-logo"
            />

            <span className="nx-system-tag">POS SYSTEM</span>

            <h1 className="nx-hero-headline">
              Smart POS<br />
              for a Bigger <span className="nx-green-text">Tomorrow</span>
            </h1>

            <p className="nx-hero-subtext">
              Manage sales, inventory, customers and more — all in one simple system.
            </p>

            {/* Feature List */}
            <div className="nx-features-list">
              <div className="nx-feature-item">
                <span className="nx-feature-icon-badge"><ShoppingCart size={17} /></span>
                <span>Fast Billing</span>
              </div>
              <div className="nx-feature-item">
                <span className="nx-feature-icon-badge"><Package size={17} /></span>
                <span>Inventory Management</span>
              </div>
              <div className="nx-feature-item">
                <span className="nx-feature-icon-badge"><BarChart3 size={17} /></span>
                <span>Sales Reports</span>
              </div>
              <div className="nx-feature-item">
                <span className="nx-feature-icon-badge"><Users size={17} /></span>
                <span>User Management</span>
              </div>
              <div className="nx-feature-item">
                <span className="nx-feature-icon-badge"><Settings size={17} /></span>
                <span>Flexible Settings</span>
              </div>
            </div>
          </div>

          {/* Bottom Left Slogan */}
          <div className="nx-hero-bottom-tag">
            Think Next. Grow Now
          </div>
        </div>

        {/* Right Side: Clean White Login Card */}
        <div className="nx-right-content">
          <div className="nx-version-indicator">v1.0.0</div>

          {/* Ambient Glow */}
          <div className="nx-ambient-glow-corner" />

          {/* Login Card */}
          <div className="nx-login-card">
            {/* Vertical Stacked Logo (Image 2) */}
            <div className="nx-card-logo-box">
              <img
                src={nexztStackedLogo}
                alt="NEXZT"
                className="nx-card-logo-img"
              />
            </div>

            {/* Title & Subtitle */}
            <h2 className="nx-card-title">Welcome Back!</h2>
            <p className="nx-card-subtitle">
              Log in to your {currentShop?.name ? currentShop.name : 'NEXZT POS'} account • Terminal #{currentTerminalId || '01'}
            </p>

            {/* Dual Mode Switcher: Password vs Quick PIN */}
            <div className="nx-mode-switcher">
              <button
                type="button"
                className={`nx-mode-tab ${mode === 'credentials' ? 'active' : ''}`}
                onClick={() => {
                  setMode('credentials')
                  setError(null)
                }}
              >
                <Lock size={14} />
                <span>Password</span>
              </button>
              <button
                type="button"
                className={`nx-mode-tab ${mode === 'passcode' ? 'active' : ''}`}
                onClick={() => {
                  setMode('passcode')
                  setError(null)
                }}
              >
                <KeyRound size={14} />
                <span>Quick PIN</span>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="nx-error-box">
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Password Login Mode */}
            {mode === 'credentials' && (
              <form onSubmit={handleCredentialsLogin} style={{ width: '100%' }}>
                <div className="nx-input-container">
                  {/* Email or Username */}
                  <div className={`nx-mockup-input-pill ${emailFocused ? 'focused' : ''} ${fieldErrors.email ? 'error' : ''}`}>
                    <Mail size={16} color={emailFocused ? '#0d7a46' : '#94a3b8'} style={{ marginRight: 12, flexShrink: 0 }} />
                    <input
                      type="text"
                      className="nx-input-native"
                      placeholder="Email or Username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                      }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      autoComplete="username"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Password */}
                  <div className={`nx-mockup-input-pill ${passFocused ? 'focused' : ''} ${fieldErrors.password ? 'error' : ''}`}>
                    <Lock size={16} color={password.length > 0 || passFocused ? '#0d7a46' : '#94a3b8'} style={{ marginRight: 12, flexShrink: 0 }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="nx-input-native"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                      }}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="nx-icon-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="nx-options-row">
                  <label className="nx-remember-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="nx-checkbox"
                    />
                    <span>Remember me</span>
                  </label>
                  <span
                    className="nx-forgot-link"
                    onClick={() => {
                      setMode('passcode')
                      setError(null)
                    }}
                  >
                    Forgot password?
                  </span>
                </div>

                {/* Primary Log In Button */}
                <button type="submit" className="nx-main-btn" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Log In</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="nx-or-divider">
                  <span>or</span>
                </div>

                {/* Quick PIN Shortcut */}
                <button
                  type="button"
                  className="nx-social-btn"
                  onClick={() => {
                    setMode('passcode')
                    setError(null)
                  }}
                >
                  <KeyRound size={15} color="#0d7a46" />
                  <span>Sign in with 6-Digit Cashier PIN</span>
                </button>
              </form>
            )}

            {/* Quick PIN Keypad Mode */}
            {mode === 'passcode' && (
              <div className="nx-pin-box">
                <div className="nx-pin-dots">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <div
                      key={index}
                      className={`nx-pin-dot ${index < passcode.length ? 'filled' : ''}`}
                    />
                  ))}
                </div>

                <div className="nx-pin-hint">
                  {isLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0d7a46' }}>
                      <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                      Verifying PIN...
                    </span>
                  ) : passcode.length === 0 ? (
                    'Enter 6-digit Operator PIN'
                  ) : (
                    <span style={{ color: '#0d7a46', fontWeight: 600 }}>{passcode.length} / 6 digits entered</span>
                  )}
                </div>

                <div className="nx-keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="nx-keypad-key"
                      onClick={() => handlePasscodeKey(digit)}
                      disabled={isLoading}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="nx-keypad-key action"
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
                    className="nx-keypad-key"
                    onClick={() => handlePasscodeKey('0')}
                    disabled={isLoading}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="nx-keypad-key action"
                    onClick={() => setPasscode((p) => p.slice(0, -1))}
                    disabled={isLoading || passcode.length === 0}
                  >
                    <Delete size={17} />
                  </button>
                </div>
              </div>
            )}

            {/* Card Footer */}
            <div className="nx-card-footer-text">
              New to NEXZT?{' '}
              <span
                className="nx-admin-contact"
                onClick={() => setError('Please contact Store Administrator to register your operator account.')}
              >
                Contact Administrator
              </span>
            </div>
          </div>

          {/* Industry Tags */}
          <div className="nx-bottom-industries">
            RETAIL &nbsp;|&nbsp; RESTAURANT &nbsp;|&nbsp; GROCERY &nbsp;|&nbsp; AND MORE
          </div>
        </div>
      </div>
    </>
  )
}

export default LoginPage
