import React, { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, ShieldCheck, Lock, Eye, EyeOff, Store, Clock,
  ArrowRight, KeyRound, AlertTriangle, RefreshCw, User, Activity,
  HardDrive, Wifi, CheckCircle2, Zap, Cloud, Terminal, Check
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import dayjs from 'dayjs'
import heroImage from '../../assets/nexzt-login-hero.jpg'
import nexztLogo from '../../assets/nexzt-logo.png'

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

  // Live real-time clock
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
        /* ══════════════════════════════════════════════════════════════
           ANIMATIONS & KEYFRAMES
           ══════════════════════════════════════════════════════════════ */
        @keyframes floatOrb1 {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(60px, 40px) scale(1.12);
          }
          100% {
            transform: translate(-30px, 70px) scale(0.95);
          }
        }

        @keyframes floatOrb2 {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(-70px, -50px) scale(1.15);
          }
          100% {
            transform: translate(40px, -30px) scale(0.9);
          }
        }

        @keyframes floatOrb3 {
          0% {
            transform: translate(0px, 0px) scale(0.9);
            opacity: 0.35;
          }
          50% {
            transform: translate(50px, -40px) scale(1.18);
            opacity: 0.65;
          }
          100% {
            transform: translate(-40px, 30px) scale(0.95);
            opacity: 0.35;
          }
        }

        @keyframes gridMove {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 48px 48px;
          }
        }

        @keyframes heroFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 20px 45px -10px rgba(22, 163, 74, 0.22), 0 0 0 1px rgba(34, 197, 94, 0.18);
          }
          50% {
            box-shadow: 0 25px 60px -5px rgba(22, 163, 74, 0.32), 0 0 0 2px rgba(34, 197, 94, 0.32);
          }
        }

        @keyframes pinPop {
          0% { transform: scale(0.5); opacity: 0.5; }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes liveDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }

        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ══════════════════════════════════════════════════════════════
           ROOT WRAPPER - CLEAN WHITE WITH ANIMATED ORBS
           ══════════════════════════════════════════════════════════════ */
        .nx-login-root {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #ffffff;
          font-family: 'Poppins', 'Noto Sans Sinhala', system-ui, -apple-system, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Animated Background Grid */
        .nx-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(to right, rgba(22, 163, 74, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(22, 163, 74, 0.045) 1px, transparent 1px);
          background-size: 36px 36px;
          animation: gridMove 30s linear infinite;
          pointer-events: none;
          z-index: 1;
        }

        /* Animated Gradient Orbs */
        .nx-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }

        .nx-orb-1 {
          top: -120px;
          left: -100px;
          width: 580px;
          height: 580px;
          background: radial-gradient(circle, rgba(34, 197, 94, 0.16) 0%, rgba(16, 185, 129, 0.08) 50%, transparent 70%);
          animation: floatOrb1 20s ease-in-out infinite alternate;
        }

        .nx-orb-2 {
          bottom: -150px;
          right: -80px;
          width: 650px;
          height: 650px;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 70%);
          animation: floatOrb2 24s ease-in-out infinite alternate;
        }

        .nx-orb-3 {
          top: 35%;
          right: 38%;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(74, 222, 128, 0.12) 0%, rgba(20, 184, 166, 0.06) 60%, transparent 75%);
          animation: floatOrb3 18s ease-in-out infinite alternate;
        }

        /* Subtle Vignette / Edge Glow */
        .nx-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, transparent 60%, rgba(240, 253, 244, 0.5) 100%);
          pointer-events: none;
          z-index: 1;
        }

        /* ══════════════════════════════════════════════════════════════
           MAIN SPLIT CONTAINER
           ══════════════════════════════════════════════════════════════ */
        .nx-container {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: stretch;
        }

        /* ──────────────────────────────────────────────────────────────
           LEFT PANEL: 3D HERO IMAGE SHOWCASE
           ────────────────────────────────────────────────────────────── */
        .nx-hero-section {
          flex: 1.1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 32px 40px;
          position: relative;
          background: linear-gradient(145deg, #f8fafc 0%, #f0fdf4 100%);
          border-right: 1px solid rgba(226, 232, 240, 0.9);
          overflow: hidden;
        }

        .nx-hero-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 3;
        }

        .nx-brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          background: #ffffff;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid rgba(34, 197, 94, 0.25);
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.08);
        }

        .nx-brand-logo-img {
          height: 22px;
          object-fit: contain;
        }

        .nx-brand-tag {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #16a34a;
        }

        .nx-branch-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 600;
          color: #334155;
          background: #ffffff;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }

        /* Hero Image Container */
        .nx-hero-artwork {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin: 16px 0;
        }

        .nx-hero-image-wrap {
          position: relative;
          width: 100%;
          max-width: 520px;
          max-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: heroFloat 6s ease-in-out infinite;
        }

        .nx-hero-img {
          width: 100%;
          height: auto;
          max-height: 520px;
          object-fit: contain;
          border-radius: 28px;
          box-shadow:
            0 24px 48px -12px rgba(22, 163, 74, 0.22),
            0 12px 24px -8px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(22, 163, 74, 0.15);
          transition: transform 0.4s ease, box-shadow 0.4s ease;
          background: #ffffff;
        }

        .nx-hero-img:hover {
          transform: scale(1.015);
          box-shadow:
            0 32px 64px -12px rgba(22, 163, 74, 0.3),
            0 0 0 2px rgba(22, 163, 74, 0.3);
        }

        /* Ambient glow backdrop behind the image */
        .nx-hero-glow-ring {
          position: absolute;
          inset: -15px;
          border-radius: 36px;
          background: radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.05) 60%, transparent 80%);
          filter: blur(20px);
          z-index: -1;
          pointer-events: none;
        }

        /* Hero Features Row */
        .nx-hero-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          z-index: 3;
        }

        .nx-feat-chip {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 14px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: all 0.2s ease;
        }

        .nx-feat-chip:hover {
          transform: translateY(-2px);
          border-color: #86efac;
          box-shadow: 0 8px 18px rgba(22, 163, 74, 0.1);
        }

        .nx-feat-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #dcfce7;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #16a34a;
          flex-shrink: 0;
        }

        .nx-feat-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        .nx-feat-sub {
          font-size: 10px;
          font-weight: 500;
          color: #64748b;
        }

        /* ──────────────────────────────────────────────────────────────
           RIGHT PANEL: LOGIN & WORKSTATION CONSOLE
           ────────────────────────────────────────────────────────────── */
        .nx-auth-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 32px 42px;
          background: #ffffff;
          position: relative;
          z-index: 2;
          overflow-y: auto;
        }

        /* Top Bar with Clock & POS Secured */
        .nx-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .nx-clock-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 6px 14px;
          border-radius: 12px;
        }

        .nx-clock-time {
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          font-size: 13.5px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.05em;
        }

        .nx-clock-date {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }

        .nx-security-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #16a34a;
          background: #dcfce7;
          border: 1px solid #bbf7d0;
          padding: 6px 12px;
          border-radius: 999px;
        }

        /* Auth Mode Switcher */
        .nx-mode-tabs {
          display: flex;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 4px;
          border-radius: 16px;
          margin-bottom: 20px;
          gap: 4px;
        }

        .nx-mode-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 12.5px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          background: transparent;
          color: #64748b;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nx-mode-tab.active {
          background: #ffffff;
          color: #16a34a;
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        /* Operator Selector */
        .nx-section-title {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: #94a3b8;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nx-operator-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 18px;
        }

        .nx-op-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 14px;
          border: 1.5px solid #f1f5f9;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .nx-op-card:hover {
          border-color: #cbd5e1;
          background: #ffffff;
          transform: translateY(-1px);
        }

        .nx-op-card.selected {
          border-color: #22c55e;
          background: #ffffff;
          box-shadow: 0 4px 14px rgba(34, 197, 94, 0.14);
        }

        .nx-op-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 800;
          font-size: 13px;
          flex-shrink: 0;
        }

        .nx-op-info {
          min-width: 0;
          flex: 1;
        }

        .nx-op-name {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nx-op-role {
          font-size: 10.5px;
          font-weight: 600;
        }

        /* Error Alert */
        .nx-error-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 16px;
          animation: shake 0.4s ease;
        }

        /* ──────────────────────────────────────────────────────────────
           PASSCODE NUMPAD MODE
           ────────────────────────────────────────────────────────────── */
        .nx-pin-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin: 12px 0 10px 0;
        }

        .nx-pin-dot {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          background: #f8fafc;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .nx-pin-dot.filled {
          border-color: #16a34a;
          background: #16a34a;
          transform: scale(1.15);
          box-shadow: 0 0 12px rgba(22, 163, 74, 0.5);
          animation: pinPop 0.25s ease;
        }

        .nx-pin-status {
          text-align: center;
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
          min-height: 18px;
          margin-bottom: 14px;
        }

        .nx-numpad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          max-width: 320px;
          margin: 0 auto;
        }

        .nx-numkey {
          height: 48px;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
          transition: all 0.15s ease;
          user-select: none;
        }

        .nx-numkey:hover:not(:disabled) {
          border-color: #22c55e;
          background: #f0fdf4;
          color: #16a34a;
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(22, 163, 74, 0.12);
        }

        .nx-numkey:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
        }

        .nx-numkey:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nx-numkey.key-action {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #64748b;
          background: #f8fafc;
        }

        .nx-numkey.key-action:hover:not(:disabled) {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .nx-numkey.key-delete:hover:not(:disabled) {
          color: #dc2626;
          border-color: #fca5a5;
          background: #fef2f2;
        }

        /* ──────────────────────────────────────────────────────────────
           CREDENTIALS MODE
           ────────────────────────────────────────────────────────────── */
        .nx-cred-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-width: 360px;
          margin: 0 auto;
          width: 100%;
        }

        .nx-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nx-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .nx-field-input-box {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 14px;
          transition: all 0.2s ease;
        }

        .nx-field-input-box.focused {
          border-color: #16a34a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
        }

        .nx-field-input-box.error {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .nx-native-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          font-family: inherit;
        }

        .nx-native-input::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }

        .nx-toggle-pw-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: color 0.15s ease;
        }

        .nx-toggle-pw-btn:hover {
          color: #16a34a;
        }

        .nx-submit-btn {
          width: 100%;
          padding: 12px 18px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 8px 20px rgba(22, 163, 74, 0.28);
          transition: all 0.2s ease;
          margin-top: 6px;
        }

        .nx-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(22, 163, 74, 0.35);
        }

        .nx-submit-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .nx-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* ──────────────────────────────────────────────────────────────
           BOTTOM DIAGNOSTICS & FOOTER
           ────────────────────────────────────────────────────────────── */
        .nx-diagnostics-bar {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
          margin-top: 12px;
        }

        .nx-diag-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          background: #f8fafc;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }

        .nx-diag-label {
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: 600;
        }

        .nx-diag-val {
          color: #0f172a;
          font-weight: 700;
        }

        .nx-live-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a34a;
          display: inline-block;
          animation: liveDotPulse 1.8s ease-in-out infinite;
        }

        .nx-auth-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10.5px;
          color: #94a3b8;
          padding-top: 10px;
        }

        .nx-auth-footer-brand {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #16a34a;
          font-weight: 700;
        }

        /* ══════════════════════════════════════════════════════════════
           RESPONSIVE TWEAKS FOR TABLETS / COMPACT POS SCREENS
           ══════════════════════════════════════════════════════════════ */
        @media (max-width: 1024px) {
          .nx-container {
            flex-direction: column;
          }
          .nx-hero-section {
            display: none; /* Focus on auth console on ultra compact screens */
          }
        }
      `}</style>

      <div className="nx-login-root">
        {/* Animated Background Orbs */}
        <div className="nx-orb nx-orb-1" />
        <div className="nx-orb nx-orb-2" />
        <div className="nx-orb nx-orb-3" />

        {/* Animated Moving Background Grid */}
        <div className="nx-bg-grid" />
        <div className="nx-vignette" />

        <div className="nx-container">
          {/* ══════════════════════════════════════════════════════════════
              LEFT PANEL: 3D HERO VISUAL SHOWCASE
              ══════════════════════════════════════════════════════════════ */}
          <div className="nx-hero-section">
            {/* Top Bar on Hero side */}
            <div className="nx-hero-header">
              <div className="nx-brand-badge">
                <img src={nexztLogo} alt="Nexzt POS" className="nx-brand-logo-img" />
                <span className="nx-brand-tag">POS Workstation</span>
              </div>
              <div className="nx-branch-pill">
                <Store size={14} color="#16a34a" />
                <span>{currentShop?.name || 'Wasana Cake - Katugastota'}</span>
              </div>
            </div>

            {/* Central 3D Artwork */}
            <div className="nx-hero-artwork">
              <div className="nx-hero-image-wrap">
                <div className="nx-hero-glow-ring" />
                <img
                  src={heroImage}
                  alt="Welcome to Nexzt POS"
                  className="nx-hero-img"
                />
              </div>
            </div>

            {/* Bottom 3 Feature Badges */}
            <div className="nx-hero-features">
              <div className="nx-feat-chip">
                <div className="nx-feat-icon-box">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="nx-feat-title">Fast Billing</div>
                  <div className="nx-feat-sub">Quick Touch & Numpad</div>
                </div>
              </div>

              <div className="nx-feat-chip">
                <div className="nx-feat-icon-box">
                  <Cloud size={16} />
                </div>
                <div>
                  <div className="nx-feat-title">Live Auto-Sync</div>
                  <div className="nx-feat-sub">Multi-Terminal Cloud</div>
                </div>
              </div>

              <div className="nx-feat-chip">
                <div className="nx-feat-icon-box">
                  <HardDrive size={16} />
                </div>
                <div>
                  <div className="nx-feat-title">Offline Ready</div>
                  <div className="nx-feat-sub">SQLite Local DB</div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT PANEL: OPERATOR LOGIN & AUTHENTICATION CONSOLE
              ══════════════════════════════════════════════════════════════ */}
          <div className="nx-auth-section">
            {/* Top Bar */}
            <div className="nx-top-bar">
              <div className="nx-clock-wrap">
                <Clock size={14} color="#16a34a" />
                <span className="nx-clock-time">{currentTime}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span className="nx-clock-date">{currentDate}</span>
              </div>
              <div className="nx-security-badge">
                <ShieldCheck size={14} />
                <span>Station {currentTerminalId} · Active</span>
              </div>
            </div>

            <div>
              {/* Mode Tabs */}
              <div className="nx-mode-tabs">
                <button
                  type="button"
                  className={`nx-mode-tab ${mode === 'passcode' ? 'active' : ''}`}
                  onClick={() => { setMode('passcode'); setError(null) }}
                >
                  <KeyRound size={15} />
                  <span>Quick PIN</span>
                </button>
                <button
                  type="button"
                  className={`nx-mode-tab ${mode === 'credentials' ? 'active' : ''}`}
                  onClick={() => { setMode('credentials'); setError(null) }}
                >
                  <User size={15} />
                  <span>Password Login</span>
                </button>
              </div>

              {/* Operator Selection */}
              <div>
                <div className="nx-section-title">
                  <span>Active Operator</span>
                  <span style={{ color: '#16a34a', fontSize: 10 }}>Touch to Switch</span>
                </div>
                <div className="nx-operator-grid">
                  {PRESET_OPERATORS.map((op) => {
                    const isSelected = selectedOperator?.id === op.id
                    return (
                      <div
                        key={op.id}
                        onClick={() => handleSelectOperator(op)}
                        className={`nx-op-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div
                          className="nx-op-avatar"
                          style={{ background: op.avatarColor }}
                        >
                          {op.name.charAt(0)}
                        </div>
                        <div className="nx-op-info">
                          <div className="nx-op-name">{op.name}</div>
                          <div className="nx-op-role" style={{ color: op.avatarColor }}>
                            {op.roleTitle}
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="nx-error-box">
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* ── PASSCODE MODE ── */}
              {mode === 'passcode' && (
                <div>
                  <div className="nx-pin-display">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className={`nx-pin-dot ${i < passcode.length ? 'filled' : ''}`}
                      />
                    ))}
                  </div>

                  <div className="nx-pin-status">
                    {isLoading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
                        <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                        Verifying operator PIN...
                      </span>
                    ) : passcode.length === 0 ? (
                      selectedOperator ? (
                        <span>Enter 6-digit PIN for <strong>{selectedOperator.name}</strong> (Hint: 123456)</span>
                      ) : (
                        'Enter 6-digit PIN on keypad or keyboard'
                      )
                    ) : (
                      <span style={{ color: '#16a34a' }}>{passcode.length} / 6 digits entered</span>
                    )}
                  </div>

                  {/* Tactile 3x4 Numpad */}
                  <div className="nx-numpad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        className="nx-numkey"
                        onClick={() => handlePasscodeKey(digit)}
                        disabled={isLoading}
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="nx-numkey key-action"
                      onClick={() => { setPasscode(''); setError(null) }}
                      disabled={isLoading || passcode.length === 0}
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      className="nx-numkey"
                      onClick={() => handlePasscodeKey('0')}
                      disabled={isLoading}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      className="nx-numkey key-action key-delete"
                      onClick={() => setPasscode((p) => p.slice(0, -1))}
                      disabled={isLoading || passcode.length === 0}
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              )}

              {/* ── CREDENTIALS MODE ── */}
              {mode === 'credentials' && (
                <form onSubmit={handleCredentialsLogin} className="nx-cred-form">
                  <div className="nx-field-group">
                    <div className="nx-field-label-row">
                      <span>Operator ID / Email</span>
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
                    <div className={`nx-field-input-box ${emailFocused ? 'focused' : ''} ${fieldErrors.email ? 'error' : ''}`}>
                      <User size={15} color={emailFocused ? '#16a34a' : '#94a3b8'} style={{ marginRight: 10, flexShrink: 0 }} />
                      <input
                        type="text"
                        className="nx-native-input"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                        }}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        placeholder="cashier1@rasacakes.lk"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>
                    {fieldErrors.email && (
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{fieldErrors.email}</span>
                    )}
                  </div>

                  <div className="nx-field-group">
                    <div className="nx-field-label-row">
                      <span>Password</span>
                    </div>
                    <div className={`nx-field-input-box ${passFocused ? 'focused' : ''} ${fieldErrors.password ? 'error' : ''}`}>
                      <Lock size={15} color={password.length > 0 || passFocused ? '#16a34a' : '#94a3b8'} style={{ marginRight: 10, flexShrink: 0 }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="nx-native-input"
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
                      />
                      <button
                        type="button"
                        className="nx-toggle-pw-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{fieldErrors.password}</span>
                    )}
                  </div>

                  <button type="submit" className="nx-submit-btn" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Unlock Workstation</span>
                        <ArrowRight size={15} />
                      </>
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
            </div>

            {/* Bottom Station Diagnostics & Footer */}
            <div>
              <div className="nx-diagnostics-bar">
                <div className="nx-diag-item">
                  <span className="nx-diag-label"><Store size={13} color="#16a34a" /> Branch</span>
                  <span className="nx-diag-val">{currentShop?.name || 'Wasana Cake - Katugastota'}</span>
                </div>
                <div className="nx-diag-item">
                  <span className="nx-diag-label"><Activity size={13} color="#3b82f6" /> Terminal</span>
                  <span className="nx-diag-val">Station {currentTerminalId} · Active</span>
                </div>
                <div className="nx-diag-item">
                  <span className="nx-diag-label"><HardDrive size={13} color="#a855f7" /> Database</span>
                  <span className="nx-diag-val">Offline SQLite</span>
                </div>
                <div className="nx-diag-item">
                  <span className="nx-diag-label"><Wifi size={13} color="#f59e0b" /> Cloud Sync</span>
                  <span className="nx-diag-val" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a' }}>
                    <span className="nx-live-pulse-dot" /> Live Auto-Sync
                  </span>
                </div>
              </div>

              <div className="nx-auth-footer">
                <span>Wasana POS Terminal v1.0.0</span>
                <span className="nx-auth-footer-brand">
                  <ShieldCheck size={12} /> Nexzt POS Encrypted
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
