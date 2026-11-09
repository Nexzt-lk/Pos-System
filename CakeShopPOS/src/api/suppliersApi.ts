import { apiClient } from './apiClient'

export interface SupplierDto {
  id: string
  name: string
  phone?: string
  contactPerson?: string
  email?: string
  address?: string
  notes?: string
  createdAt?: string
}

export interface CreateSupplierRequest {
  name: string
  phone?: string
  contactPerson?: string
  email?: string
  address?: string
  notes?: string
}

export const suppliersApi = {
  getAll: async (): Promise<SupplierDto[]> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getSuppliers) {
        return await (window as any).electronAPI.getSuppliers()
      }
      return await apiClient.get<SupplierDto[]>('/suppliers')
    } catch (err) {
      console.warn('[SuppliersApi] Failed to fetch suppliers:', err)
      return []
    }
  },

  create: async (data: CreateSupplierRequest): Promise<SupplierDto> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.createSupplier) {
        return await (window as any).electronAPI.createSupplier(data)
      }
      return await apiClient.post<SupplierDto>('/suppliers', data)
    } catch (err) {
      console.warn('[SuppliersApi] Failed to create supplier:', err)
      throw err
    }
  },

  update: async (id: string, data: CreateSupplierRequest): Promise<SupplierDto> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.updateSupplier) {
        return await (window as any).electronAPI.updateSupplier(id, data)
      }
      return await apiClient.put<SupplierDto>(`/suppliers/${id}`, data)
    } catch (err) {
      console.warn('[SuppliersApi] Failed to update supplier:', err)
      throw err
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.deleteSupplier) {
        return await (window as any).electronAPI.deleteSupplier(id)
      }
      await apiClient.delete(`/suppliers/${id}`)
      return true
    } catch (err) {
      console.warn('[SuppliersApi] Failed to delete supplier:', err)
      throw err
    }
  }
}

export default suppliersApi
