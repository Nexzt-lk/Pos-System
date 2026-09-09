import { apiClient } from './apiClient'

export interface CategoryDto {
  id: string
  name: string
  codePrefix?: string
  color: string
  icon?: string
  sortOrder?: number
  isActive: boolean
  createdAt?: string
}

export interface CreateCategoryRequest {
  name: string
  codePrefix: string
  color?: string
  icon?: string
}

export const categoriesApi = {
  getAll: (): Promise<CategoryDto[]> => apiClient.get<CategoryDto[]>('/categories'),
  create: (data: CreateCategoryRequest): Promise<CategoryDto> => apiClient.post<CategoryDto>('/categories', data),
  delete: (id: string): Promise<void> => apiClient.delete<void>(`/categories/${id}`)
}

export default categoriesApi
