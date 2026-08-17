import React, { useState, useEffect } from 'react'
import {
  ShoppingCart, Cake, Package, BarChart3,
  Receipt, Settings, LogOut, Clock, Store, Monitor
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { SyncIndicator } from './SyncIndicator'
import dayjs from 'dayjs'

interface LayoutProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const currentShop = useAppStore((s) => s.currentShop)
  const currentTerminalId = useAppStore((s) => s.currentTerminalId)
  const currentUser = useAppStore((s) => s.currentUser)
  const logout = useAppStore((s) => s.logout)
  const setShop = useAppStore((s) => s.setShop)

  const [currentTime, setCurrentTime] = useState(dayjs().format('hh:mm:ss A'))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(dayjs().format('hh:mm:ss A')), 1000)
    return () => clearInterval(t)
  }, [])

  const navItems = [
    { id: 'pos', label: 'Counter POS', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Cake },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const toggleBranch = () => {
    if (currentShop?.branch_code === 'B1') {
      setShop({ id: 'b0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'Rasa Cake House - Colombo Branch', branch_code: 'B2', address: 'No. 120, Galle Road, Colombo 03', phone: '+94 11 258 9101', currency: 'LKR', is_active: true })
    } else {
      setShop({ id: 'b0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'Rasa Cake House - Kandy Branch', branch_code: 'B1', address: 'No. 45, Peradeniya Road, Kandy', phone: '+94 81 223 4567', currency: 'LKR', is_active: true })
    }
  }

  const initials = currentUser?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || 'CX'

  return (
    <div className="pos-layout">
      {/* ───── Sidebar ───── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🎂</div>
          <div>
            <div className="sidebar-brand-name">Rasa Cake House</div>
            <div className="sidebar-brand-sub">POS Terminal v1.0</div>
          </div>
        </div>

        {/* Nav */}
        <div className="nav-section-label">Main Menu</div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}>
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          )
        })}

        <div className="sidebar-spacer" />

        {/* User Session */}
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{currentUser?.name || 'Cashier'}</div>
            <div className="user-role">{currentUser?.role || 'Cashier'}</div>
          </div>
          <button className="logout-btn" title="Lock Counter" onClick={logout}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ───── Main Area ───── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="branch-pill" onClick={toggleBranch} title="Click to switch branch">
              <Store size={13} />
              <span>{currentShop?.name || 'Kandy Branch'}</span>
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{currentShop?.branch_code || 'B1'}</span>
            </button>
            <div className="terminal-pill">
              <Monitor size={13} style={{ color: 'var(--info)' }} />
              <span>Terminal {currentTerminalId}</span>
            </div>
          </div>

          <div className="topbar-right">
            <SyncIndicator />
            <div className="clock-pill">
              <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
              {currentTime}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflow: 'hidden' }}>{children}</main>
      </div>
    </div>
  )
}
