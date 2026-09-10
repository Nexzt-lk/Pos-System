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

export interface PaymentBreakdownDto {
  cashAmount: number
  cashCount: number
  cashPercentage: number
  cardAmount: number
  cardCount: number
  cardPercentage: number
}

export interface CategorySalesDto {
  categoryId?: string
  categoryName: string
  quantitySold: number
  revenue: number
  percentage: number
}

export interface PeakHourDto {
  timeSlot: string
  orderCount: number
  revenue: number
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
  paymentBreakdown?: PaymentBreakdownDto
  categoryBreakdown?: CategorySalesDto[]
  peakSlot?: PeakHourDto
  topProducts: TopProductDto[]
  dailyBreakdown: DailyBreakdownDto[]
  recentOrders?: any[]
}

export const reportsApi = {
  getSalesReport: (period: 'daily' | 'weekly' | 'monthly' = 'daily', date?: string): Promise<SalesReportDto> => {
    return apiClient.get<SalesReportDto>('/reports/sales', {
      params: { period, date }
    })
  }
}

export default reportsApi
