import React, { useState, useEffect } from 'react'
import { Settings, Printer, Store, Monitor, Wifi, RefreshCw, Database, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { message } from 'antd'
import { useAppStore } from '../../store/appStore'
import { backupApi } from '../../api/backupApi'

interface SettingCardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  iconBorder: string
  title: string
  subtitle?: string
  children: React.ReactNode
}

const SettingCard: React.FC<SettingCardProps> = ({ icon, iconBg, iconColor, iconBorder, title, subtitle, children }) => (
  <div style={{
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: '22px 24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.03)'
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  </div>
)

const SettingRow: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
      {label}
    </label>
    {children || (
      <div style={{
        padding: '10px 14px',
        background: '#f8fafc',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        fontSize: 13,
        fontWeight: 600,
        color: '#1e293b'
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
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [systemPrinters, setSystemPrinters] = useState<any[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>(localStorage.getItem('selected_printer') || '')

  useEffect(() => {
    const loadPrinters = async () => {
      if (window.electronAPI?.getPrinters) {
        try {
          const list = await window.electronAPI.getPrinters()
          if (Array.isArray(list) && list.length > 0) {
            setSystemPrinters(list)
            const saved = localStorage.getItem('selected_printer')
            if (saved && list.some((p: any) => p.name === saved)) {
              setSelectedPrinter(saved)
            } else {
              const thermal = list.find((p: any) => /xp|pos|thermal|receipt|bixolon|epson/i.test(p.name))
              const def = list.find((p: any) => p.isDefault)
              const chosen = thermal?.name || def?.name || list[0]?.name || ''
              if (chosen) {
                setSelectedPrinter(chosen)
                localStorage.setItem('selected_printer', chosen)
              }
            }
          }
        } catch (err) {
          console.error('Failed to load printers:', err)
        }
      }
    }
    loadPrinters()
  }, [])

  const handleBackupNow = async () => {
    setIsBackingUp(true)
    try {
      const res = await backupApi.runBackup()
      if (res && res.success) {
        message.success(`SQLite database backup created! Location: ${res.filePath}`)
      } else {
        message.warning(`Backup notice: ${res?.error || 'Completed'}`)
      }
    } catch (err: any) {
      console.error('Backup error:', err)
      message.error(err.message || 'Database backup failed')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleTestPrint = async () => {
    setIsTestingPrint(true)
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.testPrint(selectedPrinter || undefined)
        if (res && res.success) {
          message.success(`Test receipt sent to: ${res.printerUsed || selectedPrinter || 'Printer'}!`)
        } else {
          message.warning(`Print notice: ${res?.message || 'Check printer connection'}`)
        }
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
      {/* Unified Header */}
      <div className="page-header" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 14, flexShrink: 0 }}>
        <div style={{ minWidth: 260, flex: '1 1 auto' }}>
          <div className="page-title" style={{ fontSize: 20 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}>
              <Settings size={20} />
            </div>
            <span>System & Hardware Settings</span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 99,
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              marginLeft: 4
            }}>
              v1.0.0 Active
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            Configure branch identity, thermal printer, database backups and cloud sync · <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{currentShop?.name || 'Main Branch'}</span>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, flexShrink: 0, paddingBottom: 24 }}>
        {/* Branch Info */}
        <SettingCard
          icon={<Store size={19} />}
          iconBg="linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
          iconColor="#16a34a"
          iconBorder="#bbf7d0"
          title="Active Branch Configuration"
          subtitle="Read-only branch identity settings"
        >
          <SettingRow label="Branch Name" value={currentShop?.name} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SettingRow label="Branch Code">
              <div style={{
                padding: '9px 12px',
                background: '#f0fdf4',
                borderRadius: 10,
                border: '1.5px solid #bbf7d0',
                fontSize: 13.5,
                fontWeight: 800,
                color: '#15803d',
                fontFamily: 'monospace',
                letterSpacing: '0.05em'
              }}>
                {currentShop?.branch_code || 'MAIN'}
              </div>
            </SettingRow>
            <SettingRow label="Terminal ID">
              <select
                value={currentTerminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="T1">T1 — Counter 1</option>
                <option value="T2">T2 — Counter 2</option>
                <option value="T3">T3 — Counter 3</option>
              </select>
            </SettingRow>
          </div>
          <SettingRow label="Address">
            <div style={{
              fontSize: 12.5,
              color: '#475569',
              fontWeight: 500,
              lineHeight: 1.6,
              background: '#f8fafc',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #e2e8f0'
            }}>
              {currentShop?.address || 'Branch Address'}<br />
              <span style={{ fontWeight: 600, color: '#1e293b' }}>Tel: {currentShop?.phone || '—'}</span>
            </div>
          </SettingRow>
        </SettingCard>

        {/* Database & Backup Safety */}
        <SettingCard
          icon={<Database size={19} />}
          iconBg="linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
          iconColor="#059669"
          iconBorder="#a7f3d0"
          title="SQLite Database & Automated Backups"
          subtitle="Local AppData database storage & immediate safety snapshots"
        >
          <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
            Local SQLite database engine located in AppData with automatic daily 11:30 PM snapshots and instant manual backup triggers.
          </p>
          <div style={{
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16
          }}>
            <ShieldCheck size={20} color="#16a34a" />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Backup Engine</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15803d' }}>Active (Auto Daily + On Demand)</div>
            </div>
            <span style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 99,
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0'
            }}>
              Operational
            </span>
          </div>
          <button
            disabled={isBackingUp}
            onClick={handleBackupNow}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: isBackingUp ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isBackingUp) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(22, 163, 74, 0.35)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.25)'
            }}
          >
            <Database size={16} />
            {isBackingUp ? 'Creating SQLite Backup...' : 'Create Database Backup Now'}
          </button>
        </SettingCard>

        {/* Thermal Printer */}
        <SettingCard
          icon={<Printer size={19} />}
          iconBg="linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
          iconColor="#15803d"
          iconBorder="#bbf7d0"
          title="Thermal Bill Printer (ESC/POS)"
          subtitle="Direct high-speed receipt printing"
        >
          <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>
            Connected USB thermal receipt printers (80mm / 58mm). Standard ESC/POS and Windows spool supported.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Detected Windows Receipt Printer
            </label>
            {systemPrinters.length > 0 ? (
              <select
                value={selectedPrinter}
                onChange={(e) => {
                  setSelectedPrinter(e.target.value)
                  localStorage.setItem('selected_printer', e.target.value)
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                {systemPrinters.map((p: any) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? '⭐ (Default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: 12.5,
                color: '#64748b'
              }}>
                Searching for connected printers...
              </div>
            )}
          </div>

          <div style={{
            background: selectedPrinter ? '#f0fdf4' : '#f8fafc',
            borderRadius: 10,
            border: `1px solid ${selectedPrinter ? '#bbf7d0' : '#e2e8f0'}`,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16
          }}>
            <Printer size={18} color={selectedPrinter ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: selectedPrinter ? '#15803d' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Hardware Status
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: selectedPrinter ? '#166534' : '#475569' }}>
                {selectedPrinter ? `Ready: ${selectedPrinter}` : 'No printer selected'}
              </div>
            </div>
            {selectedPrinter && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 99,
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <CheckCircle2 size={12} /> Detected
              </span>
            )}
          </div>

          <button
            disabled={isTestingPrint || !selectedPrinter}
            onClick={handleTestPrint}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 10,
              background: selectedPrinter ? 'linear-gradient(135deg, #15803d 0%, #166534 100%)' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: (isTestingPrint || !selectedPrinter) ? 'not-allowed' : 'pointer',
              boxShadow: selectedPrinter ? '0 4px 12px rgba(21, 128, 61, 0.25)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isTestingPrint && selectedPrinter) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.35)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = selectedPrinter ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none'
            }}
          >
            <Printer size={16} />
            {isTestingPrint ? 'Sending Command to Printer...' : `Print Test Receipt (${selectedPrinter || 'Select Printer'})`}
          </button>
        </SettingCard>

        {/* Cloud Sync */}
        <SettingCard
          icon={<Wifi size={19} />}
          iconBg="linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)"
          iconColor="#0284c7"
          iconBorder="#bae6fd"
          title="Cloud Sync & Supabase"
          subtitle="Offline-first sync with cloud backup"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SettingRow label="Connection Status">
              <div style={{
                padding: '10px 14px',
                background: isOnline ? '#f0fdf4' : '#fffbeb',
                borderRadius: 10,
                border: `1px solid ${isOnline ? '#bbf7d0' : '#fef3c7'}`,
                fontSize: 12.5,
                fontWeight: 700,
                color: isOnline ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isOnline ? '#16a34a' : '#f59e0b',
                  display: 'inline-block',
                  boxShadow: isOnline ? '0 0 6px rgba(22, 163, 74, 0.6)' : 'none'
                }} />
                {isOnline ? 'Online — Cloud Sync Active' : 'Offline — Data saved locally'}
              </div>
            </SettingRow>
            <SettingRow label="API Endpoint" value={apiUrl} />
            <button
              disabled={isSyncing || !isOnline}
              onClick={handleManualSync}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 10,
                background: isOnline ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: (isSyncing || !isOnline) ? 'not-allowed' : 'pointer',
                boxShadow: isOnline ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!isSyncing && isOnline) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.35)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = isOnline ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none'
              }}
            >
              <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              {isSyncing ? 'Syncing...' : 'Manual Sync Now'}
            </button>
          </div>
        </SettingCard>

        {/* App Info */}
        <SettingCard
          icon={<Monitor size={19} />}
          iconBg="linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)"
          iconColor="#475569"
          iconBorder="#e2e8f0"
          title="System Information"
          subtitle="POS software version and build info"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'App Name', val: 'Wasana Cake POS' },
              { label: 'Version', val: 'v1.0.0 (Production Build)' },
              { label: 'Backend API', val: 'Cloud Sync & Local Engine' },
              { label: 'Database', val: 'SQLite Local Storage' },
              { label: 'Framework', val: 'Electron + React + Vite' },
              { label: 'Environment', val: 'Windows 7/8/10/11 · Offline First' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '9px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12
              }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{item.label}</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{item.val}</span>
              </div>
            ))}
          </div>
        </SettingCard>
      </div>
    </div>
  )
}

export default SettingsPage
