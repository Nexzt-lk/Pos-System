import { syncRepo } from '../db/repositories/syncRepo'
import axios from 'axios'

let syncInterval: NodeJS.Timeout | null = null

export const syncService = {
  startBackgroundSync: (getApiUrl: () => string, intervalMs = 30000) => {
    if (syncInterval) clearInterval(syncInterval)

    console.log(`[SyncService] Starting non-blocking background sync worker (every ${intervalMs / 1000}s)`)

    syncInterval = setInterval(async () => {
      await syncService.processSyncQueue(getApiUrl())
    }, intervalMs)
  },

  stopBackgroundSync: () => {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  },

  processSyncQueue: async (apiUrl: string): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
      const pendingItems = syncRepo.getPendingItems(50)
      if (pendingItems.length === 0) {
        return { success: true, count: 0 }
      }

      console.log(`[SyncService] Processing ${pendingItems.length} offline items to ${apiUrl}/api/sync...`)

      const payload = pendingItems.map((item) => ({
        id: item.id,
        tableName: item.table_name,
        operation: item.operation,
        recordId: item.record_id,
        data: JSON.parse(item.payload),
        createdAt: item.created_at
      }))

      const response = await axios.post(`${apiUrl}/api/sync`, { batch: payload }, { timeout: 10000 })

      if (response.status === 200) {
        const syncedIds = pendingItems.map((i) => i.id)
        syncRepo.markAsSynced(syncedIds)
        console.log(`[SyncService] Successfully synced ${syncedIds.length} records to backend.`)
        return { success: true, count: syncedIds.length }
      } else {
        throw new Error(`Sync API returned status ${response.status}`)
      }
    } catch (err: any) {
      console.warn(`[SyncService] Sync attempt deferred (offline or server unreachable):`, err.message)
      return { success: false, error: err.message }
    }
  }
}
