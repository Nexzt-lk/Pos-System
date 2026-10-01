import { apiClient } from './apiClient'

export interface ExpenseDto {
  id: string
  category?: string
  description: string
  amount: number
  expenseDate: string
  linkedProductId?: string
  addedBy?: string
  createdAt?: string
  localId?: string
  syncStatus?: string
}

export interface CreateExpenseRequest {
  category?: string
  description: string
  amount: number
  expenseDate?: string
  linkedProductId?: string
  addedBy?: string
}

export interface UpdateExpenseRequest {
  category?: string
  description: string
  amount: number
  expenseDate: string
  addedBy?: string
}

export interface ExpenseSummaryDto {
  totalAmount: number
  count: number
  avgAmount: number
  maxAmount: number
  todayTotal: number
  todayCount: number
  monthTotal: number
  categoryBreakdown: Array<{ category: string; total: number; count: number }>
}

function normalizeExpense(raw: any): ExpenseDto {
  return {
    id: raw.id || raw.local_id || String(Math.random()),
    category: raw.category || 'Other',
    description: raw.description || '',
    amount: Number(raw.amount) || 0,
    expenseDate: (raw.expenseDate || raw.expense_date || new Date().toISOString()).slice(0, 10),
    linkedProductId: raw.linkedProductId || raw.linked_product_id,
    addedBy: raw.addedBy || raw.added_by || 'Cashier',
    createdAt: raw.createdAt || raw.created_at,
    localId: raw.localId || raw.local_id,
    syncStatus: raw.syncStatus || raw.sync_status
  }
}

export const expensesApi = {
  getAll: async (params?: { category?: string; search?: string }): Promise<ExpenseDto[]> => {
    try {
      const res = await apiClient.get<any[]>('/expenses')
      if (Array.isArray(res)) {
        return res.map(normalizeExpense)
      }
    } catch (err) {
      console.warn('[ExpensesApi] REST API offline/failed, falling back to local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getExpenses) {
      const rows = await api.getExpenses(params)
      return (rows || []).map(normalizeExpense)
    }

    return []
  },

  getByDateRange: async (from: string, to: string, category?: string, search?: string): Promise<ExpenseDto[]> => {
    try {
      const res = await apiClient.get<any[]>(`/expenses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      if (Array.isArray(res)) {
        return res.map(normalizeExpense)
      }
    } catch (err) {
      console.warn('[ExpensesApi] REST API getByDateRange failed, using local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getExpenses) {
      const rows = await api.getExpenses({ from, to, category, search })
      return (rows || []).map(normalizeExpense)
    }

    return []
  },

  getById: async (id: string): Promise<ExpenseDto | null> => {
    try {
      const res = await apiClient.get<any>(`/expenses/${id}`)
      if (res) return normalizeExpense(res)
    } catch (_) {}

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getExpenseById) {
      const row = await api.getExpenseById(id)
      return row ? normalizeExpense(row) : null
    }

    return null
  },

  create: async (data: CreateExpenseRequest): Promise<ExpenseDto> => {
    try {
      const res = await apiClient.post<any>('/expenses', data)
      if (res) return normalizeExpense(res)
    } catch (err) {
      console.warn('[ExpensesApi] REST API create failed, writing to local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.createExpense) {
      const created = await api.createExpense(data)
      return normalizeExpense(created)
    }

    throw new Error('Local database and server are unreachable')
  },

  update: async (id: string, data: UpdateExpenseRequest): Promise<ExpenseDto> => {
    try {
      const res = await apiClient.put<any>(`/expenses/${id}`, data)
      if (res) return normalizeExpense(res)
    } catch (err) {
      console.warn('[ExpensesApi] REST API update failed, writing to local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.updateExpense) {
      const updated = await api.updateExpense(id, data)
      return normalizeExpense(updated)
    }

    throw new Error('Local database and server are unreachable')
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete<void>(`/expenses/${id}`)
      return
    } catch (err) {
      console.warn('[ExpensesApi] REST API delete failed, writing to local SQLite:', err)
    }

    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.deleteExpense) {
      await api.deleteExpense(id)
      return
    }

    throw new Error('Local database and server are unreachable')
  },

  getSummary: async (params?: { from?: string; to?: string }): Promise<ExpenseSummaryDto> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.getExpenseSummary) {
      return await api.getExpenseSummary(params)
    }

    return {
      totalAmount: 0,
      count: 0,
      avgAmount: 0,
      maxAmount: 0,
      todayTotal: 0,
      todayCount: 0,
      monthTotal: 0,
      categoryBreakdown: []
    }
  },

  printVoucher: async (voucherData: any, printerName?: string): Promise<{ success: boolean; message?: string; printerUsed?: string }> => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (api?.printExpenseVoucher) {
      return await api.printExpenseVoucher(voucherData, printerName)
    }
    return { success: false, message: 'Printer service not available in current environment' }
  }
}

export default expensesApi
