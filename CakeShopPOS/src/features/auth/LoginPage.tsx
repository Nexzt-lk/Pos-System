import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, Lock, Eye, EyeOff, Store, Clock,
  ArrowRight, KeyRound,
  AlertTriangle, RefreshCw,
  User, Activity, HardDrive
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import dayjs from 'dayjs'
import nexztLogo from '../../assets/nexzt-logo.png'

type AuthMode = 'credentials' | 'passcode'

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('credentials')
  
  // Credentials State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // Passcode State
  const [passcode, setPasscode] = useState('')

  // State
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(dayjs().format('hh:mm:ss A'))

  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setUser = useAppStore((state) => state.setUser)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs().format('hh:mm:ss A')), 1000)
    return () => clearInterval(timer)
  }, [])

  // Smart Live Role Detector as user types
  const getDetectedRole = (input: string): { label: string; color: string; bg: string } | null => {
    const clean = input.trim().toLowerCase()
    if (clean.startsWith('owner')) {
      return { label: 'Store Owner', color: '#16a34a', bg: '#f0fdf4' }
    }
    if (clean.startsWith('manager')) {
      return { label: 'Branch Manager', color: '#2563eb', bg: '#eff6ff' }
    }
    if (clean.startsWith('cashier')) {
      return { label: 'Terminal Cashier', color: '#d97706', bg: '#fffbeb' }
    }
    return null
  }

  const detectedRole = getDetectedRole(email)

  const handleCredentialsLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()

    if (!cleanEmail) {
      setFieldErrors({ email: 'Please enter your Operator ID or Email' })
      return
    }
    if (!cleanPassword) {
      setFieldErrors({ password: 'Please enter your password' })
      return
    }

    setIsLoading(true)
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.dbQuery('auth:login-email', {
          email: cleanEmail,
          password: cleanPassword,
          shopId: currentShop?.id
        })

        if (result && result.success && result.user) {
          setUser(result.user)
          return
        } else {
          setError(result?.message || 'Authentication failed. Please verify your credentials.')
        }
      } else {
        // Browser testing fallback
        if (cleanEmail === 'owner@rasacakes.lk' || cleanEmail === 'owner') {
          if (cleanPassword === 'owner123' || cleanPassword === '123456') {
            setUser({
              id: 'u0000000-0000-0000-0000-000000000001',
              tenant_id: currentShop?.tenant_id || '',
              shop_id: currentShop?.id || '',
              name: 'Nimal Perera (Owner)',
              email: 'owner@rasacakes.lk',
              role: 'owner',
              is_active: true
            })
            return
          }
        } else if (cleanEmail === 'manager@rasacakes.lk' || cleanEmail === 'manager') {
          if (cleanPassword === 'manager123' || cleanPassword === '123456') {
            setUser({
              id: 'u0000000-0000-0000-0000-000000000002',
              tenant_id: currentShop?.tenant_id || '',
              shop_id: currentShop?.id || '',
              name: 'Sunil Jayasinghe (Manager)',
              email: 'manager@rasacakes.lk',
              role: 'manager',
              is_active: true
            })
            return
          }
        } else if (cleanEmail === 'cashier1@rasacakes.lk' || cleanEmail === 'cashier1' || cleanEmail === 'cashier') {
          if (cleanPassword === 'cashier123' || cleanPassword === '123456') {
            setUser({
              id: 'u0000000-0000-0000-0000-000000000003',
              tenant_id: currentShop?.tenant_id || '',
              shop_id: currentShop?.id || '',
              name: 'Kasun Bandara (Cashier 1)',
              email: 'cashier1@rasacakes.lk',
              role: 'cashier',
              is_active: true
            })
            return
          }
        } else if (cleanEmail === 'cashier2@rasacakes.lk' || cleanEmail === 'cashier2') {
          if (cleanPassword === 'cashier123' || cleanPassword === '123456') {
            setUser({
              id: 'u0000000-0000-0000-0000-000000000004',
              tenant_id: currentShop?.tenant_id || '',
              shop_id: currentShop?.id || '',
              name: 'Dilani Silva (Cashier 2)',
              email: 'cashier2@rasacakes.lk',
              role: 'cashier',
              is_active: true
            })
            return
          }
        }
        setError('Incorrect Operator ID or Password.')
      }
    } catch (err: any) {
      setError(err.message || 'System authentication error')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasscodeKey = (digit: string) => {
    if (passcode.length < 6 && !isLoading) {
      setError(null)
      const next = passcode + digit
      setPasscode(next)
      if (next.length === 6) {
        verifyPasscode(next)
      }
    }
  }

  const verifyPasscode = async (code: string) => {
    setIsLoading(true)
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.dbQuery('auth:verify-pin', {
          shopId: currentShop?.id,
          pin: code
        })
        if (result && result.success && result.user) {
          setUser(result.user)
          return
        } else {
          setError(result?.message || 'Invalid 6-digit passcode. Please try again.')
          setPasscode('')
        }
      } else {
        if (code === '123456') {
          setUser({
            id: 'u0000000-0000-0000-0000-000000000003',
            tenant_id: currentShop?.tenant_id || '',
            shop_id: currentShop?.id || '',
            name: 'Kasun Bandara (Cashier 1)',
            email: 'cashier1@rasacakes.lk',
            role: 'cashier',
            is_active: true
          })
        } else {
          setError('Invalid 6-digit passcode.')
          setPasscode('')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Passcode verification failed')
      setPasscode('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
      padding: '30px',
      userSelect: 'none'
    }}>
      {/* ================= DUAL-PANE ARCHITECTURAL DOCK ================= */}
      <div style={{
        width: '100%',
        maxWidth: 960,
        minHeight: 560,
        background: '#ffffff',
        borderRadius: 28,
        border: '1px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* ================= LEFT TELEMETRY PANEL ================= */}
        <div style={{
          flex: '1',
          background: '#fafafa',
          borderRight: '1px solid #f1f5f9',
          padding: '36px 34px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {/* Top Nexzt Brand Logo */}
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 14px',
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              marginBottom: 20
            }}>
              <img
                src={nexztLogo}
                alt="Nexzt POS"
                style={{
                  height: 38,
                  maxWidth: '180px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: 21,
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.3,
              letterSpacing: '-0.02em',
              marginBottom: 8
            }}>
              Next-Gen Point of Sale
            </h2>
            <p style={{
              fontSize: 12,
              color: '#64748b',
              lineHeight: 1.6,
              margin: 0
            }}>
              Rasa Cake House POS Terminal powered by Nexzt POS Enterprise Suite.
            </p>
          </div>

          {/* Real-Time Telemetry Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '20px 0' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={15} style={{ color: '#16a34a' }} />
                <span style={{ fontWeight: 600, color: '#475569' }}>Active Branch</span>
              </div>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentShop?.name || 'Kandy Branch'}</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={15} style={{ color: '#2563eb' }} />
                <span style={{ fontWeight: 600, color: '#475569' }}>Station Status</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontWeight: 700, color: '#16a34a' }}>Station {currentTerminalId} · Active</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={15} style={{ color: '#7c3aed' }} />
                <span style={{ fontWeight: 600, color: '#475569' }}>Database Engine</span>
              </div>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Local SQLite · Online</span>
            </div>
          </div>

          {/* Digital Clock & Security Footnote */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 14,
            borderTop: '1px solid #e2e8f0',
            fontSize: 11,
            color: '#94a3b8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>
              <Clock size={13} style={{ color: '#16a34a' }} />
              <span>{currentTime}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={13} color="#16a34a" />
              <span>Nexzt Secured</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT AUTHENTICATION PANEL ================= */}
        <div style={{
          flex: '1.15',
          padding: '40px 38px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#ffffff'
        }}>
          {/* Header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 800,
              color: '#16a34a',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4
            }}>
              Terminal Login
            </div>
            <h3 style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: 0
            }}>
              Sign In to Station
            </h3>
          </div>

          {/* Mode Switcher Pills */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 12,
            gap: 4,
            marginBottom: 22
          }}>
            <button
              type="button"
              onClick={() => { setMode('credentials'); setError(null); }}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 9,
                border: 'none',
                background: mode === 'credentials' ? '#ffffff' : 'transparent',
                color: mode === 'credentials' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: mode === 'credentials' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <User size={14} />
              Operator Credentials
            </button>
            <button
              type="button"
              onClick={() => { setMode('passcode'); setError(null); }}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 9,
                border: 'none',
                background: mode === 'passcode' ? '#ffffff' : 'transparent',
                color: mode === 'passcode' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: mode === 'passcode' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <KeyRound size={14} />
              Quick Passcode
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: 12,
              padding: '11px 14px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              animation: 'shake 0.4s ease'
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* ================= MODE 1: OPERATOR CREDENTIALS ================= */}
          {mode === 'credentials' && (
            <form onSubmit={handleCredentialsLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Operator ID Field */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    Operator ID or Email
                  </label>
                  {/* Dynamic Role Detected Pill */}
                  {detectedRole && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: detectedRole.color,
                      background: detectedRole.bg,
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: `1px solid ${detectedRole.color}30`
                    }}>
                      {detectedRole.label}
                    </span>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: `1.5px solid ${fieldErrors.email ? '#ef4444' : '#e2e8f0'}`,
                  borderRadius: 14,
                  padding: '0 14px',
                  transition: 'border-color 0.15s ease'
                }}>
                  <User size={16} style={{ color: '#94a3b8', marginRight: 10, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                    }}
                    placeholder="e.g. owner or owner@rasacakes.lk"
                    disabled={isLoading}
                    autoComplete="username"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0f172a',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                {fieldErrors.email && (
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 4, display: 'block' }}>
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Security Password
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: `1.5px solid ${fieldErrors.password ? '#ef4444' : '#e2e8f0'}`,
                  borderRadius: 14,
                  padding: '0 14px',
                  transition: 'border-color 0.15s ease'
                }}>
                  <Lock size={16} style={{ color: password.length >= 4 ? '#16a34a' : '#94a3b8', marginRight: 10, flexShrink: 0 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                    }}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0f172a',
                      fontFamily: 'inherit'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 4,
                      display: 'flex'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 4, display: 'block' }}>
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: 6,
                  padding: '14px 20px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Workstation</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================= MODE 2: QUICK PASSCODE ================= */}
          {mode === 'passcode' && (
            <div>
              <div className="pin-dots" style={{ margin: '8px 0 10px' }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`pin-dot ${i < passcode.length ? 'filled' : ''}`} />
                ))}
              </div>

              <div className="pin-hint" style={{ marginBottom: 12, fontSize: 12, color: '#64748b' }}>
                {isLoading ? 'Verifying passcode...' : passcode.length === 0 ? 'Enter your 6-digit terminal passcode' : ''}
              </div>

              <div className="pin-numpad" style={{ margin: '4px 0 8px' }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} className="numpad-key" onClick={() => handlePasscodeKey(d)} disabled={isLoading}>
                    {d}
                  </button>
                ))}
                <button className="numpad-key clear-key" onClick={() => setPasscode('')} disabled={isLoading || passcode.length === 0}>
                  Clear
                </button>
                <button className="numpad-key" onClick={() => handlePasscodeKey('0')} disabled={isLoading}>
                  0
                </button>
                <button className="numpad-key delete-key" onClick={() => setPasscode((p) => p.slice(0, -1))} disabled={isLoading || passcode.length === 0}>
                  ←
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
