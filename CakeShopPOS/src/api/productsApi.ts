import { apiClient } from './apiClient'

export interface ProductDto {
  id: string
  categoryId?: string
  category_id?: string
  categoryName?: string
  category_name?: string
  categoryColor?: string
  category_color?: string
  itemCode?: string
  item_code?: string
  name: string
  description?: string
  price: number
  costPrice?: number
  cost_price?: number
  barcode?: string
  unit: string
  trackInventory?: boolean
  track_inventory?: number | boolean
  isActive?: boolean
  is_active?: number | boolean
  currentStock?: number
  current_stock?: number
  isLowStock?: boolean
}

export interface CreateProductRequest {
  categoryId?: string
  category_id?: string
  name: string
  description?: string
  price: number
  costPrice?: number
  cost_price?: number
  barcode?: string
  unit: string
  trackInventory: boolean
  initialStock?: number
  minStockAlert?: number
}

export interface UpdateProductRequest {
  categoryId?: string
  name: string
  description?: string
  price: number
  costPrice?: number
  barcode?: string
  unit: string
  trackInventory: boolean
  isActive: boolean
}

export const productsApi = {
  getAll: async (includeInactive: boolean = false, shopId: string = 'b0000000-0000-0000-0000-000000000001'): Promise<ProductDto[]> => {
    try {
      return await apiClient.get<ProductDto[]>('/products', { params: { includeInactive } })
    } catch (err) {
      console.warn('[ProductsApi] REST API failed, trying Electron IPC SQLite:', err)
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getProducts) {
        const local = await (window as any).electronAPI.getProducts(shopId)
        return (local || []).map((p: any) => ({
          id: p.id,
          categoryId: p.category_id || p.categoryId,
          category_id: p.category_id || p.categoryId,
          categoryName: p.category_name || p.categoryName,
          categoryColor: p.category_color || p.categoryColor,
          itemCode: p.item_code || p.itemCode || p.barcode || 'ITEM',
          name: p.name,
          description: p.description,
          price: Number(p.price) || 0,
          costPrice: p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price) : undefined,
          barcode: p.barcode,
          unit: p.unit || 'pcs',
          trackInventory: Boolean(p.track_inventory),
          isActive: p.is_active !== undefined ? Boolean(p.is_active) : true,
          currentStock: Number(p.current_stock) || 0,
          isLowStock: Boolean(p.track_inventory && (Number(p.current_stock) || 0) <= 5)
        }))
      }
      return []
    }
  },
  
  getByBarcode: async (barcode: string, shopId: string = 'b0000000-0000-0000-0000-000000000001'): Promise<ProductDto> => {
    try {
      return await apiClient.get<ProductDto>(`/products/by-barcode/${encodeURIComponent(barcode)}`)
    } catch (err) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getProductByBarcode) {
        const p = await (window as any).electronAPI.getProductByBarcode({ shopId, barcode })
        if (p) return p
      }
      throw err
    }
  },
  
  create: async (data: CreateProductRequest): Promise<ProductDto> => {
    try {
      return await apiClient.post<ProductDto>('/products', data)
    } catch (err) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.upsertProduct) {
        const id = 'prod-' + Date.now()
        const newProduct = {
          id,
          category_id: data.categoryId || data.category_id,
          name: data.name,
          description: data.description,
          price: data.price,
          cost_price: data.costPrice || data.cost_price,
          barcode: data.barcode,
          item_code: data.barcode,
          unit: data.unit,
          track_inventory: data.trackInventory ? 1 : 0,
          is_active: 1
        }
        await (window as any).electronAPI.upsertProduct(newProduct)
        return {
          ...newProduct,
          currentStock: data.initialStock || 0,
          isLowStock: false,
          trackInventory: data.trackInventory,
          isActive: true
        } as any
      }
      throw err
    }
  },
  
  update: async (id: string, data: UpdateProductRequest): Promise<void> => {
    try {
      await apiClient.put<void>(`/products/${id}`, data)
    } catch (err) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.upsertProduct) {
        await (window as any).electronAPI.upsertProduct({
          id,
          category_id: data.categoryId,
          name: data.name,
          description: data.description,
          price: data.price,
          cost_price: data.costPrice,
          barcode: data.barcode,
          item_code: data.barcode,
          unit: data.unit,
          track_inventory: data.trackInventory ? 1 : 0,
          is_active: data.isActive ? 1 : 0
        })
        return
      }
      throw err
    }
  },
  
  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete<void>(`/products/${id}`)
    } catch (err) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.upsertProduct) {
        await (window as any).electronAPI.upsertProduct({ id, is_active: 0 })
        return
      }
      throw err
    }
  }
}

export default productsApi

