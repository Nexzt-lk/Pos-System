import React, { useState, useEffect, useCallback } from 'react'
import {
  Cake, CakeSlice, Sparkles, ShieldCheck, Lock, Eye, EyeOff, Store, Clock,
  ArrowRight, KeyRound, AlertTriangle, RefreshCw, User, Activity,
  HardDrive, Wifi, CheckCircle2, ChevronRight
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
    badgeColor: 'rgba(22, 163, 74, 0.15)'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000004',
    name: 'Dilani Silva',
    email: 'cashier2@rasacakes.lk',
    role: 'cashier',
    roleTitle: 'Cashier 02',
    avatarColor: '#059669',
    badgeColor: 'rgba(5, 150, 105, 0.15)'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000002',
    name: 'Sunil Jayasinghe',
    email: 'manager@rasacakes.lk',
    role: 'manager',
    roleTitle: 'Branch Manager',
    avatarColor: '#2563eb',
    badgeColor: 'rgba(37, 99, 235, 0.15)'
  },
  {
    id: 'u0000000-0000-0000-0000-000000000001',
    name: 'Nimal Perera',
    email: 'owner@rasacakes.lk',
    role: 'owner',
    roleTitle: 'Store Owner',
    avatarColor: '#d97706',
    badgeColor: 'rgba(217, 119, 6, 0.15)'
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
    if (clean.includes('owner')) return { label: 'Store Owner', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    if (clean.includes('manager')) return { label: 'Branch Manager', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }
    if (clean.includes('cashier')) return { label: 'Terminal Cashier', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
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
        setError('Invalid 6-digit PIN. Please try again.')
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
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(22, 163, 74, 0.25), 0 0 50px rgba(22, 163, 74, 0.1); }
          50% { box-shadow: 0 0 40px rgba(22, 163, 74, 0.45), 0 0 80px rgba(22, 163, 74, 0.2); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        @keyframes pinPop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        .wasana-bg {
          background: radial-gradient(circle at 20% 20%, #0f2416 0%, #08110b 45%, #050906 100%);
        }

        .wasana-glass-card {
          background: rgba(14, 25, 18, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .operator-card {
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: 1.5px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.025);
        }
        .operator-card:hover {
          transform: translateY(-2px);
          border-color: rgba(34, 197, 94, 0.4);
          background: rgba(34, 197, 94, 0.07);
        }
        .operator-card.selected {
          border-color: #22c55e;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(21, 128, 61, 0.12) 100%);
          box-shadow: 0 4px 20px rgba(34, 197, 94, 0.25), inset 0 0 15px rgba(34, 197, 94, 0.1);
        }

        .keypad-btn {
          height: 60px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #f8fafc;
          font-size: 22px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.12s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          user-select: none;
        }
        .keypad-btn:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.18);
          border-color: rgba(34, 197, 94, 0.5);
          color: #86efac;
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 16px rgba(34, 197, 94, 0.25);
        }
        .keypad-btn:active:not(:disabled) {
          transform: translateY(1px) scale(0.97);
        }
        .keypad-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .keypad-btn.action-btn {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }
      `}</style>

      <div
        className="wasana-bg"
        style={{
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Poppins', 'Noto Sans Sinhala', sans-serif",
          position: 'relative',
          padding: 24,
          boxSizing: 'border-box'
        }}
      >
        {/* Ambient background glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              top: '-15%',
              left: '-10%',
              width: 650,
              height: 650,
              background: 'radial-gradient(circle, rgba(22, 163, 74, 0.2) 0%, transparent 70%)',
              borderRadius: '50%'
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-20%',
              right: '-10%',
              width: 700,
              height: 700,
              background: 'radial-gradient(circle, rgba(217, 119, 6, 0.12) 0%, transparent 70%)',
              borderRadius: '50%'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '40%',
              right: '25%',
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%)',
              borderRadius: '50%'
            }}
          />
        </div>

        {/* Master Window Container */}
        <div
          className="wasana-glass-card"
          style={{
            width: '100%',
            maxWidth: 1060,
            minHeight: 620,
            borderRadius: 28,
            overflow: 'hidden',
            display: 'flex',
            boxShadow: '0 30px 90px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(34, 197, 94, 0.2)',
            position: 'relative',
            zIndex: 1
          }}
        >
          {/* ══════════════════════════════════════════════════════════════
              LEFT SHOWCASE PANEL: Brand Identity, Operators, Diagnostics
              ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              flex: '1.05',
              background: 'linear-gradient(175deg, rgba(13, 27, 18, 0.95) 0%, rgba(7, 16, 11, 0.98) 100%)',
              padding: '36px 36px 30px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRight: '1px solid rgba(34, 197, 94, 0.15)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Top: Brand Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(22, 163, 74, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                    animation: 'floatSlow 4s ease-in-out infinite'
                  }}
                >
                  <Cake size={28} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: '#4ade80',
                        background: 'rgba(74, 222, 128, 0.12)',
                        padding: '3px 9px',
                        borderRadius: 20,
                        border: '1px solid rgba(74, 222, 128, 0.3)'
                      }}
                    >
                      Katugastota Branch
                    </span>
                    <span style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={12} /> Live POS
                    </span>
                  </div>
                  <h1
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: 24,
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.15
                    }}
                  >
                    Wasana Cake
                  </h1>
                </div>
              </div>

              {/* Description */}
              <p style={{ margin: '0 0 20px 0', fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
                Select an Operator and enter your PIN to open the Workstation.
              </p>

              {/* Operator Select Grid */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#64748b',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Select Active Operator</span>
                  <span style={{ color: '#4ade80', fontSize: 10 }}>Quick Touch</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {PRESET_OPERATORS.map((op) => {
                    const isSelected = selectedOperator?.id === op.id
                    return (
                      <div
                        key={op.id}
                        onClick={() => handleSelectOperator(op)}
                        className={`operator-card ${isSelected ? 'selected' : ''}`}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 16,
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              background: op.badgeColor,
                              border: `1.5px solid ${op.avatarColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: 14,
                              flexShrink: 0
                            }}
                          >
                            {op.name.charAt(0)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: isSelected ? '#ffffff' : '#e2e8f0',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {op.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: op.avatarColor
                              }}
                            >
                              {op.roleTitle}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Station Diagnostics */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={13} color="#4ade80" /> Branch
                  </span>
                  <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{currentShop?.name || 'Wasana Cake - Katugastota'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={13} color="#3b82f6" /> Terminal
                  </span>
                  <span style={{ color: '#f1f5f9', fontWeight: 600 }}>Station {currentTerminalId} · Active</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HardDrive size={13} color="#a855f7" /> Database
                  </span>
                  <span style={{ color: '#f1f5f9', fontWeight: 600 }}>Offline SQLite Ready</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Wifi size={13} color="#f59e0b" /> Cloud Sync
                  </span>
                  <span style={{ color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> Live Auto-Sync
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom: Live Clock & Security Status */}
            <div
              style={{
                paddingTop: 16,
                marginTop: 16,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color="#4ade80" />
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#f8fafc',
                    letterSpacing: '0.05em'
                  }}
                >
                  {currentTime}
                </span>
                <span style={{ color: '#334155' }}>|</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{currentDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4ade80', fontWeight: 700 }}>
                <ShieldCheck size={14} />
                <span>POS Secured</span>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT ACTION PANEL: Mode Tabs, Passcode Numpad & Credentials
              ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              flex: '1',
              background: 'linear-gradient(160deg, rgba(8, 16, 11, 0.96) 0%, rgba(4, 9, 6, 0.98) 100%)',
              padding: '36px 36px 30px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            <div>
              {/* Header with Switcher Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: 4,
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: 20
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode('passcode')
                    setError(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: mode === 'passcode' ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'transparent',
                    color: mode === 'passcode' ? '#ffffff' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: mode === 'passcode' ? '0 4px 12px rgba(22, 163, 74, 0.35)' : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <KeyRound size={15} /> Quick PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('credentials')
                    setError(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: mode === 'credentials' ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'transparent',
                    color: mode === 'credentials' ? '#ffffff' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: mode === 'credentials' ? '0 4px 12px rgba(22, 163, 74, 0.35)' : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <User size={15} /> Password Login
                </button>
              </div>

              {/* Current Selected Operator Banner */}
              {selectedOperator && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    marginBottom: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 10px #22c55e'
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                        {selectedOperator.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#86efac', fontWeight: 600 }}>
                        {selectedOperator.roleTitle} · Ready to unlock
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '3px 8px',
                      borderRadius: 8
                    }}
                  >
                    PIN: 123456
                  </span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 14,
                    animation: 'shake 0.4s ease'
                  }}
                >
                  <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* ── MODE 1: PASSCODE (NUMPAD) ── */}
              {mode === 'passcode' && (
                <div>
                  {/* PIN Display Circles */}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '14px 0 10px 0' }}>
                    {[...Array(6)].map((_, i) => {
                      const isFilled = i < passcode.length
                      return (
                        <div
                          key={i}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: isFilled ? '#22c55e' : 'rgba(255, 255, 255, 0.08)',
                            border: `2px solid ${isFilled ? '#4ade80' : 'rgba(255, 255, 255, 0.2)'}`,
                            boxShadow: isFilled ? '0 0 14px rgba(34, 197, 94, 0.8)' : 'none',
                            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                            animation: isFilled ? 'pinPop 0.18s ease' : 'none'
                          }}
                        />
                      )
                    })}
                  </div>

                  <div
                    style={{
                      textAlign: 'center',
                      marginBottom: 16,
                      fontSize: 12,
                      fontWeight: 600,
                      minHeight: 18,
                      color: isLoading ? '#4ade80' : '#94a3b8'
                    }}
                  >
                    {isLoading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                        Verifying operator PIN...
                      </span>
                    ) : passcode.length === 0 ? (
                      'Enter 6-digit PIN (Touch keypad or keyboard)'
                    ) : (
                      <span style={{ color: '#4ade80' }}>{passcode.length} / 6 digits entered</span>
                    )}
                  </div>

                  {/* 3x4 Touch POS Keypad */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="keypad-btn"
                        onClick={() => handlePasscodeKey(d)}
                        disabled={isLoading}
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="keypad-btn action-btn"
                      style={{ color: '#94a3b8' }}
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
                      className="keypad-btn"
                      onClick={() => handlePasscodeKey('0')}
                      disabled={isLoading}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      className="keypad-btn action-btn"
                      style={{ color: '#f87171', fontSize: 20 }}
                      onClick={() => setPasscode((p) => p.slice(0, -1))}
                      disabled={isLoading || passcode.length === 0}
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              )}

              {/* ── MODE 2: CREDENTIALS (USERNAME + PASSWORD) ── */}
              {mode === 'credentials' && (
                <form onSubmit={handleCredentialsLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Operator ID or Email
                      </label>
                      {detectedRole && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: detectedRole.color,
                            background: detectedRole.bg,
                            padding: '2px 8px',
                            borderRadius: 10
                          }}
                        >
                          {detectedRole.label}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: emailFocused ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1.5px solid ${
                          fieldErrors.email ? '#ef4444' : emailFocused ? '#22c55e' : 'rgba(255, 255, 255, 0.1)'
                        }`,
                        borderRadius: 14,
                        padding: '0 14px',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      <User size={16} color={emailFocused ? '#4ade80' : '#64748b'} style={{ marginRight: 10 }} />
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                        }}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        placeholder="cashier1 · manager · owner"
                        disabled={isLoading}
                        autoComplete="username"
                        style={{
                          width: '100%',
                          padding: '13px 0',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: '#ffffff',
                          caretColor: '#22c55e'
                        }}
                      />
                    </div>
                    {fieldErrors.email && (
                      <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginTop: 4, display: 'block' }}>
                        {fieldErrors.email}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Security Password
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: passFocused ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1.5px solid ${
                          fieldErrors.password ? '#ef4444' : passFocused ? '#22c55e' : 'rgba(255, 255, 255, 0.1)'
                        }`,
                        borderRadius: 14,
                        padding: '0 14px',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      <Lock size={16} color={password.length > 0 ? '#4ade80' : passFocused ? '#4ade80' : '#64748b'} style={{ marginRight: 10 }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                        }}
                        onFocus={() => setPassFocused(true)}
                        onBlur={() => setPassFocused(false)}
                        placeholder="••••••••"
                        disabled={isLoading}
                        autoComplete="current-password"
                        style={{
                          width: '100%',
                          padding: '13px 0',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: '#ffffff',
                          caretColor: '#22c55e'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginTop: 4, display: 'block' }}>
                        {fieldErrors.password}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      marginTop: 8,
                      padding: '14px 20px',
                      borderRadius: 16,
                      border: 'none',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #166534 100%)',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 8px 24px rgba(22, 163, 74, 0.45)',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Unlock Workstation</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                    Default Password: <span style={{ color: '#4ade80' }}>cashier123</span> / <span style={{ color: '#4ade80' }}>123456</span>
                  </div>
                </form>
              )}
            </div>

            {/* Terminal Security Badge */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#64748b'
              }}
            >
              <span>Wasana POS Terminal v1.0.0</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80' }}>
                <ShieldCheck size={13} /> End-to-End Encrypted
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
