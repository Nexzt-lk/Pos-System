import React from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSyncStore } from '../store/syncStore'

export const SyncIndicator: React.FC = () => {
  const isOnline = useOnlineStatus()
  const pendingCount = useSyncStore((state) => state.pendingCount)
  const isSyncing = useSyncStore((state) => state.isSyncing)

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
        <CloudOff size={14} />
        <span>Offline Mode {pendingCount > 0 && `(${pendingCount} pending)`}</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
        <RefreshCw size={14} className="animate-spin text-blue-400" />
        <span>Syncing Cloud...</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-400 border border-yellow-500/20">
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
        <span>{pendingCount} Pending Sync</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      <Cloud size={14} />
      <span>Cloud Synced</span>
    </div>
  )
}
