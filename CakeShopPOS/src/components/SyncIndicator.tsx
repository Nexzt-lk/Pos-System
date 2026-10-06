import React, { useEffect } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { message } from 'antd'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSyncStore } from '../store/syncStore'

export const SyncIndicator: React.FC = () => {
  const isOnline = useOnlineStatus()
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const isSyncing = useSyncStore((s) => s.isSyncing)
  const setPendingCount = useSyncStore((s) => s.setPendingCount)
  const setIsSyncing = useSyncStore((s) => s.setIsSyncing)
  const setLastSyncedAt = useSyncStore((s) => s.setLastSyncedAt)

  // Poll pending count periodically
  useEffect(() => {
    const checkCount = async () => {
      try {
        if (window.electronAPI) {
          const count = await window.electronAPI.getPendingSyncCount()
          setPendingCount(count || 0)
        }
      } catch (e) {
        // Silent fail
      }
    }

    checkCount()
    const interval = setInterval(checkCount, 5000)
    return () => clearInterval(interval)
  }, [setPendingCount])

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return
    setIsSyncing(true)
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.triggerSync()
        if (res.success) {
          setLastSyncedAt(new Date())
          setPendingCount(0)
          message.success(res.count ? `Synced ${res.count} records to Supabase Cloud!` : 'All data is up to date!')
        } else {
          message.warning(res.error || 'Sync deferred (waiting for connection)')
        }
      }
    } catch (err: any) {
      console.warn('Sync failed:', err)
      message.error('Could not complete sync')
    } finally {
      setIsSyncing(false)
    }
  }

  if (!isOnline) {
    return (
      <div 
        className="sync-badge offline" 
        title="Internet disconnected. POS is saving all transactions locally in SQLite."
        style={{ cursor: 'pointer' }}
      >
        <CloudOff size={12} />
        <span>Offline {pendingCount > 0 ? `(${pendingCount} pending)` : ''}</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div 
        className="sync-badge" 
        style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'pointer' }}
        title="Syncing with Supabase Cloud..."
      >
        <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Syncing...</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div 
        className="sync-badge" 
        style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', cursor: 'pointer' }}
        onClick={handleManualSync}
        title="Click to manually sync pending changes to Supabase Cloud"
      >
        <span className="sync-dot" style={{ background: '#f59e0b' }} />
        <span>{pendingCount} pending</span>
      </div>
    )
  }

  return (
    <div 
      className="sync-badge online" 
      onClick={handleManualSync}
      title="Connected to Supabase Cloud. Click to sync now."
      style={{ cursor: 'pointer' }}
    >
      <span className="sync-dot" />
      <Cloud size={11} />
      <span>Synced</span>
    </div>
  )
}
