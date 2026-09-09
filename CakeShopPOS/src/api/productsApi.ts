import { apiClient } from './apiClient'

export interface ProductDto {
  id: string
  categoryId?: string
  categoryName?: string
  itemCode: string
  name: string
  description?: string
  price: number
  costPrice?: number
  barcode?: string
  unit: string
  trackInventory: boolean
  isActive: boolean
  currentStock: number
  isLowStock: boolean
}

export interface CreateProductRequest {
  categoryId: string
  name: string
  description?: string
  price: number
  costPrice?: number
  barcode?: string
  unit: string
  trackInventory: boolean
  initialStock: number
  minStockAlert: number
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
  getAll: (includeInactive: boolean = false): Promise<ProductDto[]> =>
    apiClient.get<ProductDto[]>('/products', { params: { includeInactive } }),
  
  getByBarcode: (barcode: string): Promise<ProductDto> =>
    apiClient.get<ProductDto>(`/products/by-barcode/${encodeURIComponent(barcode)}`),
  
  create: (data: CreateProductRequest): Promise<ProductDto> =>
    apiClient.post<ProductDto>('/products', data),
  
  update: (id: string, data: UpdateProductRequest): Promise<void> =>
    apiClient.put<void>(`/products/${id}`, data),
  
  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`/products/${id}`)
}

export default productsApi
