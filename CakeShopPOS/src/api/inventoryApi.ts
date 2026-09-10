import { apiClient } from './apiClient'

export interface RecordStockMovementRequest {
  productId: string
  type: 'IN' | 'OUT' | 'SALE' | 'ADJUST' | 'RETURN' | 'DAMAGE'
  quantity: number
  note?: string
  costPerUnit?: number
  doneBy?: string
}

export interface StockMovementDto {
  id: string
  productId: string
  type: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceId?: string
  note?: string
  costPerUnit?: number
  doneBy?: string
  createdAt: string
}

export const inventoryApi = {
  recordMovement: async (data: RecordStockMovementRequest, shopId?: string): Promise<StockMovementDto> => {
    try {
      return await apiClient.post<StockMovementDto>('/inventory/movement', data)
    } catch (err) {
      console.warn('[InventoryApi] REST API failed, falling back to Electron IPC:', err)
      if (typeof window !== 'undefined' && (window as any).electronAPI?.dbQuery) {
        await (window as any).electronAPI.dbQuery('db:record-stock-movement', {
          shopId,
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          note: data.note || '',
          costPerUnit: data.costPerUnit,
          doneBy: data.doneBy
        })
        return {
          id: 'local-' + Date.now(),
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          quantityBefore: 0,
          quantityAfter: data.quantity,
          note: data.note,
          costPerUnit: data.costPerUnit,
          doneBy: data.doneBy,
          createdAt: new Date().toISOString()
        }
      }
      throw err
    }
  },

  getMovementsByProduct: (productId: string): Promise<StockMovementDto[]> =>
    apiClient.get<StockMovementDto[]>(`/inventory/movements/${productId}`)
}

export default inventoryApi
