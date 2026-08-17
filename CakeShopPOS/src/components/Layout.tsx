import React, { useState, useEffect } from 'react'
import {
  ShoppingCart,
  Cake,
  Package,
  BarChart3,
  Receipt,
  Settings,
  LogOut,
  Clock,
  Store,
  Monitor
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
  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const currentUser = useAppStore((state) => state.currentUser)
  const logout = useAppStore((state) => state.logout)
  const setShop = useAppStore((state) => state.setShop)

  const [currentTime, setCurrentTime] = useState(dayjs().format('hh:mm:ss A'))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('hh:mm:ss A'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const navItems = [
    { id: 'pos', label: 'Counter POS', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Cake },
    { id: 'inventory', label: 'Stock / Inventory', icon: Package },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const toggleBranchDemo = () => {
    if (currentShop?.branch_code === 'B1') {
      setShop({
        id: 'b0000000-0000-0000-0000-000000000002',
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Rasa Cake House - Colombo Branch',
        branch_code: 'B2',
        address: 'No. 120, Galle Road, Colombo 03',
        phone: '+94 11 258 9101',
        currency: 'LKR',
        is_active: true
      })
    } else {
      setShop({
        id: 'b0000000-0000-0000-0000-000000000001',
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Rasa Cake House - Kandy Branch',
        branch_code: 'B1',
        address: 'No. 45, Peradeniya Road, Kandy',
        phone: '+94 81 223 4567',
        currency: 'LKR',
        is_active: true
      })
    }
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      {/* 🧭 Left Sleek Sidebar */}
      <aside className="flex flex-col justify-between border-r border-slate-800/80 bg-slate-900/60 p-3 w-64 select-none">
        <div>
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3 px-3 py-4 mb-4 rounded-2xl bg-gradient-to-r from-brand-600/20 to-pink-500/10 border border-brand-500/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg glow-pink">
              <Cake size={22} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Rasa Cake House</h1>
              <p className="text-xs font-semibold text-brand-400">POS Terminal v1.0</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md glow-pink'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Bottom Cashier Session & Quick Logout */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between rounded-xl bg-slate-800/40 p-3">
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-slate-400">Cashier on Duty</p>
              <p className="text-sm font-bold text-slate-100 truncate">{currentUser?.name}</p>
            </div>
            <button
              onClick={logout}
              title="Lock Counter (Switch Cashier)"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* 🖥️ Main Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-6 backdrop-blur-md">
          {/* Active Branch & Terminal Pills */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleBranchDemo}
              title="Click to toggle Branch demo"
              className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-700 hover:border-brand-500 transition-colors"
            >
              <Store size={14} className="text-brand-400" />
              <span>{currentShop?.name}</span>
              <span className="rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[10px] text-brand-300">
                {currentShop?.branch_code}
              </span>
            </button>

            <div className="flex items-center gap-1.5 rounded-xl bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700/60">
              <Monitor size={14} className="text-cyan-400" />
              <span>Terminal: {currentTerminalId}</span>
            </div>
          </div>

          {/* Sync Status & Realtime Clock */}
          <div className="flex items-center gap-4">
            <SyncIndicator />
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-700/40">
              <Clock size={13} className="text-slate-400" />
              <span>{currentTime}</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
