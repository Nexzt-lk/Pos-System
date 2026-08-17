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
  const currentUser = useAppStore((state) => state.currentUser)
  const [activeTab, setActiveTab] = useState<string>('pos')

  // If cashier is not logged in, show lock screen PIN pad
  if (!currentUser) {
    return <PINLoginPage />
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'pos':
        return <POSPage />
      case 'products':
        return <ProductsPage />
      case 'inventory':
        return <InventoryPage />
      case 'reports':
        return <ReportsPage />
      case 'expenses':
        return <ExpensesPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <POSPage />
    }
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#ec4899', // Brand Pink
          colorBgBase: '#020617',
          colorTextBase: '#f8fafc',
          borderRadius: 12
        }
      }}
    >
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderActiveView()}
      </Layout>
    </ConfigProvider>
  )
}
export default App
