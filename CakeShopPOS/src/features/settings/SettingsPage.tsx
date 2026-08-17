import React, { useState } from 'react'
import { Settings, Printer, Store, Monitor, Wifi, Check, ChevronRight, RefreshCw } from 'lucide-react'
import { message } from 'antd'
import { useAppStore } from '../../store/appStore'

interface SettingCardProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}

const SettingCard: React.FC<SettingCardProps> = ({ icon, title, subtitle, children }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: 20
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: 'var(--primary-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
)

const SettingRow: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
      {label}
    </label>
    {children || (
      <div style={{
        padding: '9px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)'
      }}>
        {value || '—'}
      </div>
    )}
  </div>
)

export const SettingsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setTerminalId = useAppStore((state) => state.setTerminalId)
  const isOnline = useAppStore((state) => state.isOnline)
  const apiUrl = useAppStore((state) => state.apiUrl)
  const [isTestingPrint, setIsTestingPrint] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleTestPrint = async () => {
    setIsTestingPrint(true)
    try {
      if (window.electronAPI) {
        await window.electronAPI.testPrint()
        message.success('Test receipt sent to thermal printer! ✅')
      } else {
        await new Promise(r => setTimeout(r, 1200))
        message.info('Thermal test print simulated (Browser mode)')
      }
    } catch (err: any) {
      message.error(err.message || 'Printer test failed')
    } finally {
      setIsTestingPrint(false)
    }
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.triggerSync()
        if (res.success) message.success(`Sync complete! ${res.count} records uploaded.`)
      } else {
        await new Promise(r => setTimeout(r, 1500))
        message.success('Sync simulation complete!')
      }
    } catch (err: any) {
      message.error(err.message || 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="page-container" style={{ overflowY: 'auto' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-title">
            <div className="page-title-icon"><Settings size={18} /></div>
            System & Hardware Settings
          </div>
          <div className="page-subtitle">
            Configure branch identity, terminal, thermal printer and cloud sync
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flexShrink: 0 }}>
        {/* Branch Info */}
        <SettingCard icon={<Store size={18} />} title="Active Branch Configuration" subtitle="Read-only branch identity settings">
          <SettingRow label="Branch Name" value={currentShop?.name} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SettingRow label="Branch Code">
              <div style={{
                padding: '9px 12px', background: 'var(--primary-bg)', borderRadius: 'var(--radius)',
                border: '1.5px solid var(--primary-muted)', fontSize: 14, fontWeight: 800,
                color: 'var(--primary-dark)', fontFamily: 'monospace', letterSpacing: '0.05em'
              }}>
                {currentShop?.branch_code}
              </div>
            </SettingRow>
            <SettingRow label="Terminal ID">
              <select
                value={currentTerminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius)',
                  border: '1.5px solid var(--border)', background: 'var(--surface)',
                  fontSize: 13, fontWeight: 700, color: 'var(--info)', fontFamily: 'Inter, monospace',
                  outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="T1">T1 — Counter 1</option>
                <option value="T2">T2 — Counter 2</option>
                <option value="T3">T3 — Counter 3</option>
              </select>
            </SettingRow>
          </div>
          <SettingRow label="Address">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6 }}>
              {currentShop?.address}<br />
              📞 {currentShop?.phone}
            </div>
          </SettingRow>
        </SettingCard>

        {/* Thermal Printer */}
        <SettingCard icon={<Printer size={18} />} title="Thermal Bill Printer (ESC/POS)" subtitle="Direct high-speed USB receipt printing">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
            Direct USB thermal printing with auto-cutter and cash drawer kick commands. Supports standard 80mm ESC/POS printers.
          </p>
          <div style={{
            background: 'var(--surface-2)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12
          }}>
            <span style={{ fontSize: 18 }}>🖨️</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)' }}>Ready (USB Auto-detect)</div>
            </div>
            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Connected</span>
          </div>
          <button
            disabled={isTestingPrint}
            onClick={handleTestPrint}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            <Printer size={16} />
            {isTestingPrint ? 'Sending Command...' : 'Execute Test Print'}
          </button>
        </SettingCard>

        {/* Cloud Sync */}
        <SettingCard icon={<Wifi size={18} />} title="Cloud Sync & Supabase" subtitle="Offline-first sync with cloud backup">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SettingRow label="Connection Status">
              <div style={{
                padding: '9px 12px', background: isOnline ? 'var(--primary-bg)' : '#fef3c7',
                borderRadius: 'var(--radius)', border: `1px solid ${isOnline ? 'var(--primary-muted)' : '#fde68a'}`,
                fontSize: 12, fontWeight: 700,
                color: isOnline ? 'var(--primary-dark)' : '#92400e',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? 'var(--primary)' : '#f59e0b', display: 'inline-block' }} />
                {isOnline ? 'Online — Cloud Sync Active' : 'Offline — Data saved locally'}
              </div>
            </SettingRow>
            <SettingRow label="API Endpoint" value={apiUrl} />
            <button
              disabled={isSyncing || !isOnline}
              onClick={handleManualSync}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              {isSyncing ? 'Syncing...' : 'Manual Sync Now'}
            </button>
          </div>
        </SettingCard>

        {/* App Info */}
        <SettingCard icon={<Monitor size={18} />} title="System Information" subtitle="POS software version and license">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'App Name', val: 'Rasa Cake House POS' },
              { label: 'Version', val: 'v1.0.0 (Phase 01 Build)' },
              { label: 'Database', val: 'SQLite WASM (sql.js)' },
              { label: 'Framework', val: 'Electron + React + Vite' },
              { label: 'Built For', val: 'Windows 10/11 · Offline First' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
                fontSize: 12
              }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.val}</span>
              </div>
            ))}
          </div>
        </SettingCard>
      </div>
    </div>
  )
}
