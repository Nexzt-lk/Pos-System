import React, { useState, useEffect } from 'react'
import { ConfigProvider, theme } from 'antd'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { POSPage } from './features/pos/POSPage'
import { ProductsPage } from './features/products/ProductsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { useAppStore } from './store/appStore'

import { ShieldAlert } from 'lucide-react'

export const App: React.FC = () => {
  const currentUser = useAppStore((s) => s.currentUser)
  const [activeTab, setActiveTab] = useState<string>('pos')

  // Continuous background cloud auto-sync timer
  useEffect(() => {
    const runAutoSync = () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.triggerSync) {
        (window as any).electronAPI.triggerSync().catch(() => {})
      }
    }

    // Run on startup
    runAutoSync()
    const timer = setInterval(runAutoSync, 10000)
    return () => clearInterval(timer)
  }, [])

  if (!currentUser) return <LoginPage />

  const userRole = currentUser.role || 'cashier'

  // Role Permissions Matrix
  const rolePermissions: Record<string, string[]> = {
    owner: ['pos', 'products', 'inventory', 'reports', 'expenses', 'settings'],
    admin: ['pos', 'products', 'inventory', 'reports', 'expenses', 'settings'],
    manager: ['pos', 'products', 'inventory', 'reports', 'expenses'],
    cashier: ['pos', 'inventory']
  }

  const allowedTabs = rolePermissions[userRole] || ['pos']

  const renderView = () => {
    // If user role is not authorized for activeTab, fallback to POS or show Access Denied
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
