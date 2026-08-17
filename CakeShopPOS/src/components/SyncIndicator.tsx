import React from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSyncStore } from '../store/syncStore'

export const SyncIndicator: React.FC = () => {
  const isOnline = useOnlineStatus()
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const isSyncing = useSyncStore((s) => s.isSyncing)

  if (!isOnline) {
    return (
      <div className="sync-badge offline">
        <CloudOff size={12} />
        <span>Offline {pendingCount > 0 ? `(${pendingCount} pending)` : ''}</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="sync-badge" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
        <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Syncing...</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="sync-badge" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
        <span className="sync-dot" style={{ background: '#f59e0b' }} />
        <span>{pendingCount} pending</span>
      </div>
    )
  }

  return (
    <div className="sync-badge online">
      <span className="sync-dot" />
      <Cloud size={11} />
      <span>Synced</span>
    </div>
  )
}
