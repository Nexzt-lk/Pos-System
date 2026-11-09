import { apiClient } from './apiClient'

export interface RecordStockMovementRequest {
  productId: string
  type: 'IN' | 'OUT' | 'SALE' | 'ADJUST' | 'RETURN' | 'DAMAGE'
  quantity: number
  note?: string
  costPerUnit?: number
  doneBy?: string
  supplierId?: string
  supplierName?: string
  totalCost?: number
  invoiceNo?: string
  paymentMethod?: string
  recordExpense?: boolean
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
  totalCost?: number
  supplierId?: string
  supplierName?: string
  invoiceNo?: string
  paymentMethod?: string
  doneBy?: string
  createdAt: string
}

export interface StockPurchaseRecord {
  id: string
  productId: string
  productName: string
  itemCode: string
  unit: string
  type: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  costPerUnit: number
  totalCost: number
  supplierId?: string
  supplierName: string
  invoiceNo?: string
  paymentMethod: string
  note?: string
  doneBy: string
  createdAt: string
}

export interface StockPurchaseFilter {
  from?: string
  to?: string
  productId?: string
  supplierId?: string
  search?: string
}

export const inventoryApi = {
  recordMovement: async (data: RecordStockMovementRequest, shopId?: string): Promise<StockMovementDto> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.recordStockMovement) {
        const res = await (window as any).electronAPI.recordStockMovement({
          shopId,
          ...data
        })
        return {
          id: res?.movementId || 'local-' + Date.now(),
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          quantityBefore: 0,
          quantityAfter: data.quantity,
          note: data.note,
          costPerUnit: data.costPerUnit,
          totalCost: data.totalCost,
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          invoiceNo: data.invoiceNo,
          paymentMethod: data.paymentMethod,
          doneBy: data.doneBy,
          createdAt: new Date().toISOString()
        }
      }
      return await apiClient.post<StockMovementDto>('/inventory/movement', data)
    } catch (err) {
      console.warn('[InventoryApi] Primary record movement failed, falling back to dbQuery:', err)
      if (typeof window !== 'undefined' && (window as any).electronAPI?.dbQuery) {
        await (window as any).electronAPI.dbQuery('db:record-stock-movement', {
          shopId,
          ...data
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
          totalCost: data.totalCost,
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          invoiceNo: data.invoiceNo,
          paymentMethod: data.paymentMethod,
          doneBy: data.doneBy,
          createdAt: new Date().toISOString()
        }
      }
      throw err
    }
  },

  getStockPurchases: async (params?: StockPurchaseFilter): Promise<StockPurchaseRecord[]> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getStockPurchases) {
        return await (window as any).electronAPI.getStockPurchases(params)
      }
      if (typeof window !== 'undefined' && (window as any).electronAPI?.dbQuery) {
        return await (window as any).electronAPI.dbQuery('db:get-stock-purchases', params)
      }
      return await apiClient.get<StockPurchaseRecord[]>('/inventory/purchases', { params })
    } catch (err) {
      console.warn('[InventoryApi] Failed to get stock purchases:', err)
      return []
    }
  },

  getMovementsByProduct: (productId: string): Promise<StockMovementDto[]> =>
    apiClient.get<StockMovementDto[]>(`/inventory/movements/${productId}`)
}

export default inventoryApi
