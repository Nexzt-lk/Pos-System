import { apiClient } from './apiClient'

export interface ExpenseDto {
  id: string
  category?: string
  description: string
  amount: number
  expenseDate: string
  linkedProductId?: string
}

export interface CreateExpenseRequest {
  category?: string
  description: string
  amount: number
  expenseDate?: string
  linkedProductId?: string
}

export const expensesApi = {
  getAll: (): Promise<ExpenseDto[]> => apiClient.get<ExpenseDto[]>('/expenses'),
  create: (data: CreateExpenseRequest): Promise<ExpenseDto> => apiClient.post<ExpenseDto>('/expenses', data),
  delete: (id: string): Promise<void> => apiClient.delete<void>(`/expenses/${id}`)
}

export default expensesApi
