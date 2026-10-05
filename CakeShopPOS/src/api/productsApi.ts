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
  imagePath?: string
  image_path?: string
  shop_id?: string
}

export interface CreateProductRequest {
  categoryId?: string
  category_id?: string
  itemCode?: string
  item_code?: string
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
  imagePath?: string
  image_path?: string
  shopId?: string
  shop_id?: string
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
  imagePath?: string
  image_path?: string
  shop_id?: string
  shopId?: string
}

export const productsApi = {
  getAll: async (includeInactive: boolean = false, shopId: string = 'b0000000-0000-0000-0000-000000000001'): Promise<ProductDto[]> => {
    try {
      const res = await apiClient.get<ProductDto[]>('/products', { params: { includeInactive, shopId } })
      if (Array.isArray(res)) {
        return res.map((p: any) => ({
          ...p,
          imagePath: p.imagePath || p.image_path || '',
          image_path: p.image_path || p.imagePath || ''
        }))
      }
      return res
    } catch (err) {
      console.warn('[ProductsApi] REST API failed, trying Electron IPC SQLite:', err)
      const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
      if (api) {
        let local: any[] = []
        if (api.getProducts) {
          local = await api.getProducts(shopId)
        } else if (api.dbQuery) {
          local = await api.dbQuery('db:get-products', shopId)
        }

        if (Array.isArray(local) && local.length > 0) {
          return local.map((p: any) => ({
            id: p.id,
            shop_id: p.shop_id || shopId,
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
            isLowStock: Boolean(p.track_inventory && (Number(p.current_stock) || 0) <= 5),
            imagePath: p.image_path || p.imagePath || '',
            image_path: p.image_path || p.imagePath || ''
          }))
        }
      }
      return []
    }
  },
  
  getByBarcode: async (barcode: string, shopId: string = 'b0000000-0000-0000-0000-000000000001'): Promise<ProductDto> => {
    try {
      const p = await apiClient.get<ProductDto>(`/products/by-barcode/${encodeURIComponent(barcode)}`, { params: { shopId } })
      if (p) {
        return {
          ...p,
          imagePath: p.imagePath || p.image_path || '',
          image_path: p.image_path || p.imagePath || ''
        }
      }
      return p
    } catch (err) {
      const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
      if (api) {
        if (api.getProductByBarcode) {
          const p = await api.getProductByBarcode({ shopId, barcode })
          if (p) return { ...p, imagePath: p.image_path || p.imagePath || '', image_path: p.image_path || p.imagePath || '' }
        } else if (api.dbQuery) {
          const p = await api.dbQuery('db:get-product-by-barcode', { shopId, barcode })
          if (p) return { ...p, imagePath: p.image_path || p.imagePath || '', image_path: p.image_path || p.imagePath || '' }
        }
      }
      throw err
    }
  },
  
  create: async (data: CreateProductRequest): Promise<ProductDto> => {
    const shopId = data.shopId || data.shop_id || 'b0000000-0000-0000-0000-000000000001'
    const img = data.imagePath || data.image_path || ''
    const payload = {
      ...data,
      imagePath: img,
      image_path: img,
      shopId,
      shop_id: shopId
    }
    let res: ProductDto | null = null
    try {
      res = await apiClient.post<ProductDto>('/products', payload)
    } catch (err) {
      console.warn('[ProductsApi] REST API create failed, using local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api) {
      const id = res?.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'))
      const itemCode = res?.itemCode || (data.barcode ? String(data.barcode).trim() : (data.itemCode || data.item_code || ('ITM-' + Date.now().toString().slice(-6))))
      const cleanBarcode = data.barcode ? String(data.barcode).trim() : null
      const newProduct = {
        id,
        category_id: data.categoryId || data.category_id,
        name: data.name,
        description: data.description || '',
        price: Number(data.price) || 0,
        cost_price: data.costPrice ? Number(data.costPrice) : (data.cost_price ? Number(data.cost_price) : null),
        barcode: cleanBarcode,
        item_code: itemCode,
        unit: data.unit || 'pcs',
        track_inventory: data.trackInventory ? 1 : 0,
        is_active: 1,
        image_path: img || null,
        initialStock: data.initialStock || 0,
        shop_id: shopId,
        shopId: shopId
      }
      if (api.upsertProduct) {
        await api.upsertProduct(newProduct)
      } else if (api.dbQuery) {
        await api.dbQuery('db:upsert-product', newProduct)
      }
      if (!res) {
        return {
          ...newProduct,
          currentStock: data.initialStock || 0,
          isLowStock: false,
          trackInventory: data.trackInventory,
          isActive: true,
          imagePath: img,
          image_path: img
        } as any
      }
    }
    if (res) {
      return {
        ...res,
        imagePath: res.imagePath || res.image_path || img,
        image_path: res.image_path || res.imagePath || img
      }
    }
    throw new Error('Failed to create product')
  },
  
  update: async (id: string, data: UpdateProductRequest): Promise<void> => {
    const shopId = data.shopId || data.shop_id
    const img = data.imagePath || data.image_path || ''
    const payload = {
      ...data,
      imagePath: img,
      image_path: img,
      ...(shopId ? { shopId, shop_id: shopId } : {})
    }
    try {
      await apiClient.put<void>(`/products/${id}`, payload)
    } catch (err) {
      console.warn('[ProductsApi] REST API update failed, updating local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api) {
      const payloadIpc = {
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
        is_active: data.isActive ? 1 : 0,
        image_path: img,
        ...(shopId ? { shop_id: shopId, shopId: shopId } : {})
      }
      if (api.upsertProduct) {
        await api.upsertProduct(payloadIpc)
      } else if (api.dbQuery) {
        await api.dbQuery('db:upsert-product', payloadIpc)
      }
    }
  },
  
  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete<void>(`/products/${id}`)
    } catch (err) {
      const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
      if (api) {
        if (api.upsertProduct) {
          await api.upsertProduct({ id, is_active: 0 })
        } else if (api.dbQuery) {
          await api.dbQuery('db:upsert-product', { id, is_active: 0 })
        }
        return
      }
      throw err
    }
  }
}

export default productsApi

