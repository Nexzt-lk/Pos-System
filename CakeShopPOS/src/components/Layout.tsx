import React, { useState, useEffect } from 'react'
import {
  ShoppingCart, Cake, Package, BarChart3,
  Settings, LogOut, Clock, Store, Monitor
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useStockAlertStore } from '../store/stockAlertStore'
import { SyncIndicator } from './SyncIndicator'
import { StockNotificationBell } from './StockNotificationBell'
import { LowStockAlertModal } from './LowStockAlertModal'
import { shopsApi } from '../api/shopsApi'
import dayjs from 'dayjs'

import nexztLogo from '../assets/nexzt-logo.png'
import nexztIcon from '../assets/nexzt-icon.png'

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
  const fetchStockAlerts = useStockAlertStore((s) => s.fetchStockAlerts)

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [currentTime, setCurrentTime] = useState(dayjs().format('hh:mm:ss A'))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(dayjs().format('hh:mm:ss A')), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-fetch latest shop info from DB on mount
  useEffect(() => {
    shopsApi.getCurrent().then((shop) => {
      if (shop && shop.id) {
        setShop({
          id: shop.id,
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          name: shop.name || 'Wasana Cake - Katugastota',
          branch_code: shop.branchCode || 'B1',
          address: shop.address || 'Horana Wasana Bakers Galagedara Road Katugastota',
          phone: shop.phone || '071-1172201',
          currency: shop.currency || 'LKR',
          is_active: true
        })
      }
    }).catch(() => {})
  }, [setShop])

  // Auto-fetch stock alerts on login / mount and poll every 30 seconds
  useEffect(() => {
    if (!currentUser || !currentShop) return

    // Initial check on login: automatically prompts the Low Stock Modal if items are low
    fetchStockAlerts(currentShop.id, true)

    const timer = setInterval(() => {
      fetchStockAlerts(currentShop.id, false)
    }, 30000)

    const handleOrderCompleted = () => {
      fetchStockAlerts(currentShop.id, false)
    }
    window.addEventListener('pos:order-completed', handleOrderCompleted)

    return () => {
      clearInterval(timer)
      window.removeEventListener('pos:order-completed', handleOrderCompleted)
    }
  }, [currentUser?.id, currentShop?.id])

  const allNavItems = [
    { id: 'pos', label: 'Counter POS', icon: ShoppingCart, roles: ['owner', 'admin', 'manager', 'cashier'] },
    { id: 'products', label: 'Products', icon: Cake, roles: ['owner', 'admin', 'manager', 'cashier'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['owner', 'admin', 'manager', 'cashier'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'admin', 'manager'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] },
  ]

  const userRole = currentUser?.role || 'cashier'
  const navItems = allNavItems.filter((item) => item.roles.includes(userRole))

  const toggleBranch = () => {
    if (currentShop?.branch_code === 'B1') {
      setShop({ id: 'b0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'Rasa Cake House - Colombo Branch', branch_code: 'B2', address: 'No. 120, Galle Road, Colombo 03', phone: '+94 11 258 9101', currency: 'LKR', is_active: true })
    } else {
      setShop({ id: 'b0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'Wasana Cake - Katugastota', branch_code: 'B1', address: 'Horana Wasana Bakers Galagedara Road Katugastota', phone: '071-1172201', currency: 'LKR', is_active: true })
    }
  }

  const roleLabels: Record<string, { label: string; bg: string }> = {
    owner: { label: 'Owner', bg: '#16a34a' },
    admin: { label: 'Admin', bg: '#16a34a' },
    manager: { label: 'Manager', bg: '#0f172a' },
    cashier: { label: 'Cashier', bg: '#475569' }
  }

  const roleInfo = roleLabels[userRole] || { label: 'Cashier', bg: '#475569' }
  const initials = currentUser?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || 'CX'

  return (
    <div className="pos-layout">
      {/* ───── Sidebar ───── */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Brand with Nexzt Logo (Click to Toggle Expand/Collapse) */}
        <div
          className="sidebar-brand"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? 'Click to expand sidebar' : 'Click to collapse sidebar'}
          style={{
            padding: isSidebarCollapsed ? '10px 4px 14px' : '14px 10px 16px',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid var(--border-light)',
            marginBottom: 6,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'opacity 0.15s ease'
          }}
        >
          {!isSidebarCollapsed ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              overflow: 'hidden'
            }}>
              <img
                src={nexztLogo}
                alt="Nexzt POS"
                style={{
                  height: 36,
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          ) : (
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#ffffff',
              border: '1.5px solid var(--border)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 2,
              transition: 'transform 0.18s ease'
            }}>
              <img
                src={nexztIcon}
                alt="Nexzt"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          )}
        </div>

        {/* Nav */}
        {!isSidebarCollapsed && <div className="nav-section-label">Main Menu</div>}
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          )
        })}

        <div className="sidebar-spacer" />

        {/* User Session */}
        <div className="sidebar-user">
          <div className="user-avatar" style={{ backgroundColor: roleInfo.bg }}>{initials}</div>
          {!isSidebarCollapsed && (
            <div className="user-info">
              <div className="user-name">{currentUser?.name || 'Cashier'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'white',
                  background: roleInfo.bg,
                  padding: '1px 6px',
                  borderRadius: 99
                }}>
                  {roleInfo.label}
                </span>
              </div>
            </div>
          )}
          <button className="logout-btn" title="Lock Counter / Logout" onClick={logout}>
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
            <StockNotificationBell onNavigateToInventory={() => setActiveTab('inventory')} />
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

      {/* ── Login / Global Low Stock Alert Modal ── */}
      <LowStockAlertModal onNavigateToInventory={() => setActiveTab('inventory')} />
    </div>
  )
}

