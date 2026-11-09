import React, { useState, useEffect } from 'react'
import { ArrowDownCircle, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react'
import { Modal } from 'antd'

interface UpdaterStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  newVersion?: string
  percent?: number
  error?: string
}

export const UpdateIndicator: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdaterStatus | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onUpdaterStatus) return

    // Fetch initial status
    if (api.getUpdaterStatus) {
      api.getUpdaterStatus().then((status: UpdaterStatus) => {
        if (status) setUpdateInfo(status)
      }).catch(() => {})
    }

    // Subscribe to live status updates
    const cleanup = api.onUpdaterStatus((status: UpdaterStatus) => {
      setUpdateInfo(status)
      if (status.status === 'downloaded') {
        setIsModalOpen(true)
      }
    })

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  if (!updateInfo) return null

  const handleRestartNow = async () => {
    setIsRestarting(true)
    const api = (window as any).electronAPI
    if (api?.installUpdate) {
      await api.installUpdate()
    }
  }

  // 1. Downloading in progress
  if (updateInfo.status === 'downloading') {
    return (
      <div
        title={`Downloading update: ${updateInfo.percent || 0}%`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '99px',
          padding: '5px 12px',
          fontSize: '11.5px',
          fontWeight: 700,
          color: '#1d4ed8',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.15)'
        }}
        onClick={() => setIsModalOpen(true)}
      >
        <ArrowDownCircle size={14} className="animate-bounce" />
        <span>Updating: {updateInfo.percent || 0}%</span>
      </div>
    )
  }

  // 2. Download complete - Ready to install
  if (updateInfo.status === 'downloaded') {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            border: 'none',
            borderRadius: '99px',
            padding: '5px 14px',
            fontSize: '11.5px',
            fontWeight: 800,
            color: '#ffffff',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)',
            animation: 'pulse 2s infinite'
          }}
        >
          <Sparkles size={13} />
          <span>Update v{updateInfo.newVersion || ''} Ready</span>
        </button>

        <Modal
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          centered
          width={440}
        >
          <div style={{ padding: '16px 8px 8px', textAlign: 'center' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '2px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#16a34a'
            }}>
              <CheckCircle2 size={30} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              New Update Ready to Install!
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 18 }}>
              Nexzt POS version <strong>v{updateInfo.newVersion}</strong> has been downloaded. Restart the app now to apply the latest improvements and features.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: '12px',
              color: '#166534',
              fontWeight: 600,
              marginBottom: 20,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>All shop orders, bills & database are safely preserved.</span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Later
              </button>
              <button
                disabled={isRestarting}
                onClick={handleRestartNow}
                style={{
                  flex: 2,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: isRestarting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <RefreshCw size={14} className={isRestarting ? 'animate-spin' : ''} />
                {isRestarting ? 'Restarting...' : 'Restart & Update Now'}
              </button>
            </div>
          </div>
        </Modal>
      </>
    )
  }

  // 3. Checking for updates
  if (updateInfo.status === 'checking') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '99px',
          padding: '5px 12px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b'
        }}
      >
        <RefreshCw size={12} className="animate-spin" />
        <span>Checking updates...</span>
      </div>
    )
  }

  return null
}
