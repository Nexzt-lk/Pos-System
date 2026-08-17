import { create } from 'zustand'

interface SyncState {
  pendingCount: number
  isSyncing: boolean
  lastSyncedAt: Date | null
  syncError: string | null

  // Actions
  setPendingCount: (count: number) => void
  setIsSyncing: (isSyncing: boolean) => void
  setLastSyncedAt: (date: Date) => void
  setSyncError: (error: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,

  setPendingCount: (pendingCount) => set({ pendingCount }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt, syncError: null }),
  setSyncError: (syncError) => set({ syncError, isSyncing: false })
}))
