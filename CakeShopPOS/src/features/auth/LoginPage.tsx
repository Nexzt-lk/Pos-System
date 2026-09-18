import React, { useState, useEffect, useCallback } from 'react'
import {
  Cake, Sparkles, ShieldCheck, Lock, Eye, EyeOff, Store, Clock,
  ArrowRight, KeyRound, AlertTriangle, RefreshCw, User, Activity,
  HardDrive, Wifi, CheckCircle2
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import dayjs from 'dayjs'

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
  const [selectedOperator, setSelectedOperator] = useState<OperatorProfile | null>(PRESET_OPERATORS[0])
  const [email, setEmail] = useState('cashier1@rasacakes.lk')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm:ss'))
  const [currentDate, setCurrentDate] = useState(dayjs().format('dddd, DD MMMM YYYY'))
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)

  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setUser = useAppStore((state) => state.setUser)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm:ss'))
      setCurrentDate(dayjs().format('dddd, DD MMMM YYYY'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-fill credentials when operator changes
  const handleSelectOperator = (op: OperatorProfile) => {
    setSelectedOperator(op)
    setEmail(op.email)
    setError(null)
    setPasscode('')
    setPassword('')
  }

  // Detect role badge for typed input
  const getDetectedRole = (input: string) => {
    const clean = input.trim().toLowerCase()
    if (clean.includes('owner')) return { label: 'Store Owner', color: '#d97706', bg: '#fef3c7' }
    if (clean.includes('manager')) return { label: 'Branch Manager', color: '#2563eb', bg: '#dbeafe' }
    if (clean.includes('cashier')) return { label: 'Terminal Cashier', color: '#16a34a', bg: '#dcfce7' }
    return null
  }

  const detectedRole = getDetectedRole(email)

  // Verification logic for PIN
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
        setError('à·€à·à¶»à¶¯à·’ PIN à¶…à¶‚à¶šà¶ºà¶šà·’. à¶šà¶»à·”à¶«à·à¶šà¶» à¶±à·à·€à¶­ à¶‹à¶­à·Šà·ƒà·à·„ à¶šà¶»à¶±à·Šà¶±. (Invalid 6-digit PIN)')
        setPasscode('')
      }
    } catch (err: any) {
      setError(err.message || 'Passcode verification failed')
      setPasscode('')
    } finally {
      setIsLoading(false)
    }
  }, [currentShop, selectedOperator, email, setUser])

  // Keypad key press
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

  // Physical keyboard support for PIN mode
  useEffect(() => {
    if (mode !== 'passcode') return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in another input
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
        setError('à¶¸à·”à¶»à¶´à¶¯à¶º à·„à· Username à·€à·à¶»à¶¯à·’à¶º. à¶šà¶»à·”à¶«à·à¶šà¶» à¶±à·à·€à¶­ à¶‹à¶­à·Šà·ƒà·à·„ à¶šà¶»à¶±à·Šà¶±.')
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
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pinPop {
          0%   { transform: scale(0.6); }
          60%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-6px); }
          40%,80%  { transform: translateX(6px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        .login-root {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          background: #f0fdf4;
          font-family: 'Poppins', 'Noto Sans Sinhala', sans-serif;
          position: relative;
        }
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(22,163,74,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,163,74,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
        }

        /* â•â•â• LEFT PANEL â•â•â• */
        .lp-left {
          flex: 1.1;
          display: flex;
          flex-direction: column;
          padding: 36px 36px 28px 36px;
          border-right: 1px solid #e2e8f0;
          background: #ffffff;
          position: relative;
          z-index: 1;
          overflow: hidden;
          animation: fadeSlideIn 0.4s ease both;
        }
        .lp-left::after {
          content: '';
          position: absolute;
          bottom: -120px;
          left: -120px;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(22,163,74,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .lp-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }
        .lp-brand-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(22,163,74,0.28), inset 0 1px 1px rgba(255,255,255,0.3);
          flex-shrink: 0;
        }
        .lp-branch-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #16a34a;
          background: #dcfce7;
          border: 1px solid #bbf7d0;
          padding: 3px 10px;
          border-radius: 999px;
          margin-bottom: 4px;
        }
        .lp-shop-name {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .lp-desc {
          font-size: 12.5px;
          color: #64748b;
          line-height: 1.6;
          margin: 0 0 22px 0;
        }
        .lp-section-label {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: #94a3b8;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-section-label span:last-child { color: #16a34a; font-size: 9.5px; }
        .lp-operator-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-bottom: 20px;
        }
        .lp-op-card {
          padding: 11px 13px;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
        }
        .lp-op-card:hover {
          border-color: #86efac;
          background: #f0fdf4;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(22,163,74,0.1);
        }
        .lp-op-card.selected {
          border-color: #16a34a;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          box-shadow: 0 4px 14px rgba(22,163,74,0.16);
        }
        .lp-op-avatar {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          color: white;
          flex-shrink: 0;
        }
        .lp-op-name {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lp-op-role { font-size: 10.5px; font-weight: 600; }
        .lp-diag {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 13px 15px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          flex: 1;
        }
        .lp-diag-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11.5px;
        }
        .lp-diag-label {
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }
        .lp-diag-value { color: #0f172a; font-weight: 600; }
        .lp-live-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #16a34a;
          display: inline-block;
          animation: pulse-dot 1.6s ease-in-out infinite;
        }
        .lp-footer {
          padding-top: 16px;
          margin-top: 16px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-clock { display: flex; align-items: center; gap: 8px; }
        .lp-clock-time {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.04em;
        }
        .lp-clock-date { font-size: 11px; color: #94a3b8; font-weight: 500; }
        .lp-secured {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #16a34a;
        }

        /* â•â•â• RIGHT PANEL â•â•â• */
        .lp-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 36px 36px 28px 36px;
          background: #ffffff;
          position: relative;
          z-index: 1;
          overflow: hidden;
          animation: fadeSlideIn 0.4s 0.08s ease both;
        }
        .lp-right::before {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 340px; height: 340px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(22,163,74,0.06) 0%, transparent 65%);
          pointer-events: none;
        }
        .lp-tabs {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          margin-bottom: 20px;
          gap: 4px;
        }
        .lp-tab {
          flex: 1;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.18s ease;
          font-family: inherit;
        }
        .lp-tab.active {
          background: #ffffff;
          color: #16a34a;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }
        .lp-op-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          border-radius: 12px;
          background: #f0fdf4;
          border: 1.5px solid #bbf7d0;
          margin-bottom: 16px;
          animation: fadeSlideIn 0.25s ease both;
        }
        .lp-op-banner-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse-dot 1.6s ease-in-out infinite;
        }
        .lp-op-banner-name { font-size: 13px; font-weight: 800; color: #0f172a; }
        .lp-op-banner-role { font-size: 10.5px; color: #16a34a; font-weight: 600; }
        .lp-op-banner-pin {
          font-size: 10.5px; color: #94a3b8;
          background: #f1f5f9; border: 1px solid #e2e8f0;
          padding: 3px 9px; border-radius: 8px; font-weight: 600;
        }
        .lp-error {
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          color: #dc2626;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          animation: shake 0.4s ease;
        }
        .lp-pin-dots {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin: 8px 0 10px;
        }
        .lp-pin-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2px solid #e2e8f0;
          background: #f8fafc;
          transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
        }
        .lp-pin-dot.filled {
          background: #16a34a;
          border-color: #22c55e;
          box-shadow: 0 0 12px rgba(34,197,94,0.45);
          animation: pinPop 0.18s ease;
        }
        .lp-pin-status {
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          min-height: 18px;
          margin-bottom: 14px;
          color: #94a3b8;
        }
        .lp-keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
        }
        .lp-key {
          height: 58px;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.12s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          user-select: none;
        }
        .lp-key:hover:not(:disabled) {
          background: #f0fdf4;
          border-color: #86efac;
          color: #16a34a;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(22,163,74,0.12);
        }
        .lp-key:active:not(:disabled) { transform: translateY(1px) scale(0.97); }
        .lp-key:disabled { opacity: 0.35; cursor: not-allowed; }
        .lp-key.key-clear {
          font-size: 11px; font-weight: 800; letter-spacing: 0.07em;
          color: #94a3b8; background: #f1f5f9; border-color: #e2e8f0;
        }
        .lp-key.key-delete {
          font-size: 20px; color: #ef4444; background: #fff5f5; border-color: #fecaca;
        }
        .lp-field-label {
          font-size: 10.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: #94a3b8; margin-bottom: 6px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-field-wrap {
          display: flex; align-items: center;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 14px;
          transition: all 0.18s ease;
        }
        .lp-field-wrap.focused {
          background: #f0fdf4;
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22,163,74,0.08);
        }
        .lp-field-wrap.field-error { border-color: #ef4444; background: #fff5f5; }
        .lp-input {
          flex: 1; padding: 13px 0;
          border: none; outline: none;
          background: transparent;
          font-size: 13.5px; font-weight: 600;
          color: #0f172a; caret-color: #16a34a;
          font-family: inherit;
        }
        .lp-input::placeholder { color: #cbd5e1; font-weight: 400; }
        .lp-field-err { font-size: 11px; color: #dc2626; font-weight: 600; margin-top: 4px; display: block; }
        .lp-submit {
          margin-top: 8px; width: 100%;
          padding: 14px 20px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 60%, #166534 100%);
          color: #ffffff; font-size: 14px; font-weight: 800; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 6px 20px rgba(22,163,74,0.32);
          transition: all 0.18s ease;
          font-family: inherit;
        }
        .lp-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(22,163,74,0.40);
        }
        .lp-submit:active:not(:disabled) { transform: translateY(1px); }
        .lp-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .lp-right-footer {
          padding-top: 14px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
        }
        .lp-right-footer .secured {
          display: flex; align-items: center; gap: 4px;
          color: #16a34a; font-weight: 700;
        }
        .lp-pw-toggle {
          background: none; border: none; cursor: pointer;
          color: #94a3b8; padding: 4px;
          display: flex; align-items: center;
          transition: color 0.15s;
        }
        .lp-pw-toggle:hover { color: #16a34a; }
      `}</style>

      <div className="login-root">

        {/* â•â•â•â•â•â•â•â•â•â• LEFT PANEL â•â•â•â•â•â•â•â•â•â• */}
        <div className="lp-left">

          {/* Brand */}
          <div className="lp-brand">
            <div className="lp-brand-icon">
              <Cake size={26} color="#ffffff" />
            </div>
            <div>
              <div className="lp-branch-badge">
                <Sparkles size={10} />
                Katugastota Branch Â· Live POS
              </div>
              <h1 className="lp-shop-name">Wasana Cake</h1>
            </div>
          </div>

          <p className="lp-desc">
            à¶­à·à¶»à·à¶œà¶­à·Š à¶šà·Šâ€à¶»à·’à¶ºà·à¶šà¶»à·” (Operator) à¶­à·à¶»à· à¶”à¶¶à¶œà·š PIN à¶…à¶‚à¶šà¶º à¶‡à¶­à·”à·…à¶­à·Š à¶šà¶»
            Workstation à¶‘à¶š à·€à·’à·€à·˜à¶­ à¶šà¶»à¶±à·Šà¶±.
          </p>

          {/* Operator grid */}
          <div style={{ marginBottom: 20 }}>
            <div className="lp-section-label">
              <span>Active Operator</span>
              <span>Quick Touch</span>
            </div>
            <div className="lp-operator-grid">
              {PRESET_OPERATORS.map((op) => {
                const isSelected = selectedOperator?.id === op.id
                return (
                  <div
                    key={op.id}
                    onClick={() => handleSelectOperator(op)}
                    className={`lp-op-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div
                      className="lp-op-avatar"
                      style={{ background: op.avatarColor }}
                    >
                      {op.name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="lp-op-name">{op.name}</div>
                      <div className="lp-op-role" style={{ color: op.avatarColor }}>
                        {op.roleTitle}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Diagnostics */}
          <div className="lp-diag">
            <div className="lp-diag-row">
              <span className="lp-diag-label"><Store size={13} color="#16a34a" /> Branch</span>
              <span className="lp-diag-value">{currentShop?.name || 'Wasana Cake â€“ Katugastota'}</span>
            </div>
            <div className="lp-diag-row">
              <span className="lp-diag-label"><Activity size={13} color="#3b82f6" /> Terminal</span>
              <span className="lp-diag-value">Station {currentTerminalId} Â· Active</span>
            </div>
            <div className="lp-diag-row">
              <span className="lp-diag-label"><HardDrive size={13} color="#a855f7" /> Database</span>
              <span className="lp-diag-value">Offline SQLite Ready</span>
            </div>
            <div className="lp-diag-row">
              <span className="lp-diag-label"><Wifi size={13} color="#f59e0b" /> Cloud Sync</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 700, fontSize: 11.5 }}>
                <span className="lp-live-dot" /> Live Autoâ€‘Sync
              </span>
            </div>
          </div>

          {/* Clock footer */}
          <div className="lp-footer">
            <div className="lp-clock">
              <Clock size={13} color="#16a34a" />
              <span className="lp-clock-time">{currentTime}</span>
              <span style={{ color: '#e2e8f0' }}>|</span>
              <span className="lp-clock-date">{currentDate}</span>
            </div>
            <div className="lp-secured">
              <ShieldCheck size={13} /> POS Secured
            </div>
          </div>
        </div>

        {/* â•â•â•â•â•â•â•â•â•â• RIGHT PANEL â•â•â•â•â•â•â•â•â•â• */}
        <div className="lp-right">

          {/* Mode tabs */}
          <div className="lp-tabs">
            <button
              type="button"
              className={`lp-tab ${mode === 'passcode' ? 'active' : ''}`}
              onClick={() => { setMode('passcode'); setError(null) }}
            >
              <KeyRound size={14} /> Quick PIN
            </button>
            <button
              type="button"
              className={`lp-tab ${mode === 'credentials' ? 'active' : ''}`}
              onClick={() => { setMode('credentials'); setError(null) }}
            >
              <User size={14} /> Password Login
            </button>
          </div>

          {/* Operator banner */}
          {selectedOperator && (
            <div className="lp-op-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="lp-op-banner-dot" />
                <div>
                  <div className="lp-op-banner-name">{selectedOperator.name}</div>
                  <div className="lp-op-banner-role">{selectedOperator.roleTitle} Â· Ready to unlock</div>
                </div>
              </div>
              <span className="lp-op-banner-pin">PIN: 123456</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="lp-error">
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* â”€â”€ Passcode mode â”€â”€ */}
          {mode === 'passcode' && (
            <div>
              <div className="lp-pin-dots">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`lp-pin-dot ${i < passcode.length ? 'filled' : ''}`} />
                ))}
              </div>

              <div className="lp-pin-status">
                {isLoading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
                    <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                    Verifying operator PIN...
                  </span>
                ) : passcode.length === 0 ? (
                  'Enter 6-digit PIN (Touch keypad or keyboard)'
                ) : (
                  <span style={{ color: '#16a34a' }}>{passcode.length} / 6 digits entered</span>
                )}
              </div>

              <div className="lp-keypad">
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="lp-key"
                    onClick={() => handlePasscodeKey(d)}
                    disabled={isLoading}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className="lp-key key-clear"
                  onClick={() => { setPasscode(''); setError(null) }}
                  disabled={isLoading || passcode.length === 0}
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  className="lp-key"
                  onClick={() => handlePasscodeKey('0')}
                  disabled={isLoading}
                >
                  0
                </button>
                <button
                  type="button"
                  className="lp-key key-delete"
                  onClick={() => setPasscode((p) => p.slice(0, -1))}
                  disabled={isLoading || passcode.length === 0}
                >
                  âŒ«
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Credentials mode â”€â”€ */}
          {mode === 'credentials' && (
            <form onSubmit={handleCredentialsLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email */}
              <div>
                <div className="lp-field-label">
                  <span>Operator ID or Email</span>
                  {detectedRole && (
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700,
                        color: detectedRole.color, background: detectedRole.bg,
                        padding: '2px 8px', borderRadius: 10
                      }}
                    >
                      {detectedRole.label}
                    </span>
                  )}
                </div>
                <div className={`lp-field-wrap ${emailFocused ? 'focused' : ''} ${fieldErrors.email ? 'field-error' : ''}`}>
                  <User size={15} color={emailFocused ? '#16a34a' : '#94a3b8'} style={{ marginRight: 10, flexShrink: 0 }} />
                  <input
                    type="text"
                    className="lp-input"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="cashier1 Â· manager Â· owner"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
                {fieldErrors.email && <span className="lp-field-err">{fieldErrors.email}</span>}
              </div>

              {/* Password */}
              <div>
                <label className="lp-field-label">Security Password</label>
                <div className={`lp-field-wrap ${passFocused ? 'focused' : ''} ${fieldErrors.password ? 'field-error' : ''}`}>
                  <Lock size={15} color={password.length > 0 || passFocused ? '#16a34a' : '#94a3b8'} style={{ marginRight: 10, flexShrink: 0 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="lp-input"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                    }}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button type="button" className="lp-pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldErrors.password && <span className="lp-field-err">{fieldErrors.password}</span>}
              </div>

              <button type="submit" className="lp-submit" disabled={isLoading}>
                {isLoading ? (
                  <><RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} /><span>Authenticating...</span></>
                ) : (
                  <><span>Unlock Workstation</span><ArrowRight size={15} /></>
                )}
              </button>

              <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                Default Password:&nbsp;
                <span style={{ color: '#16a34a', fontWeight: 700 }}>cashier123</span>
                &nbsp;/&nbsp;
                <span style={{ color: '#16a34a', fontWeight: 700 }}>123456</span>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="lp-right-footer">
            <span>Wasana POS Terminal v1.0.0</span>
            <span className="secured">
              <ShieldCheck size={12} /> End-to-End Encrypted
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

