import { apiClient } from './apiClient'

export interface CategoryDto {
  id: string
  name: string
  codePrefix?: string
  code_prefix?: string
  color: string
  icon?: string
  sortOrder?: number
  sort_order?: number
  isActive: boolean
  is_active?: number | boolean
  createdAt?: string
  created_at?: string
}

export interface CreateCategoryRequest {
  name: string
  codePrefix: string
  color?: string
  icon?: string
}

export const categoriesApi = {
  getAll: async (shopId: string = 'b0000000-0000-0000-0000-000000000001'): Promise<CategoryDto[]> => {
    try {
      return await apiClient.get<CategoryDto[]>('/categories')
    } catch (err) {
      console.warn('[CategoriesApi] REST API failed, trying Electron IPC SQLite:', err)
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getCategories) {
        const local = await (window as any).electronAPI.getCategories(shopId)
        return (local || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          codePrefix: c.code_prefix || c.codePrefix,
          color: c.color || '#6366f1',
          icon: c.icon || 'cake',
          sortOrder: c.sort_order ?? c.sortOrder ?? 0,
          isActive: c.is_active !== undefined ? Boolean(c.is_active) : true,
          createdAt: c.created_at || c.createdAt
        }))
      }
      return []
    }
  },

  create: async (data: CreateCategoryRequest): Promise<CategoryDto> => {
    try {
      return await apiClient.post<CategoryDto>('/categories', data)
    } catch (err) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.upsertCategory) {
        const id = 'cat-' + Date.now()
        await (window as any).electronAPI.upsertCategory({
          id,
          name: data.name,
          code_prefix: data.codePrefix,
          color: data.color || '#6366f1',
          icon: data.icon || 'cake',
          sort_order: 0,
          is_active: 1
        })
        return {
          id,
          name: data.name,
          codePrefix: data.codePrefix,
          color: data.color || '#6366f1',
          icon: data.icon || 'cake',
          isActive: true
        }
      }
      throw err
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete<void>(`/categories/${id}`)
    } catch (err) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.upsertCategory) {
        await (window as any).electronAPI.upsertCategory({ id, is_active: 0 })
        return
      }
      throw err
    }
  }
}

export default categoriesApi

