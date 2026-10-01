import React, { useState, useEffect } from 'react'
import { ConfigProvider, theme } from 'antd'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { POSPage } from './features/pos/POSPage'
import { ProductsPage } from './features/products/ProductsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { OrdersPage } from './features/orders/OrdersPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { OpeningFloatModal } from './components/OpeningFloatModal'
import { useAppStore } from './store/appStore'

import { ShieldAlert } from 'lucide-react'

export const App: React.FC = () => {
  const currentUser = useAppStore((s) => s.currentUser)
  const currentTerminalId = useAppStore((s) => s.currentTerminalId)
  const [activeTab, setActiveTab] = useState<string>('pos')
  const [floatRequired, setFloatRequired] = useState(false)
  const [floatChecked, setFloatChecked] = useState(false)

  // Continuous background cloud auto-sync timer
  useEffect(() => {
    const runAutoSync = () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.triggerSync) {
        (window as any).electronAPI.triggerSync().catch(() => {})
      }
    }
    runAutoSync()
    const timer = setInterval(runAutoSync, 10000)
    return () => clearInterval(timer)
  }, [])

  // Check if today's opening float has been entered (runs on login)
  useEffect(() => {
    if (!currentUser) {
      setFloatChecked(false)
      setFloatRequired(false)
      return
    }

    const checkFloat = async () => {
      try {
        const api = (window as any).electronAPI
        if (!api?.getTodayCashSession) {
          // Not in Electron (web/dev mode) — skip check
          setFloatChecked(true)
          setFloatRequired(false)
          return
        }
        const terminalId = currentTerminalId || 'T1'
        const session = await api.getTodayCashSession(terminalId)
        setFloatRequired(!session)
        setFloatChecked(true)
      } catch {
        // If check fails, don't block access
        setFloatChecked(true)
        setFloatRequired(false)
      }
    }

    checkFloat()
  }, [currentUser?.id])

  const handleFloatConfirm = async (amount: number, notes: string) => {
    const api = (window as any).electronAPI
    const terminalId = currentTerminalId || 'T1'
    await api.createCashSession({
      openingFloat: amount,
      cashierId: currentUser?.id,
      cashierName: currentUser?.name,
      terminalId,
      notes: notes || undefined
    })
    setFloatRequired(false)
  }

  if (!currentUser) return <LoginPage />

  // Show opening float modal — mandatory, no skip
  if (floatChecked && floatRequired) {
    return (
      <OpeningFloatModal
        cashierName={currentUser.name || 'Cashier'}
        terminalId={currentTerminalId || 'T1'}
        onConfirm={handleFloatConfirm}
      />
    )
  }

  const userRole = currentUser.role || 'cashier'

  // Role Permissions Matrix
  const rolePermissions: Record<string, string[]> = {
    owner: ['pos', 'orders', 'products', 'inventory', 'reports', 'expenses', 'settings'],
    admin: ['pos', 'orders', 'products', 'inventory', 'reports', 'expenses', 'settings'],
    manager: ['pos', 'orders', 'products', 'inventory', 'reports', 'expenses'],
    cashier: ['pos', 'orders', 'products', 'inventory', 'expenses']
  }

  const allowedTabs = rolePermissions[userRole] || ['pos']

  const renderView = () => {
    if (!allowedTabs.includes(activeTab)) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 40,
          textAlign: 'center'
        }}>
          <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, marginBottom: 20, lineHeight: 1.6 }}>
            Your account role (<strong>{currentUser.role?.toUpperCase()}</strong>) does not have permission to access this module. Please contact the store owner or manager.
          </p>
          <button
            className="btn-primary"
            onClick={() => setActiveTab('pos')}
            style={{ padding: '10px 22px' }}
          >
            Return to Counter POS
          </button>
        </div>
      )
    }

    switch (activeTab) {
      case 'pos': return <POSPage />
      case 'orders': return <OrdersPage />
      case 'products': return <ProductsPage />
      case 'inventory': return <InventoryPage />
      case 'reports': return <ReportsPage />
      case 'expenses': return <ExpensesPage />
      case 'settings': return <SettingsPage />
      default: return <POSPage />
    }
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#16a34a',
          colorBgBase: '#f8fafc',
          colorTextBase: '#0f172a',
          borderRadius: 10,
          fontFamily: "'Poppins', 'Noto Sans Sinhala', system-ui, sans-serif"
        }
      }}
    >
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderView()}
      </Layout>
    </ConfigProvider>
  )
}

export default App
