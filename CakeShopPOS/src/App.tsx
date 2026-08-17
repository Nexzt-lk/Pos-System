import React, { useState } from 'react'
import { ConfigProvider, theme } from 'antd'
import { Layout } from './components/Layout'
import { PINLoginPage } from './features/auth/PINLoginPage'
import { POSPage } from './features/pos/POSPage'
import { ProductsPage } from './features/products/ProductsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { useAppStore } from './store/appStore'

export const App: React.FC = () => {
  const currentUser = useAppStore((s) => s.currentUser)
  const [activeTab, setActiveTab] = useState<string>('pos')

  if (!currentUser) return <PINLoginPage />

  const renderView = () => {
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
