import { apiClient } from './apiClient'

export interface TopProductDto {
  productName: string
  quantitySold: number
  revenue: number
}

export interface DailyBreakdownDto {
  date: string
  sales: number
  expenses: number
  orderCount: number
}

export interface SalesReportDto {
  period: 'Daily' | 'Weekly' | 'Monthly' | number
  fromDate: string
  toDate: string
  orderCount: number
  totalSales: number
  totalDiscount: number
  totalTax: number
  netIncome: number
  totalExpenses: number
  profitEstimate: number
  costOfGoodsSold: number
  topProducts: TopProductDto[]
  dailyBreakdown: DailyBreakdownDto[]
}

export const reportsApi = {
  getSalesReport: (period: 'daily' | 'weekly' | 'monthly' = 'daily', date?: string): Promise<SalesReportDto> => {
    return apiClient.get<SalesReportDto>('/reports/sales', {
      params: { period, date }
    })
  }
}

export default reportsApi
