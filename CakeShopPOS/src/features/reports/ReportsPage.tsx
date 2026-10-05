import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart3,
  Calendar,
  Banknote,
  TrendingUp,
  CreditCard,
  Building2,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Award,
  Layers,
  CalendarDays,
  CalendarRange,
  Clock,
  Crown,
  Package,
  Search,
  Filter,
  Wallet,
  Users,
  Monitor,
  AlertTriangle,
  TrendingDown,
  ShieldCheck,
  Coins,
  FileText
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import dayjs from 'dayjs'
import { reportsApi } from '../../api/reportsApi'
import { RefreshButton } from '../../components/RefreshButton'
import { AnalyticsDetailModal, DetailModalType } from './AnalyticsDetailModal'
import { ReportGeneratorModal } from './ReportGeneratorModal'
import { Dropdown, message } from 'antd'
import { downloadCsv, money, qty, pct, csvDate, csvTime, CsvRow } from '../../lib/csvExport'

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface BranchMetric {
  shopId: string
  shopName: string
  branchCode: string
  address?: string
  phone?: string
  totalOrders: number
  totalRevenue: number
  avgTicket: number
  costOfGoods: number
  grossProfit: number
  grossProfitMargin: number
  totalExpenses: number
  netProfit: number
  netProfitMargin: number
  cashSales: number
  cashExpenses: number
  netCashInDrawer: number
  totalProducts: number
  inventoryCostValue: number
  inventoryRetailValue: number
  lowStockCount: number
}

interface AnalyticsState {
  period: PeriodType
  startDate: string
  endDate: string
  summary: {
    total_orders: number
    total_revenue: number
    total_subtotal: number
    total_discount: number
    total_tax: number
    avg_order_value: number
    net_revenue: number
    total_cost: number
    estimated_profit: number
    profit_margin_pct: number
    total_items_sold: number
    revenue_growth_pct: number
    orders_growth_pct: number
    prev_revenue: number
    prev_orders: number
  }
  timeline: Array<{
    label: string
    date?: string
    hour?: string
    revenue: number
    orders: number
    discount: number
    avgTicket: number
  }>
  paymentBreakdown: Array<{
    method: string
    total_amount: number
    count: number
    percent: number
  }>
  topProducts: Array<{
    product_name: string
    total_qty: number
    total_revenue: number
  }>
  categoryBreakdown: Array<{
    category_name: string
    color: string
    total_qty: number
    total_revenue: number
  }>
  itemBreakdown?: Array<{
    product_id: string
    product_name: string
    item_code: string
    category_name: string
    avg_unit_price: number
    avg_cost_price: number
    total_qty: number
    total_discount: number
    total_revenue: number
    total_cogs: number
    gross_profit: number
    margin_pct: number
    revenue_share_pct: number
  }>
  ownerMetrics?: {
    grossProfit: number
    grossProfitMargin: number
    totalExpenses: number
    netProfit: number
    netProfitMargin: number
    expenseCategories: Array<{ category: string; total_amount: number; count: number }>
    cashierPerformance: Array<{ cashier_name: string; orders_count: number; total_revenue: number; total_discount: number; avg_ticket: number }>
    terminalPerformance: Array<{ terminal_id: string; orders_count: number; total_revenue: number }>
    inventoryValuation: {
      totalProducts: number
      totalCostValue: number
      totalRetailValue: number
      potentialMarginValue: number
      lowStockCount: number
      outOfStockCount: number
    }
    damageLoss: {
      cost: number
      quantity: number
      events: number
    }
    cashDrawer: {
      cashSales: number
      cashExpenses: number
      netCashEstimated: number
    }
    detailedExpenses?: Array<{
      id: string
      category: string
      description: string
      amount: number
      expense_date: string
      added_by: string
      payment_method: string
      notes: string
    }>
    lowStockList?: Array<{
      id: string
      product_name: string
      item_code: string
      category_name: string
      current_stock: number
      min_quantity: number
      cost_price: number
      price: number
      unit: string
    }>
    damageLossList?: Array<{
      id: string
      product_name: string
      quantity: number
      cost_per_unit: number
      total_cost: number
      note: string
      created_at: string
    }>
    branchBreakdown?: BranchMetric[]
  }
  branchBreakdown?: BranchMetric[]
  peakSlot: { label: string; revenue: number; orders: number } | null
  recentOrders: Array<{
    id: string
    order_no: string
    created_at: string
    total_amount: number
    discount_amount: number
    status: string
    items_count: number
    payment_method: string
    subtotal?: number
    tax_amount?: number
    cashier_name?: string
    terminal_id?: string
  }>
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#0f766e',
  CARD: '#334155',
  TRANSFER: '#64748b',
  MIXED: '#94a3b8'
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote size={15} color="#0f766e" />,
  CARD: <CreditCard size={15} color="#334155" />,
  TRANSFER: <Building2 size={15} color="#64748b" />,
  MIXED: <Layers size={15} color="#94a3b8" />
}

export const ReportsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [viewMode, setViewMode] = useState<'store' | 'owner'>('store')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [customStartDate, setCustomStartDate] = useState<string>(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [customEndDate, setCustomEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [chartMode, setChartMode] = useState<'revenue' | 'orders' | 'both'>('revenue')
  const [tableTab, setTableTab] = useState<'items' | 'orders'>('items')
  const [itemSearch, setItemSearch] = useState('')
  const [itemCategoryFilter, setItemCategoryFilter] = useState('ALL')
  const [itemSortKey, setItemSortKey] = useState<'revenue' | 'qty' | 'profit' | 'margin'>('revenue')
  const [loading, setLoading] = useState<boolean>(false)
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null)
  const [detailModal, setDetailModal] = useState<DetailModalType>(null)
  const [showReportGen, setShowReportGen] = useState<boolean>(false)

  // Fetch real analytics data from Local Electron DB or Backend API
  const loadAnalytics = async () => {
    const shopId = selectedBranchId
    setLoading(true)
    try {
      // 1. First priority: Direct Local SQLite Query via Electron IPC (Offline-first & 100% Real-Time)
      if (window.electronAPI?.dbQuery) {
        const localReport = await window.electronAPI.dbQuery('db:get-analytics', {
          shopId,
          period,
          dateStr: selectedDate,
          startDate: period === 'custom' ? customStartDate : undefined,
          endDate: period === 'custom' ? customEndDate : undefined
        })

        // Desktop mode: the local POS database is the single source of truth.
        // Never substitute backend/estimated figures here.
        setAnalytics(localReport || generateEmptyAnalytics(period, selectedDate, customStartDate, customEndDate))
        return
      }

      // 2. Fallback to Backend REST API (if in Web Browser mode)
      let backendPeriod: 'daily' | 'weekly' | 'monthly' = 'daily'
      if (period === 'weekly') backendPeriod = 'weekly'
      if (period === 'monthly') backendPeriod = 'monthly'

      const backendReport = await reportsApi.getSalesReport(backendPeriod, selectedDate)

      if (backendReport) {
        const mappedTimeline = (backendReport.dailyBreakdown || []).map((db) => ({
          label: db.date,
          date: db.date,
          revenue: db.sales || 0,
          orders: db.orderCount || 0,
          discount: 0,
          avgTicket: db.orderCount > 0 ? Math.round(db.sales / db.orderCount) : 0
        }))

        const mappedTopProducts = (backendReport.topProducts || []).map((tp) => ({
          product_name: tp.productName,
          total_qty: tp.quantitySold,
          total_revenue: tp.revenue
        }))

        const mappedPayments = backendReport.paymentBreakdown ? [
          {
            method: 'CASH',
            total_amount: backendReport.paymentBreakdown.cashAmount || 0,
            count: backendReport.paymentBreakdown.cashCount || 0,
            percent: backendReport.paymentBreakdown.cashPercentage || 0
          },
          {
            method: 'CARD',
            total_amount: backendReport.paymentBreakdown.cardAmount || 0,
            count: backendReport.paymentBreakdown.cardCount || 0,
            percent: backendReport.paymentBreakdown.cardPercentage || 0
          }
        ].filter(p => p.count > 0 || p.total_amount > 0) : []

        const mappedCategories = (backendReport.categoryBreakdown || []).map((cb, idx) => ({
          category_name: cb.categoryName,
          color: ['#16a34a', '#2563eb', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#e11d48', '#10b981'][idx % 8],
          total_qty: cb.quantitySold,
          total_revenue: cb.revenue
        }))

        const mappedRecentOrders = (backendReport.recentOrders || []).map((o: any) => ({
          id: o.id,
          order_no: o.orderNo,
          created_at: o.createdAt,
          total_amount: o.totalAmount,
          discount_amount: o.discountAmount || 0,
          status: o.status || 'completed',
          items_count: (o.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0),
          payment_method: o.payments && o.payments.length > 0 ? o.payments[0].method : 'CASH'
        }))

        const totalSales = backendReport.totalSales || 0
        const totalCogs = backendReport.costOfGoodsSold || 0
        const grossProfit = totalSales - totalCogs
        const totalExpenses = backendReport.totalExpenses || 0
        const netProfit = grossProfit - totalExpenses
        const cashSales = backendReport.paymentBreakdown?.cashAmount || 0

        setAnalytics({
          period,
          startDate: backendReport.fromDate ? dayjs(backendReport.fromDate).format('YYYY-MM-DD') : selectedDate,
          endDate: backendReport.toDate ? dayjs(backendReport.toDate).format('YYYY-MM-DD') : selectedDate,
          summary: {
            total_orders: backendReport.orderCount || 0,
            total_revenue: totalSales,
            total_subtotal: totalSales + (backendReport.totalDiscount || 0),
            total_discount: backendReport.totalDiscount || 0,
            total_tax: backendReport.totalTax || 0,
            avg_order_value: backendReport.orderCount > 0 ? (totalSales / backendReport.orderCount) : 0,
            net_revenue: totalSales,
            total_cost: totalCogs,
            estimated_profit: grossProfit,
            profit_margin_pct: totalSales > 0 ? Number(((grossProfit / totalSales) * 100).toFixed(1)) : 0,
            total_items_sold: mappedTopProducts.reduce((sum, p) => sum + p.total_qty, 0),
            revenue_growth_pct: 0,
            orders_growth_pct: 0,
            prev_revenue: 0,
            prev_orders: 0
          },
          timeline: mappedTimeline.length > 0 ? mappedTimeline : generateEmptyTimeline(period, selectedDate, customStartDate, customEndDate),
          paymentBreakdown: mappedPayments,
          topProducts: mappedTopProducts,
          categoryBreakdown: mappedCategories,
          // Backend report has no per-item cost data, so only real sales figures are shown (no estimated COGS)
          itemBreakdown: mappedTopProducts.map((tp, idx) => ({
            product_id: `p-${idx}`,
            product_name: tp.product_name,
            item_code: '-',
            category_name: '-',
            avg_unit_price: tp.total_qty > 0 ? Math.round(tp.total_revenue / tp.total_qty) : 0,
            avg_cost_price: 0,
            total_qty: tp.total_qty,
            total_discount: 0,
            total_revenue: tp.total_revenue,
            total_cogs: 0,
            gross_profit: tp.total_revenue,
            margin_pct: 0,
            revenue_share_pct: totalSales > 0 ? Number(((tp.total_revenue / totalSales) * 100).toFixed(1)) : 0
          })),
          ownerMetrics: {
            grossProfit,
            grossProfitMargin: totalSales > 0 ? Number(((grossProfit / totalSales) * 100).toFixed(1)) : 0,
            totalExpenses,
            netProfit,
            netProfitMargin: totalSales > 0 ? Number(((netProfit / totalSales) * 100).toFixed(1)) : 0,
            expenseCategories: [],
            cashierPerformance: [],
            terminalPerformance: [],
            inventoryValuation: {
              totalProducts: 0,
              totalCostValue: 0,
              totalRetailValue: 0,
              potentialMarginValue: 0,
              lowStockCount: 0,
              outOfStockCount: 0
            },
            damageLoss: { cost: 0, quantity: 0, events: 0 },
            cashDrawer: {
              cashSales,
              cashExpenses: totalExpenses,
              netCashEstimated: cashSales - totalExpenses
            }
          },
          peakSlot: backendReport.peakSlot ? {
            label: backendReport.peakSlot.timeSlot,
            orders: backendReport.peakSlot.orderCount,
            revenue: backendReport.peakSlot.revenue
          } : null,
          recentOrders: mappedRecentOrders
        })
      } else {
        setAnalytics(generateEmptyAnalytics(period, selectedDate, customStartDate, customEndDate))
      }
    } catch (err) {
      console.warn('Analytics load error:', err)
      setAnalytics(generateEmptyAnalytics(period, selectedDate, customStartDate, customEndDate))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()

    // Real-time listeners: reload when new orders are created in POS or window regains focus
    const handleOrderEvent = () => {
      loadAnalytics()
    }
    window.addEventListener('pos:order-completed', handleOrderEvent)
    window.addEventListener('focus', handleOrderEvent)

    const intervalId = setInterval(() => {
      loadAnalytics()
    }, 15000)

    return () => {
      window.removeEventListener('pos:order-completed', handleOrderEvent)
      window.removeEventListener('focus', handleOrderEvent)
      clearInterval(intervalId)
    }
  }, [selectedBranchId, currentShop?.id, period, selectedDate, customStartDate, customEndDate])

  // Date Navigation Handlers
  const handlePrevPeriod = () => {
    const current = dayjs(selectedDate)
    if (period === 'daily') {
      setSelectedDate(current.subtract(1, 'day').format('YYYY-MM-DD'))
    } else if (period === 'weekly') {
      setSelectedDate(current.subtract(7, 'day').format('YYYY-MM-DD'))
    } else if (period === 'monthly') {
      setSelectedDate(current.subtract(1, 'month').format('YYYY-MM-DD'))
    }
  }

  const handleNextPeriod = () => {
    const current = dayjs(selectedDate)
    const today = dayjs()
    if (current.isBefore(today, 'day') || (period === 'monthly' && current.isBefore(today, 'month'))) {
      if (period === 'daily') {
        setSelectedDate(current.add(1, 'day').format('YYYY-MM-DD'))
      } else if (period === 'weekly') {
        setSelectedDate(current.add(7, 'day').format('YYYY-MM-DD'))
      } else if (period === 'monthly') {
        setSelectedDate(current.add(1, 'month').format('YYYY-MM-DD'))
      }
    }
  }

  const handleSetToday = () => {
    setSelectedDate(dayjs().format('YYYY-MM-DD'))
  }

  // Display label for current selected period
  const periodDisplayLabel = useMemo(() => {
    const d = dayjs(selectedDate)
    if (period === 'daily') {
      return d.format('dddd, DD MMMM YYYY')
    } else if (period === 'weekly') {
      const start = d.subtract(6, 'day')
      return `${start.format('DD MMM YYYY')} – ${d.format('DD MMM YYYY')} (7 Days)`
    } else if (period === 'monthly') {
      return d.format('MMMM YYYY')
    } else {
      return `${dayjs(customStartDate).format('DD MMM')} – ${dayjs(customEndDate).format('DD MMM YYYY')}`
    }
  }, [period, selectedDate, customStartDate, customEndDate])

  // ─── Export Tabular CSVs (Clean, single table per file, uniform columns) ───

  // 1. Product-wise Sales & Profit Performance (12 uniform columns)
  const handleExportProductsCSV = () => {
    if (!analytics) return
    const items = analytics.itemBreakdown || []
    if (items.length === 0) {
      message.warning('No product sales data to export for this period.')
      return
    }

    const rangeLabel = analytics.startDate === analytics.endDate
      ? analytics.startDate
      : `${analytics.startDate}_to_${analytics.endDate}`

    const headers = [
      'Item Code',
      'Product Name',
      'Category',
      'Units Sold',
      'Avg Selling Price (LKR)',
      'Avg Cost Price (LKR)',
      'Total Discounts (LKR)',
      'Gross Revenue (LKR)',
      'Total COGS (LKR)',
      'Gross Profit (LKR)',
      'Gross Margin %',
      'Revenue Share %'
    ]

    let totalQty = 0
    let totalDiscount = 0
    let totalRevenue = 0
    let totalCogs = 0
    let totalProfit = 0

    const rows: CsvRow[] = [headers]

    for (const i of items) {
      const q = Number(i.total_qty) || 0
      const d = Number(i.total_discount) || 0
      const r = Number(i.total_revenue) || 0
      const c = Number(i.total_cogs) || 0
      const p = Number(i.gross_profit) || 0

      totalQty += q
      totalDiscount += d
      totalRevenue += r
      totalCogs += c
      totalProfit += p

      rows.push([
        i.item_code || '',
        i.product_name || '',
        i.category_name || '',
        qty(q),
        money(i.avg_unit_price),
        money(i.avg_cost_price),
        money(d),
        money(r),
        money(c),
        money(p),
        pct(i.margin_pct),
        pct(i.revenue_share_pct)
      ])
    }

    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    rows.push([
      `TOTAL (${items.length} Products)`,
      '',
      '',
      qty(totalQty),
      '',
      '',
      money(totalDiscount),
      money(totalRevenue),
      money(totalCogs),
      money(totalProfit),
      pct(overallMargin),
      '100.0%'
    ])

    downloadCsv(`Product_Sales_Performance_${period}_${rangeLabel}.csv`, rows)
    message.success(`Product performance exported successfully (${items.length} products)`)
  }

  // 2. Completed Orders Ledger (12 uniform columns)
  const handleExportOrdersCSV = () => {
    if (!analytics) return
    const orders = analytics.recentOrders || []
    if (orders.length === 0) {
      message.warning('No completed orders to export for this period.')
      return
    }

    const rangeLabel = analytics.startDate === analytics.endDate
      ? analytics.startDate
      : `${analytics.startDate}_to_${analytics.endDate}`

    const headers = [
      'Order No',
      'Date',
      'Time',
      'Cashier',
      'Terminal',
      'Items Count',
      'Payment Method',
      'Subtotal (LKR)',
      'Discount (LKR)',
      'Tax (LKR)',
      'Total Amount (LKR)',
      'Status'
    ]

    let totalItems = 0
    let totalSubtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let totalAmount = 0

    const rows: CsvRow[] = [headers]

    for (const o of orders) {
      const itmCount = Number(o.items_count) || 0
      const sub = Number(o.subtotal ?? o.total_amount) || 0
      const disc = Number(o.discount_amount) || 0
      const tx = Number(o.tax_amount) || 0
      const tot = Number(o.total_amount) || 0

      totalItems += itmCount
      totalSubtotal += sub
      totalDiscount += disc
      totalTax += tx
      totalAmount += tot

      rows.push([
        o.order_no,
        csvDate(o.created_at),
        csvTime(o.created_at),
        o.cashier_name || 'Cashier',
        o.terminal_id || '',
        qty(itmCount),
        (o.payment_method || 'CASH').toUpperCase(),
        money(sub),
        money(disc),
        money(tx),
        money(tot),
        (o.status || 'completed').toUpperCase()
      ])
    }

    rows.push([
      `TOTAL (${orders.length} Orders)`,
      '',
      '',
      '',
      '',
      qty(totalItems),
      '',
      money(totalSubtotal),
      money(totalDiscount),
      money(totalTax),
      money(totalAmount),
      ''
    ])

    downloadCsv(`Completed_Orders_Ledger_${period}_${rangeLabel}.csv`, rows)
    message.success(`Orders ledger exported successfully (${orders.length} orders)`)
  }

  // 3. Sales Timeline Breakdown (6 uniform columns)
  const handleExportTimelineCSV = () => {
    if (!analytics) return
    const timeline = analytics.timeline || []
    if (timeline.length === 0) {
      message.warning('No timeline data to export for this period.')
      return
    }

    const rangeLabel = analytics.startDate === analytics.endDate
      ? analytics.startDate
      : `${analytics.startDate}_to_${analytics.endDate}`

    const headers = [
      period === 'daily' ? 'Hour Interval' : 'Date',
      'Completed Orders',
      'Gross Sales (LKR)',
      'Discounts (LKR)',
      'Net Revenue (LKR)',
      'Average Ticket (LKR)'
    ]

    let totalOrders = 0
    let totalGross = 0
    let totalDiscount = 0
    let totalRevenue = 0

    const rows: CsvRow[] = [headers]

    for (const t of timeline) {
      const ords = Number(t.orders) || 0
      const rev = Number(t.revenue) || 0
      const disc = Number(t.discount) || 0
      const gross = rev + disc

      totalOrders += ords
      totalGross += gross
      totalDiscount += disc
      totalRevenue += rev

      rows.push([
        period === 'daily' ? t.label : (t.date || t.label),
        qty(ords),
        money(gross),
        money(disc),
        money(rev),
        money(t.avgTicket)
      ])
    }

    const overallAov = totalOrders > 0 ? totalRevenue / totalOrders : 0

    rows.push([
      'TOTAL',
      qty(totalOrders),
      money(totalGross),
      money(totalDiscount),
      money(totalRevenue),
      money(overallAov)
    ])

    downloadCsv(`Sales_Timeline_${period}_${rangeLabel}.csv`, rows)
    message.success('Timeline breakdown exported successfully')
  }

  // 4. Executive Financial Summary (4 uniform columns)
  const handleExportSummaryCSV = () => {
    if (!analytics) return
    const s = analytics.summary
    const owner = analytics.ownerMetrics
    const rangeLabel = analytics.startDate === analytics.endDate
      ? analytics.startDate
      : `${analytics.startDate}_to_${analytics.endDate}`

    const headers = ['Financial Metric', 'Value', 'Unit', 'Notes']
    const rows: CsvRow[] = [
      headers,
      ['Completed Orders', qty(s.total_orders), 'Orders', 'Total paid transactions'],
      ['Items Sold', qty(s.total_items_sold), 'Units', 'Total quantity of units sold'],
      ['Gross Sales Subtotal', money(s.total_subtotal), 'LKR', 'Gross sales value before discounts'],
      ['Customer Discounts', money(s.total_discount), 'LKR', 'Promotions and order discounts'],
      ['Tax / VAT Collected', money(s.total_tax), 'LKR', 'Sales tax collected'],
      ['Net Sales Revenue', money(s.total_revenue), 'LKR', 'Gross Subtotal minus Discounts'],
      ['Cost of Goods Sold (COGS)', money(s.total_cost), 'LKR', 'Cost of goods sold based on recipe/inventory costs'],
      ['Gross Profit', money(s.estimated_profit), 'LKR', 'Net Revenue minus COGS'],
      ['Gross Profit Margin', pct(s.profit_margin_pct), '%', 'Gross profit percentage'],
      ['Operating Expenses', money(owner?.totalExpenses), 'LKR', 'Total recorded operating expenses'],
      ['Net Operating Profit', money(owner?.netProfit ?? s.estimated_profit), 'LKR', 'Gross Profit minus Operating Expenses'],
      ['Net Profit Margin', pct(owner?.netProfitMargin ?? s.profit_margin_pct), '%', 'Bottom line net profit margin'],
      ['Average Order Value (AOV)', money(s.avg_order_value), 'LKR', 'Average sales revenue per order ticket'],
      ['Physical Cash Sales', money(owner?.cashDrawer?.cashSales), 'LKR', 'Cash tenders received at register'],
      ['Physical Cash Paid Out', money(owner?.cashDrawer?.cashExpenses), 'LKR', 'Petty cash expenses paid out of drawer'],
      ['Net Cash in Drawer', money(owner?.cashDrawer?.netCashEstimated), 'LKR', 'Cash collected minus petty cash paid out']
    ]

    downloadCsv(`Financial_Executive_Summary_${period}_${rangeLabel}.csv`, rows)
    message.success('Financial summary exported successfully')
  }

  // Default export action (matches current active table tab)
  const handleExportCSV = () => {
    if (tableTab === 'items') {
      handleExportProductsCSV()
    } else {
      handleExportOrdersCSV()
    }
  }

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div style={{
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 16px',
          borderRadius: 10,
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
          border: '1px solid #334155',
          fontSize: 12,
          minWidth: 190
        }}>
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 8, borderBottom: '1px solid #1e293b', paddingBottom: 6 }}>
            {data.label}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 5 }}>
            <span style={{ color: '#94a3b8' }}>Revenue</span>
            <span style={{ fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(data.revenue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 5 }}>
            <span style={{ color: '#94a3b8' }}>Orders</span>
            <span style={{ fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{data.orders} bills</span>
          </div>
          {data.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 5 }}>
              <span style={{ color: '#94a3b8' }}>Discounts</span>
              <span style={{ fontWeight: 600, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(data.discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, paddingTop: 4, borderTop: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b' }}>Avg Ticket</span>
            <span style={{ fontWeight: 600, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(data.avgTicket)}</span>
          </div>
        </div>
      )
    }
    return null
  }

  // Filtered & Sorted Items for Item-Wise Breakdown
  const filteredAndSortedItems = useMemo(() => {
    if (!analytics?.itemBreakdown) return []
    let list = [...analytics.itemBreakdown]

    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase().trim()
      list = list.filter(
        (i) =>
          i.product_name.toLowerCase().includes(q) ||
          i.item_code.toLowerCase().includes(q) ||
          i.category_name.toLowerCase().includes(q)
      )
    }

    if (itemCategoryFilter !== 'ALL') {
      list = list.filter((i) => i.category_name === itemCategoryFilter)
    }

    list.sort((a, b) => {
      if (itemSortKey === 'qty') return b.total_qty - a.total_qty
      if (itemSortKey === 'profit') return b.gross_profit - a.gross_profit
      if (itemSortKey === 'margin') return b.margin_pct - a.margin_pct
      return b.total_revenue - a.total_revenue
    })

    return list
  }, [analytics?.itemBreakdown, itemSearch, itemCategoryFilter, itemSortKey])

  // Unique categories for the filter dropdown
  const uniqueCategories = useMemo(() => {
    if (!analytics?.itemBreakdown) return []
    const set = new Set<string>()
    analytics.itemBreakdown.forEach((i) => {
      if (i.category_name) set.add(i.category_name)
    })
    return Array.from(set)
  }, [analytics?.itemBreakdown])

  // Item summary quick stats
  const itemSummary = useMemo(() => {
    const items = analytics?.itemBreakdown || []
    const totalQty = items.reduce((sum, i) => sum + i.total_qty, 0)
    const uniqueCount = items.length
    const topRevenueItem = [...items].sort((a, b) => b.total_revenue - a.total_revenue)[0] || null
    const topProfitItem = [...items].sort((a, b) => b.gross_profit - a.gross_profit)[0] || null
    const topMarginItem = [...items].filter((i) => i.total_qty >= 2).sort((a, b) => b.margin_pct - a.margin_pct)[0] || null

    return {
      totalQty,
      uniqueCount,
      topRevenueItem,
      topProfitItem,
      topMarginItem
    }
  }, [analytics?.itemBreakdown])

  const owner = useMemo(() => {
    return analytics?.ownerMetrics || {
      grossProfit: 0,
      grossProfitMargin: 0,
      totalExpenses: 0,
      netProfit: 0,
      netProfitMargin: 0,
      expenseCategories: [],
      cashierPerformance: [],
      terminalPerformance: [],
      inventoryValuation: {
        totalProducts: 0,
        totalCostValue: 0,
        totalRetailValue: 0,
        potentialMarginValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0
      },
      damageLoss: {
        cost: 0,
        quantity: 0,
        events: 0
      },
      cashDrawer: {
        cashSales: 0,
        cashExpenses: 0,
        netCashEstimated: 0
      }
    }
  }, [analytics?.ownerMetrics])

  const isCurrentDayFuture = dayjs(selectedDate).isSame(dayjs(), 'day')

  return (
    <div className="page-container" style={{ overflowY: 'auto', padding: '18px 24px', gap: 16 }}>
      {/* Top View Mode Switcher: Store Sales & Item Analytics vs Owner's Executive Hub */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: '#ffffff',
        padding: '10px 16px',
        borderRadius: 14,
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        flexShrink: 0
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 10,
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setViewMode('store')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              borderRadius: 8,
              border: viewMode === 'store' ? '1px solid #e2e8f0' : '1px solid transparent',
              fontSize: 12.5,
              fontWeight: viewMode === 'store' ? 700 : 600,
              cursor: 'pointer',
              background: viewMode === 'store' ? '#ffffff' : 'transparent',
              color: viewMode === 'store' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'store' ? '0 1px 3px rgba(0, 0, 0, 0.06)' : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <BarChart3 size={15} style={{ color: viewMode === 'store' ? '#0f172a' : '#94a3b8' }} />
            <span>Store Sales &amp; Item Analysis</span>
          </button>

          <button
            onClick={() => setViewMode('owner')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              borderRadius: 8,
              border: viewMode === 'owner' ? '1px solid #0f172a' : '1px solid transparent',
              fontSize: 12.5,
              fontWeight: viewMode === 'owner' ? 700 : 600,
              cursor: 'pointer',
              background: viewMode === 'owner' ? '#0f172a' : 'transparent',
              color: viewMode === 'owner' ? '#ffffff' : '#64748b',
              boxShadow: viewMode === 'owner' ? '0 2px 6px rgba(15, 23, 42, 0.25)' : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <Crown size={15} style={{ color: viewMode === 'owner' ? '#e2e8f0' : '#94a3b8' }} />
            <span>Owner's Executive Hub</span>
            <span style={{
              background: viewMode === 'owner' ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
              color: viewMode === 'owner' ? '#ffffff' : '#475569',
              fontSize: 9.5,
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.04em'
            }}>
              P&amp;L
            </span>
          </button>
        </div>

        {/* Branch Filter Switcher for Multi-Branch / Owner */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#f8fafc',
          padding: '4px',
          borderRadius: 10,
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setSelectedBranchId('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: selectedBranchId === 'all' ? '1px solid #0f172a' : '1px solid transparent',
              fontSize: 12,
              fontWeight: selectedBranchId === 'all' ? 700 : 500,
              cursor: 'pointer',
              background: selectedBranchId === 'all' ? '#0f172a' : 'transparent',
              color: selectedBranchId === 'all' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            <Building2 size={13} />
            <span>All Branches (සියල්ල)</span>
          </button>

          <button
            onClick={() => setSelectedBranchId('b0000000-0000-0000-0000-000000000001')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: selectedBranchId === 'b0000000-0000-0000-0000-000000000001' ? '1px solid #16a34a' : '1px solid transparent',
              fontSize: 12,
              fontWeight: selectedBranchId === 'b0000000-0000-0000-0000-000000000001' ? 700 : 500,
              cursor: 'pointer',
              background: selectedBranchId === 'b0000000-0000-0000-0000-000000000001' ? '#16a34a' : 'transparent',
              color: selectedBranchId === 'b0000000-0000-0000-0000-000000000001' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🏢 Katugastota (B1)</span>
          </button>

          <button
            onClick={() => setSelectedBranchId('b0000000-0000-0000-0000-000000000002')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? '1px solid #ea580c' : '1px solid transparent',
              fontSize: 12,
              fontWeight: selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? 700 : 500,
              cursor: 'pointer',
              background: selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? '#ea580c' : 'transparent',
              color: selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🎂 Poojapitiya (B2)</span>
          </button>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11.5,
          fontWeight: 700,
          color: '#475569',
          background: '#f8fafc',
          padding: '5px 12px',
          borderRadius: 8,
          border: '1px solid #e2e8f0'
        }}>
          <ShieldCheck size={14} style={{ color: '#16a34a' }} />
          <span>{viewMode === 'store' ? 'Operational Level Analytics' : 'C-Suite Financial Intelligence'}</span>
        </div>
      </div>

      {/* ── Page Header ── */}
      <div className="page-header" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 14, flexShrink: 0 }}>
        {/* Title & Branch */}
        <div style={{ minWidth: 260, flex: '1 1 auto' }}>
          <div className="page-title" style={{ fontSize: 20 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: viewMode === 'store'
                ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: viewMode === 'store' ? '#2563eb' : '#d97706',
              boxShadow: viewMode === 'store'
                ? '0 2px 6px rgba(37, 99, 235, 0.15)'
                : '0 2px 6px rgba(217, 119, 6, 0.15)',
              border: viewMode === 'store' ? '1px solid #bfdbfe' : '1px solid #fde68a'
            }}>
              {viewMode === 'store' ? <BarChart3 size={20} /> : <Crown size={20} />}
            </div>
            <span>{viewMode === 'store' ? 'Sales & Revenue Analytics' : "Owner's Executive Business Hub"}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: viewMode === 'store' ? '#1e40af' : '#b45309',
              background: viewMode === 'store' ? '#eff6ff' : '#fef3c7',
              border: viewMode === 'store' ? '1px solid #bfdbfe' : '1px solid #fde68a',
              padding: '2px 8px',
              borderRadius: 99,
              marginLeft: 4
            }}>
              {periodDisplayLabel}
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            {viewMode === 'store'
              ? 'Performance Insights, Item Breakdown, and Store Activity'
              : 'Profit & Loss, Operational Outflow, Cash Drawer & Staff Audit'} ·{' '}
            <span style={{
              color: selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? '#ea580c' : (selectedBranchId === 'all' ? '#0f172a' : '#16a34a'),
              fontWeight: 700,
              background: selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? '#fff7ed' : (selectedBranchId === 'all' ? '#f1f5f9' : '#f0fdf4'),
              padding: '1px 8px',
              borderRadius: 6,
              border: `1px solid ${selectedBranchId === 'b0000000-0000-0000-0000-000000000002' ? '#fed7aa' : (selectedBranchId === 'all' ? '#e2e8f0' : '#bbf7d0')}`
            }}>
              {selectedBranchId === 'all'
                ? '🏢 All Branches Combined (සියලුම ශාඛා)'
                : selectedBranchId === 'b0000000-0000-0000-0000-000000000002'
                ? '🎂 Wasana Cake - Poojapitiya (B2)'
                : '🏢 Wasana Cake - Katugastota (B1)'}
            </span>
          </div>
        </div>

        {/* Period Selector Tabs (Daily, Weekly, Monthly, Custom) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: 3,
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            {[
              { key: 'daily', label: 'Daily', icon: <Clock size={13} /> },
              { key: 'weekly', label: 'Weekly', icon: <CalendarDays size={13} /> },
              { key: 'monthly', label: 'Monthly', icon: <Calendar size={13} /> },
              { key: 'custom', label: 'Custom', icon: <CalendarRange size={13} /> }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriod(tab.key as PeriodType)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: period === tab.key ? '1px solid #e2e8f0' : '1px solid transparent',
                  fontSize: 12,
                  fontWeight: period === tab.key ? 700 : 500,
                  cursor: 'pointer',
                  background: period === tab.key ? '#ffffff' : 'transparent',
                  color: period === tab.key ? '#0f172a' : '#64748b',
                  boxShadow: period === tab.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Date Navigator */}
          {period !== 'custom' ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#f8fafc',
              padding: '3px 6px',
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={handlePrevPeriod}
                title="Previous Period"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569'
                }}
              >
                <ChevronLeft size={14} />
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
                fontSize: 12,
                fontWeight: 700,
                color: '#0f172a'
              }}>
                <Calendar size={13} style={{ color: '#475569' }} />
                <span>{periodDisplayLabel}</span>
              </div>

              <button
                onClick={handleNextPeriod}
                disabled={isCurrentDayFuture && period === 'daily'}
                title="Next Period"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  cursor: isCurrentDayFuture && period === 'daily' ? 'not-allowed' : 'pointer',
                  opacity: isCurrentDayFuture && period === 'daily' ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569'
                }}
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={handleSetToday}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#0f172a',
                  marginLeft: 2
                }}
              >
                Today
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#0f172a'
                }}
              />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#0f172a'
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshButton onClick={loadAnalytics} isLoading={loading} label="" />

            <button
              onClick={() => setShowReportGen(true)}
              style={{
                height: 38,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 16px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.92'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.25)'
              }}
              title="Generate Official Business Report (වාර්තා සැකසීම)"
            >
              <FileText size={15} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>Generate Report</span>
            </button>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'current',
                    label: tableTab === 'items'
                      ? '📊 Product Sales & Profit (Current View)'
                      : '🧾 Completed Orders Ledger (Current View)',
                    onClick: handleExportCSV
                  },
                  {
                    type: 'divider'
                  },
                  {
                    key: 'products',
                    label: '📊 Product-wise Sales & Profit (භාණ්ඩ අනුව ලාභ)',
                    onClick: handleExportProductsCSV
                  },
                  {
                    key: 'orders',
                    label: '🧾 Completed Orders Ledger (සියලු ඇණවුම්)',
                    onClick: handleExportOrdersCSV
                  },
                  {
                    key: 'timeline',
                    label: '📈 Sales Timeline Breakdown (කාලීන විකුණුම්)',
                    onClick: handleExportTimelineCSV
                  },
                  {
                    key: 'summary',
                    label: '💼 Financial Executive Summary (මූල්‍ය සාරාංශය)',
                    onClick: handleExportSummaryCSV
                  }
                ]
              }}
              placement="bottomRight"
            >
              <button
                onClick={handleExportCSV}
                style={{
                  height: 38,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.color = 'var(--primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title="Export Clean Tabular CSV (CSV බාගත කරගැනීම)"
              >
                <Download size={14} style={{ color: 'inherit' }} />
                <span>CSV</span>
              </button>
            </Dropdown>

            <button
              onClick={() => window.print()}
              style={{
                height: 38,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: '#ffffff',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0f172a'
                e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              <Printer size={14} style={{ color: 'inherit' }} />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* ───── VIEW MODE 1: STORE SALES & ITEM-WISE PERFORMANCE ───── */}
      {viewMode === 'store' && (
        <>
          {/* Interactive Clickable KPI Cards Grid - Clean, Cohesive, Minimalist Styling */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14
          }}>
            {/* Card 1: Total Revenue */}
            <div
              onClick={() => setDetailModal('revenue')}
              role="button"
              tabIndex={0}
              style={{
                background: '#ffffff',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid #e8ecf1',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(15, 23, 42, 0.07)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                e.currentTarget.style.borderColor = '#e8ecf1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Revenue
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155'
                }}>
                  <DollarSign size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(analytics?.summary?.total_revenue || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                {analytics && analytics.summary.revenue_growth_pct >= 0 ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: '#059669',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontWeight: 700
                  }}>
                    <ArrowUpRight size={12} /> +{analytics.summary.revenue_growth_pct}%
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: '#e11d48',
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontWeight: 700
                  }}>
                    <ArrowDownRight size={12} /> {analytics?.summary.revenue_growth_pct}%
                  </span>
                )}
                <span style={{ color: '#64748b', fontWeight: 500 }}>{analytics?.summary?.total_orders || 0} bills</span>
              </div>
            </div>

            {/* Card 2: Operating Expenses */}
            <div
              onClick={() => setDetailModal('expenses')}
              role="button"
              tabIndex={0}
              style={{
                background: '#ffffff',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid #e8ecf1',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(15, 23, 42, 0.07)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                e.currentTarget.style.borderColor = '#e8ecf1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Operating Expenses
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155'
                }}>
                  <TrendingDown size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(analytics?.ownerMetrics?.totalExpenses || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  padding: '2px 7px',
                  borderRadius: 6,
                  fontWeight: 600
                }}>
                  {analytics?.ownerMetrics?.expenseCategories?.length || 0} categories
                </span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>
                  Paid: {formatCurrency(analytics?.ownerMetrics?.cashDrawer?.cashExpenses || analytics?.ownerMetrics?.totalExpenses || 0)}
                </span>
              </div>
            </div>

            {/* Card 3: Net Profit */}
            <div
              onClick={() => setDetailModal('profit')}
              role="button"
              tabIndex={0}
              style={{
                background: '#ffffff',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid #e8ecf1',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(15, 23, 42, 0.07)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                e.currentTarget.style.borderColor = '#e8ecf1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Net Profit (Bottom Line)
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155'
                }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: (analytics?.ownerMetrics?.netProfit || 0) >= 0 ? '#0f172a' : '#e11d48', letterSpacing: '-0.03em', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(analytics?.ownerMetrics?.netProfit ?? analytics?.summary?.estimated_profit ?? 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{
                  background: (analytics?.ownerMetrics?.netProfitMargin || 0) >= 15 ? '#f0fdf4' : '#fff1f2',
                  border: `1px solid ${(analytics?.ownerMetrics?.netProfitMargin || 0) >= 15 ? '#bbf7d0' : '#fecdd3'}`,
                  color: (analytics?.ownerMetrics?.netProfitMargin || 0) >= 15 ? '#059669' : '#e11d48',
                  padding: '2px 7px',
                  borderRadius: 6,
                  fontWeight: 700
                }}>
                  {analytics?.ownerMetrics?.netProfitMargin ?? analytics?.summary?.profit_margin_pct ?? 0}% Net Margin
                </span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>
                  Take-home
                </span>
              </div>
            </div>

            {/* Card 4: Inventory Valuation */}
            <div
              onClick={() => setDetailModal('inventory')}
              role="button"
              tabIndex={0}
              style={{
                background: '#ffffff',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid #e8ecf1',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(15, 23, 42, 0.07)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                e.currentTarget.style.borderColor = '#e8ecf1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Stock Value (At Cost)
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155'
                }}>
                  <Package size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(analytics?.ownerMetrics?.inventoryValuation?.totalCostValue || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                {(analytics?.ownerMetrics?.inventoryValuation?.lowStockCount || 0) > 0 ? (
                  <span style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontWeight: 700
                  }}>
                    ⚠ {analytics?.ownerMetrics?.inventoryValuation?.lowStockCount} Low Stock
                  </span>
                ) : (
                  <span style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#059669',
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontWeight: 700
                  }}>
                    ✓ Stock Healthy
                  </span>
                )}
                <span style={{ color: '#64748b', fontWeight: 500 }}>
                  Retail: {formatCurrency(analytics?.ownerMetrics?.inventoryValuation?.totalRetailValue || 0)}
                </span>
              </div>
            </div>

            {/* Card 5: Total Orders */}
            <div
              onClick={() => setDetailModal('orders')}
              role="button"
              tabIndex={0}
              style={{
                background: '#ffffff',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid #e8ecf1',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(15, 23, 42, 0.07)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                e.currentTarget.style.borderColor = '#e8ecf1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Orders &amp; Avg Ticket
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155'
                }}>
                  <Receipt size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {analytics?.summary?.total_orders || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  padding: '2px 7px',
                  borderRadius: 6,
                  fontWeight: 600
                }}>
                  AOV: {formatCurrency(analytics?.summary?.avg_order_value || 0)}
                </span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>per bill</span>
              </div>
            </div>

            {/* Card 6: Cash in Register */}
            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{
                background: '#ffffff',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid #e8ecf1',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(15, 23, 42, 0.07)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                e.currentTarget.style.borderColor = '#e8ecf1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cash In Register
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155'
                }}>
                  <Wallet size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(analytics?.ownerMetrics?.cashDrawer?.netCashEstimated || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: '#059669', fontWeight: 600 }}>+{formatCurrency(analytics?.ownerMetrics?.cashDrawer?.cashSales || 0)}</span>
                <span style={{ color: '#cbd5e1' }}>/</span>
                <span style={{ color: '#e11d48', fontWeight: 600 }}>-{formatCurrency(analytics?.ownerMetrics?.cashDrawer?.cashExpenses || 0)}</span>
              </div>
            </div>
          </div>

      {/* Main Interactive Chart Section */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
      }}>
        {/* Chart Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Sales &amp; Revenue Progression
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>
              {period === 'daily' && 'Hourly sales velocity and transaction distribution'}
              {period === 'weekly' && 'Daily revenue trends over the 7-day period'}
              {period === 'monthly' && 'Full month day-by-day revenue pattern'}
              {period === 'custom' && 'Timeline breakdown across custom dates'}
            </p>
          </div>

          {/* Chart View Switcher */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: 3,
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => setChartMode('revenue')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: chartMode === 'revenue' ? '1px solid #cbd5e1' : '1px solid transparent',
                fontSize: 12,
                fontWeight: chartMode === 'revenue' ? 700 : 600,
                cursor: 'pointer',
                background: chartMode === 'revenue' ? '#ffffff' : 'transparent',
                color: chartMode === 'revenue' ? '#0f172a' : '#64748b',
                boxShadow: chartMode === 'revenue' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Revenue (Rs.)
            </button>
            <button
              onClick={() => setChartMode('orders')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: chartMode === 'orders' ? '1px solid #cbd5e1' : '1px solid transparent',
                fontSize: 12,
                fontWeight: chartMode === 'orders' ? 700 : 600,
                cursor: 'pointer',
                background: chartMode === 'orders' ? '#ffffff' : 'transparent',
                color: chartMode === 'orders' ? '#0f172a' : '#64748b',
                boxShadow: chartMode === 'orders' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Orders Count
            </button>
            <button
              onClick={() => setChartMode('both')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: chartMode === 'both' ? '1px solid #cbd5e1' : '1px solid transparent',
                fontSize: 12,
                fontWeight: chartMode === 'both' ? 700 : 600,
                cursor: 'pointer',
                background: chartMode === 'both' ? '#ffffff' : 'transparent',
                color: chartMode === 'both' ? '#0f172a' : '#64748b',
                boxShadow: chartMode === 'both' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Combined View
            </button>
          </div>
        </div>

        {/* Visual Graph Canvas */}
        <div style={{ width: '100%', height: 320 }}>
          {analytics && analytics.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'orders' ? (
                <BarChart data={analytics.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="orders" name="Orders" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              ) : (
                <AreaChart data={analytics.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.16} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#334155" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#334155" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                  />
                  {chartMode === 'both' && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                  )}
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                    activeDot={{ r: 5, stroke: '#0f766e', strokeWidth: 2, fill: '#ffffff' }}
                  />
                  {chartMode === 'both' && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      name="Orders"
                      stroke="#475569"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#ordersGrad)"
                    />
                  )}
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94a3b8'
            }}>
              <BarChart3 size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No sales recorded for this period</div>
            </div>
          )}
        </div>

        {/* Highlights Bar underneath chart */}
        {analytics?.peakSlot && analytics.peakSlot.revenue > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
            padding: '10px 16px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid #e2e8f0'
            }}>
              <Sparkles size={15} />
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              <strong style={{ color: '#0f172a' }}>Peak Performance Window:</strong> Highest sales occurred at{' '}
              <strong style={{ color: '#0f172a' }}>{analytics.peakSlot.label}</strong> generating{' '}
              <strong style={{ color: '#0f172a' }}>{formatCurrency(analytics.peakSlot.revenue)}</strong> across{' '}
              <strong style={{ color: '#0f172a' }}>{analytics.peakSlot.orders} orders</strong>.
            </div>
          </div>
        )}
      </div>

      {/* Secondary Visual Breakdowns Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16
      }}>
        {/* Payment Methods Breakdown */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 20,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              Payment Methods
            </h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              {analytics?.paymentBreakdown.reduce((sum, p) => sum + p.count, 0)} Total Payments
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            {/* Donut Chart */}
            <div style={{ width: 125, height: 125, flexShrink: 0 }}>
              {analytics && analytics.paymentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.paymentBreakdown}
                      dataKey="total_amount"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={3}
                    >
                      {analytics.paymentBreakdown.map((entry) => (
                        <Cell
                          key={entry.method}
                          fill={PAYMENT_COLORS[entry.method] || '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8' }}>
                  No Data
                </div>
              )}
            </div>

            {/* Payment List Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              {['CASH', 'CARD', 'TRANSFER', 'MIXED'].map((method) => {
                const found = analytics?.paymentBreakdown.find((p) => p.method === method)
                const amount = found?.total_amount || 0
                const percent = found?.percent || 0
                const count = found?.count || 0
                const color = PAYMENT_COLORS[method] || '#64748b'

                return (
                  <div key={method} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'flex' }}>{PAYMENT_ICONS[method]}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                        {method}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(amount)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                        {count} txns · <strong style={{ color }}>{percent}%</strong>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 20,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em' }}>
              <Award size={16} color="#334155" />
              Top Selling Products
            </h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              By Revenue
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analytics?.topProducts && analytics.topProducts.length > 0 ? (
              analytics.topProducts.slice(0, 5).map((prod, idx) => {
                const maxRev = analytics.topProducts[0]?.total_revenue || 1
                const pct = Math.round((prod.total_revenue / maxRev) * 100)

                return (
                  <div key={prod.product_name} style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: idx === 0 ? '#0f172a' : '#f1f5f9',
                          color: idx === 0 ? '#ffffff' : '#475569',
                          border: idx === 0 ? 'none' : '1px solid #e2e8f0',
                          fontSize: 10,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.product_name}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(prod.total_revenue)}
                        </span>
                        <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>
                          ({prod.total_qty} sold)
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: idx === 0 ? '#0f766e' : '#64748b',
                        borderRadius: 99,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                No product sales recorded in this period
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 20,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em' }}>
              <Layers size={16} color="#334155" />
              Category Distribution
            </h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              Sales Share
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
              analytics.categoryBreakdown.map((cat) => {
                const totalRev = analytics.summary.total_revenue || 1
                const pct = ((cat.total_revenue / totalRev) * 100).toFixed(1)

                return (
                  <div key={cat.category_name} style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: 99,
                          background: '#334155'
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                          {cat.category_name}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(cat.total_revenue)}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          marginLeft: 6
                        }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: '#334155',
                        borderRadius: 99,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                No category data for this period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Chronological Breakdown & Recent Transactions */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: 20,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        marginBottom: 20
      }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 14,
          marginBottom: 16
        }}>
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: 3,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            gap: 2
          }}>
            <button
              onClick={() => setTableTab('items')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: tableTab === 'items' ? '1px solid #cbd5e1' : '1px solid transparent',
                fontSize: 12,
                fontWeight: tableTab === 'items' ? 700 : 600,
                cursor: 'pointer',
                background: tableTab === 'items' ? '#ffffff' : 'transparent',
                color: tableTab === 'items' ? '#0f172a' : '#64748b',
                boxShadow: tableTab === 'items' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Package size={14} />
              <span>Item-Wise Performance Breakdown ({filteredAndSortedItems.length})</span>
            </button>
            <button
              onClick={() => setTableTab('orders')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: tableTab === 'orders' ? '1px solid #cbd5e1' : '1px solid transparent',
                fontSize: 12,
                fontWeight: tableTab === 'orders' ? 700 : 600,
                cursor: 'pointer',
                background: tableTab === 'orders' ? '#ffffff' : 'transparent',
                color: tableTab === 'orders' ? '#0f172a' : '#64748b',
                boxShadow: tableTab === 'orders' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Receipt size={14} />
              <span>Completed Orders Log ({analytics?.recentOrders?.length || 0})</span>
            </button>
          </div>

          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
            {periodDisplayLabel}
          </span>
        </div>

        {/* Tab 1: Item-Wise Sales & Profit Performance Breakdown Table */}
        {tableTab === 'items' && (
          <div>
            {/* Quick Item Performance Highlights */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 16
            }}>
              <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Units Sold
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {itemSummary.totalQty} units
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  across {itemSummary.uniqueCount} unique menu items
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Top Revenue Generator
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {itemSummary.topRevenueItem?.product_name || 'None'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {itemSummary.topRevenueItem ? formatCurrency(itemSummary.topRevenueItem.total_revenue) : '-'} ({itemSummary.topRevenueItem?.total_qty || 0} sold)
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Most Profitable Item
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {itemSummary.topProfitItem?.product_name || 'None'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Profit: {itemSummary.topProfitItem ? formatCurrency(itemSummary.topProfitItem.gross_profit) : '-'}
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Highest Margin Product
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {itemSummary.topMarginItem?.product_name || 'None'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {itemSummary.topMarginItem?.margin_pct || 0}% Gross Margin
                </div>
              </div>
            </div>

            {/* Interactive Search & Filter Controls */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              padding: '10px 14px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                {/* Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  flex: 1,
                  maxWidth: 320
                }}>
                  <Search size={14} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Search item name or code..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: 12,
                      width: '100%',
                      color: '#0f172a'
                    }}
                  />
                  {itemSearch && (
                    <button
                      onClick={() => setItemSearch('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                {uniqueCategories.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={13} color="#64748b" />
                    <select
                      value={itemCategoryFilter}
                      onChange={(e) => setItemCategoryFilter(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="ALL">All Categories</option>
                      {uniqueCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Sort By Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Sort:</span>
                {[
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'qty', label: 'Units Sold' },
                  { key: 'profit', label: 'Profit' },
                  { key: 'margin', label: 'Margin %' }
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setItemSortKey(s.key as any)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: itemSortKey === s.key ? '#0f172a' : '#cbd5e1',
                      background: itemSortKey === s.key ? '#0f172a' : '#ffffff',
                      color: itemSortKey === s.key ? '#ffffff' : '#64748b',
                      fontSize: 11,
                      fontWeight: itemSortKey === s.key ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Performance Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#475569', width: 60, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Code
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Product / Item Name
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Category
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Price / Cost
                    </th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: '#475569', width: 120, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Units Sold
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Revenue
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      COGS Cost
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Gross Profit
                    </th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Margin %
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedItems.length > 0 ? (
                    filteredAndSortedItems.map((item, idx) => {
                      const maxQty = filteredAndSortedItems[0]?.total_qty || 1
                      const qtyBarWidth = Math.min(100, Math.round((item.total_qty / maxQty) * 100))

                      return (
                        <tr
                          key={item.product_id || item.product_name + idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>
                            <span style={{
                              fontSize: 10,
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid #e2e8f0',
                              color: '#475569'
                            }}>
                              {item.item_code || idx + 1}
                            </span>
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                                {item.product_name}
                              </span>
                              {idx === 0 && (
                                <span style={{
                                  background: '#0f172a',
                                  color: '#ffffff',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  letterSpacing: '0.03em'
                                }}>
                                  TOP SELLER
                                </span>
                              )}
                              {item.margin_pct >= 50 && (
                                <span style={{
                                  background: '#f0fdf4',
                                  color: '#059669',
                                  border: '1px solid #bbf7d0',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4
                                }}>
                                  HIGH MARGIN
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>
                            <span style={{
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11
                            }}>
                              {item.category_name}
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(item.avg_unit_price)}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>
                              Cost: {formatCurrency(item.avg_cost_price)}
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                              {item.total_qty}
                            </div>
                            <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${qtyBarWidth}%`,
                                background: idx === 0 ? '#0f766e' : '#64748b',
                                borderRadius: 99
                              }} />
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(item.total_revenue)}
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(item.total_cogs)}
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: item.gross_profit >= 0 ? '#059669' : '#e11d48', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(item.gross_profit)}
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              color: '#0f172a'
                            }}>
                              {item.margin_pct}%
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {item.revenue_share_pct}%
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <Package size={28} color="#cbd5e1" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>No item sales recorded matching your filters</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Totals Summary Footer */}
                {filteredAndSortedItems.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 800 }}>
                      <td colSpan={4} style={{ padding: '12px 14px', color: '#0f172a' }}>
                        TOTALS ({filteredAndSortedItems.length} Products Displayed)
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#0f172a', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {filteredAndSortedItems.reduce((sum, i) => sum + i.total_qty, 0)} units
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#0f172a', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(filteredAndSortedItems.reduce((sum, i) => sum + i.total_revenue, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(filteredAndSortedItems.reduce((sum, i) => sum + i.total_cogs, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(filteredAndSortedItems.reduce((sum, i) => sum + i.gross_profit, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#0f172a' }}>
                        {(() => {
                          const rev = filteredAndSortedItems.reduce((sum, i) => sum + i.total_revenue, 0)
                          const prof = filteredAndSortedItems.reduce((sum, i) => sum + i.gross_profit, 0)
                          return rev > 0 ? `${((prof / rev) * 100).toFixed(1)}%` : '0%'
                        })()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#0f172a' }}>
                        {(() => {
                          const shareSum = filteredAndSortedItems.reduce((sum, i) => sum + i.revenue_share_pct, 0)
                          return `${Math.min(100, Math.round(shareSum))}%`
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Individual Completed Orders Log */}
        {tableTab === 'orders' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Order No.</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Time</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Items</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Payment</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Discount</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Total Amount</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.recentOrders && analytics.recentOrders.length > 0 ? (
                  analytics.recentOrders.map((ord, idx) => (
                    <tr
                      key={ord.id || ord.order_no}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafbfc'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                        {ord.order_no}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        {formatDateTime(ord.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                        {ord.items_count || 1} items
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#0f172a'
                        }}>
                          {PAYMENT_ICONS[ord.payment_method] || null}
                          {ord.payment_method}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        {ord.discount_amount > 0 ? formatCurrency(ord.discount_amount) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(ord.total_amount)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          background: '#f0fdf4',
                          color: '#059669',
                          border: '1px solid #bbf7d0',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>
                          COMPLETED
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                      No orders completed in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* ───── VIEW MODE 2: OWNER'S EXECUTIVE BUSINESS INTELLIGENCE HUB ───── */}
      {viewMode === 'owner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Multi-Branch Executive Comparison (ශාඛා කාර්යසාධනය වෙන වෙනම) ── */}
          {analytics?.branchBreakdown && analytics.branchBreakdown.length > 0 && (
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              padding: 24,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={20} color="#0f172a" />
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                      Multi-Branch Executive Breakdown (ශාඛා මට්ටමේ සාරාංශය)
                    </h3>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      background: '#eff6ff',
                      color: '#2563eb',
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid #bfdbfe'
                    }}>
                      {analytics.branchBreakdown.length} Active Branches
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0' }}>
                    Revenue, net profit, operating expenses, and cash in drawer comparison for {periodDisplayLabel}.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedBranchId('all')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: selectedBranchId === 'all' ? 700 : 500,
                      border: selectedBranchId === 'all' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      background: selectedBranchId === 'all' ? '#0f172a' : '#ffffff',
                      color: selectedBranchId === 'all' ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Combined (සියල්ල)
                  </button>
                  {analytics.branchBreakdown.map((b) => (
                    <button
                      key={b.shopId}
                      onClick={() => setSelectedBranchId(b.shopId)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: selectedBranchId === b.shopId ? 700 : 500,
                        border: `1px solid ${b.branchCode === 'B1' ? '#16a34a' : '#ea580c'}`,
                        background: selectedBranchId === b.shopId ? (b.branchCode === 'B1' ? '#16a34a' : '#ea580c') : '#ffffff',
                        color: selectedBranchId === b.shopId ? '#ffffff' : (b.branchCode === 'B1' ? '#16a34a' : '#ea580c'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {b.branchCode === 'B1' ? '🏢 Katugastota (B1)' : '🎂 Poojapitiya (B2)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 16
              }}>
                {analytics.branchBreakdown.map((b) => {
                  const isSelected = selectedBranchId === b.shopId
                  const isB1 = b.branchCode === 'B1'
                  const accentColor = isB1 ? '#16a34a' : '#ea580c'
                  const accentBg = isB1 ? '#f0fdf4' : '#fff7ed'
                  const accentBorder = isB1 ? '#bbf7d0' : '#fed7aa'

                  return (
                    <div
                      key={b.shopId}
                      style={{
                        background: '#ffffff',
                        borderRadius: 12,
                        border: isSelected ? `2px solid ${accentColor}` : '1px solid #e2e8f0',
                        boxShadow: isSelected ? `0 6px 20px ${accentColor}25` : '0 1px 3px rgba(0,0,0,0.04)',
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      {/* Branch Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              background: accentBg,
                              border: `1px solid ${accentBorder}`,
                              color: accentColor,
                              fontWeight: 800,
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 6
                            }}>
                              {b.branchCode}
                            </span>
                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                              {b.shopName}
                            </h4>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                            {b.address || 'Wasana Cake'} · Phone: <strong>{b.phone || '071-1172201'}</strong>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedBranchId(isSelected ? 'all' : b.shopId)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            border: `1px solid ${accentColor}`,
                            background: isSelected ? accentColor : '#ffffff',
                            color: isSelected ? '#ffffff' : accentColor,
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? '✓ Viewing This Branch' : 'Isolate This Branch'}
                        </button>
                      </div>

                      {/* 4 Financial Tiles */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Gross Revenue
                          </div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(b.totalRevenue)}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {b.totalOrders} orders (Avg: {formatCurrency(b.avgTicket)})
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Expenses Paid
                          </div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: '#e11d48', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(b.totalExpenses)}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Operational &amp; Petty Cash
                          </div>
                        </div>

                        <div style={{ background: b.netProfit >= 0 ? '#f0fdf4' : '#fff1f2', padding: 12, borderRadius: 8, border: `1px solid ${b.netProfit >= 0 ? '#dcfce7' : '#ffe4e6'}` }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: b.netProfit >= 0 ? '#15803d' : '#be123c', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Net Profit
                          </div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: b.netProfit >= 0 ? '#15803d' : '#be123c', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(b.netProfit)}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: b.netProfit >= 0 ? '#15803d' : '#be123c', marginTop: 2 }}>
                            {b.netProfitMargin}% Net Margin
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Cash in Drawer
                          </div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: b.netCashInDrawer >= 0 ? '#0f766e' : '#e11d48', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(b.netCashInDrawer)}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Cash Sales: {formatCurrency(b.cashSales)}
                          </div>
                        </div>
                      </div>

                      {/* Stock & Catalog snapshot */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f8fafc',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div><strong style={{ color: '#0f172a' }}>{b.totalProducts}</strong> <span style={{ color: '#64748b' }}>Products</span></div>
                          <div><strong style={{ color: '#0f172a' }}>{formatCurrency(b.inventoryCostValue)}</strong> <span style={{ color: '#64748b' }}>Stock Cost</span></div>
                        </div>
                        <div>
                          {b.lowStockCount > 0 ? (
                            <span style={{ color: '#d97706', fontWeight: 700, background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>
                              ⚠ {b.lowStockCount} Low Stock
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '2px 8px', borderRadius: 4 }}>
                              ✓ Stock Healthy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── P&L Scoreboard Card ── */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: 24,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Crown size={18} color="#0f172a" />
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Executive Profit &amp; Loss (P&amp;L) Statement
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                  Comprehensive financial summary for {periodDisplayLabel}.
                </p>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                borderRadius: 6,
                background: owner.netProfit >= 0 ? '#f0fdf4' : '#fff1f2',
                border: `1px solid ${owner.netProfit >= 0 ? '#bbf7d0' : '#fecdd3'}`,
                color: owner.netProfit >= 0 ? '#059669' : '#e11d48',
                fontSize: 12, fontWeight: 700
              }}>
                <ShieldCheck size={14} />
                <span>Net Margin: {owner.netProfitMargin}%</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div
                onClick={() => setDetailModal('revenue')}
                role="button"
                tabIndex={0}
                style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>1. Gross Revenue ↗</span>
                  <DollarSign size={15} color="#0f172a" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(analytics?.summary?.total_revenue || 0)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{analytics?.summary?.total_orders || 0} completed orders</div>
              </div>

              <div
                onClick={() => setDetailModal('profit')}
                role="button"
                tabIndex={0}
                style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>2. Product Cost (COGS) ↗</span>
                  <Layers size={15} color="#475569" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(analytics?.summary?.total_cost || 0)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Direct ingredient &amp; production cost</div>
              </div>

              <div
                onClick={() => setDetailModal('profit')}
                role="button"
                tabIndex={0}
                style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>3. Gross Profit ↗</span>
                  <TrendingUp size={15} color="#059669" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.grossProfit)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Gross Margin: <strong style={{ color: '#059669' }}>{owner.grossProfitMargin}%</strong></div>
              </div>

              <div
                onClick={() => setDetailModal('expenses')}
                role="button"
                tabIndex={0}
                style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>4. Operating Expenses ↗</span>
                  <TrendingDown size={15} color="#64748b" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.totalExpenses)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{owner.expenseCategories.length} expense categories logged</div>
              </div>

              <div
                onClick={() => setDetailModal('profit')}
                role="button"
                tabIndex={0}
                style={{
                  background: owner.netProfit >= 0 ? '#f0fdf4' : '#fff1f2',
                  padding: '16px 18px', borderRadius: 8,
                  border: `1px solid ${owner.netProfit >= 0 ? '#bbf7d0' : '#fecdd3'}`,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: owner.netProfit >= 0 ? '#059669' : '#e11d48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>5. Net Bottom Line ↗</span>
                  <Crown size={15} color={owner.netProfit >= 0 ? '#059669' : '#e11d48'} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: owner.netProfit >= 0 ? '#059669' : '#e11d48', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.netProfit)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: owner.netProfit >= 0 ? '#047857' : '#be123c', marginTop: 4 }}>Take-Home: {owner.netProfitMargin}% of revenue</div>
              </div>
            </div>

            {analytics && analytics.summary.total_revenue > 0 && (
              <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
                  <span>Revenue Capital Allocation Waterfall</span>
                  <span style={{ color: '#64748b' }}>100% of {formatCurrency(analytics.summary.total_revenue)}</span>
                </div>
                <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: '#e2e8f0', gap: 2 }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, (analytics.summary.total_cost / analytics.summary.total_revenue) * 100))}%`, background: '#334155' }} />
                  <div style={{ width: `${Math.min(100, Math.max(0, (owner.totalExpenses / analytics.summary.total_revenue) * 100))}%`, background: '#64748b' }} />
                  <div style={{ width: `${Math.min(100, Math.max(0, (owner.netProfit / analytics.summary.total_revenue) * 100))}%`, background: owner.netProfit >= 0 ? '#059669' : '#e11d48' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 11, color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#334155' }} /><span>COGS: <strong style={{ color: '#0f172a' }}>{Math.round((analytics.summary.total_cost / analytics.summary.total_revenue) * 100)}%</strong> ({formatCurrency(analytics.summary.total_cost)})</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#64748b' }} /><span>Expenses: <strong style={{ color: '#0f172a' }}>{Math.round((owner.totalExpenses / analytics.summary.total_revenue) * 100)}%</strong> ({formatCurrency(owner.totalExpenses)})</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: owner.netProfit >= 0 ? '#059669' : '#e11d48' }} /><span>Net Profit: <strong style={{ color: '#0f172a' }}>{owner.netProfitMargin}%</strong> ({formatCurrency(owner.netProfit)})</span></div>
                </div>
              </div>
            )}
          </div>

          {/* ── Cash Reconciliation Label ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <Wallet size={16} color="#0f172a" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Counter Cash Reconciliation &amp; Drawer Audit</span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Real-time physical cash tracking</span>
          </div>

          {/* ── Cash Reconciliation 3 standalone cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <ArrowUpRight size={16} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Cash Inflow (Sales) ↗</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.cashDrawer.cashSales)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Collected directly from cash customers</div>
            </div>

            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                  <ArrowDownRight size={16} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Cash Outflow (Drawer Expenses) ↗</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.cashDrawer.cashExpenses)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Petty cash and vendor payments from drawer</div>
            </div>

            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                  <Coins size={16} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Expected Cash In Register ↗</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.cashDrawer.netCashEstimated)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Net sales cash minus payouts (excl. initial float)</div>
            </div>
          </div>

          {/* ── Staff & Cashier Accountability – standalone card ── */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Users size={18} color="#0f172a" />
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>Staff &amp; Cashier Accountability Matrix</h4>
                <div style={{ fontSize: 11, color: '#64748b' }}>Track billing volumes, revenue contribution, and discounts given per staff</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cashier</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Orders</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discounts</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {owner.cashierPerformance.length > 0 ? (
                    owner.cashierPerformance.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>{c.cashier_name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700, color: '#0f172a' }}>
                            {c.orders_count}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(c.total_revenue)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{c.total_discount > 0 ? formatCurrency(c.total_discount) : '-'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(c.avg_ticket)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>No cashier transactions recorded for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── POS Terminal Sales – standalone card ── */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Monitor size={18} color="#0f172a" />
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>POS Terminal Sales Performance</h4>
                <div style={{ fontSize: 11, color: '#64748b' }}>Compare workload and billings across Counter Terminals</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {owner.terminalPerformance.length > 0 ? (
                owner.terminalPerformance.map((t, idx) => {
                  const totalRev = analytics?.summary?.total_revenue || 1
                  const share = Math.round((t.total_revenue / totalRev) * 100)
                  return (
                    <div key={idx} style={{ padding: '12px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#0f172a', color: '#ffffff' }}>{t.terminal_id}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{t.orders_count} orders completed</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(t.total_revenue)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${share}%`, height: '100%', background: '#334155' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{share}%</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No terminal records for this period</div>
              )}
            </div>
          </div>

          {/* ── Operating Expenses Breakdown – standalone card ── */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingDown size={18} color="#0f172a" />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>Operating Expenses Breakdown</h4>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Expenses categorized from store expenses registry</div>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>Total: {formatCurrency(owner.totalExpenses)}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vouchers</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {owner.expenseCategories.length > 0 ? (
                    owner.expenseCategories.map((exp, idx) => {
                      const share = owner.totalExpenses > 0 ? Math.round((exp.total_amount / owner.totalExpenses) * 100) : 0
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>{exp.category}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 600, color: '#0f172a' }}>
                              {exp.count}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(exp.total_amount)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>{share}%</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No operating expenses logged for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Inventory Capital Valuation – standalone card ── */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="#0f172a" />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>Inventory Capital Valuation &amp; Spoilage Audit</h4>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Live snapshot of locked capital, potential retail margin, and spoilage losses</div>
                </div>
              </div>
              <button
                onClick={() => setDetailModal('inventory')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#0f172a',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Full Audit ↗</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div
                onClick={() => setDetailModal('inventory')}
                style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Capital In Stock (At Cost) ↗</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.inventoryValuation.totalCostValue)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{owner.inventoryValuation.totalProducts} active products</div>
              </div>

              <div
                onClick={() => setDetailModal('inventory')}
                style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Retail Value (Selling Price) ↗</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.inventoryValuation.totalRetailValue)}</div>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 2 }}>+{formatCurrency(owner.inventoryValuation.potentialMarginValue)} profit potential</div>
              </div>

              <div
                onClick={() => setDetailModal('inventory')}
                style={{
                  background: owner.inventoryValuation.lowStockCount > 0 ? '#fffbeb' : '#f8fafc',
                  border: `1px solid ${owner.inventoryValuation.lowStockCount > 0 ? '#fde68a' : '#e2e8f0'}`,
                  padding: '14px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <AlertTriangle size={18} color={owner.inventoryValuation.lowStockCount > 0 ? '#b45309' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: owner.inventoryValuation.lowStockCount > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{owner.inventoryValuation.lowStockCount} Items ↗</div>
                  <div style={{ fontSize: 10, color: owner.inventoryValuation.lowStockCount > 0 ? '#b45309' : '#64748b' }}>Low Stock Warning</div>
                </div>
              </div>

              <div
                onClick={() => setDetailModal('inventory')}
                style={{
                  background: owner.inventoryValuation.outOfStockCount > 0 ? '#fff1f2' : '#f8fafc',
                  border: `1px solid ${owner.inventoryValuation.outOfStockCount > 0 ? '#fecdd3' : '#e2e8f0'}`,
                  padding: '14px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <AlertTriangle size={18} color={owner.inventoryValuation.outOfStockCount > 0 ? '#e11d48' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: owner.inventoryValuation.outOfStockCount > 0 ? '#e11d48' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{owner.inventoryValuation.outOfStockCount} Items ↗</div>
                  <div style={{ fontSize: 10, color: owner.inventoryValuation.outOfStockCount > 0 ? '#e11d48' : '#64748b' }}>Out of Stock Risk</div>
                </div>
              </div>
            </div>

            <div
              onClick={() => setDetailModal('inventory')}
              style={{ padding: '12px 16px', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#be123c' }}>Spoilage &amp; Damaged Stock Lost ↗</div>
                <div style={{ fontSize: 11, color: '#e11d48', marginTop: 2 }}>{owner.damageLoss.quantity} units lost across {owner.damageLoss.events} incidents (Click to view breakdown)</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#be123c', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(owner.damageLoss.cost)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Detail Drill-down Modal */}
      {detailModal && (
        <AnalyticsDetailModal
          type={detailModal}
          onClose={() => setDetailModal(null)}
          analytics={analytics}
          shopName={currentShop?.name}
          periodLabel={periodDisplayLabel}
        />
      )}

      {/* Professional Executive Report Generator Modal */}
      {showReportGen && (
        <ReportGeneratorModal
          onClose={() => setShowReportGen(false)}
          analytics={analytics}
          currentShop={currentShop}
          currentPeriodLabel={periodDisplayLabel}
        />
      )}
    </div>
  )
}

// Clean Real Empty Analytics State Generator (No Mock/Dummy Numbers)
function generateEmptyTimeline(
  period: PeriodType,
  dateStr: string,
  customStart?: string,
  customEnd?: string
): AnalyticsState['timeline'] {
  const d = dayjs(dateStr)
  const timeline: AnalyticsState['timeline'] = []

  if (period === 'daily') {
    for (let hr = 6; hr <= 22; hr++) {
      const hrStr = hr.toString().padStart(2, '0') + ':00'
      timeline.push({
        label: hrStr,
        hour: hrStr,
        revenue: 0,
        orders: 0,
        discount: 0,
        avgTicket: 0
      })
    }
  } else if (period === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const dayDate = d.subtract(i, 'day')
      timeline.push({
        label: dayDate.format('ddd (DD)'),
        date: dayDate.format('YYYY-MM-DD'),
        revenue: 0,
        orders: 0,
        discount: 0,
        avgTicket: 0
      })
    }
  } else if (period === 'monthly') {
    const daysCount = d.daysInMonth()
    for (let i = 1; i <= daysCount; i++) {
      const dayDate = d.date(i)
      timeline.push({
        label: dayDate.format('DD MMM'),
        date: dayDate.format('YYYY-MM-DD'),
        revenue: 0,
        orders: 0,
        discount: 0,
        avgTicket: 0
      })
    }
  } else {
    // Custom date range
    let curr = customStart ? dayjs(customStart) : d.subtract(29, 'day')
    const end = customEnd ? dayjs(customEnd) : d

    while (curr.isBefore(end) || curr.isSame(end, 'day')) {
      timeline.push({
        label: curr.format('MM-DD'),
        date: curr.format('YYYY-MM-DD'),
        revenue: 0,
        orders: 0,
        discount: 0,
        avgTicket: 0
      })
      curr = curr.add(1, 'day')
    }
  }

  return timeline
}

function generateEmptyAnalytics(
  period: PeriodType,
  dateStr: string,
  customStart?: string,
  customEnd?: string
): AnalyticsState {
  const timeline = generateEmptyTimeline(period, dateStr, customStart, customEnd)

  return {
    period,
    startDate: period === 'custom' && customStart ? customStart : dateStr,
    endDate: period === 'custom' && customEnd ? customEnd : dateStr,
    summary: {
      total_orders: 0,
      total_revenue: 0,
      total_subtotal: 0,
      total_discount: 0,
      total_tax: 0,
      avg_order_value: 0,
      net_revenue: 0,
      total_cost: 0,
      estimated_profit: 0,
      profit_margin_pct: 0,
      total_items_sold: 0,
      revenue_growth_pct: 0,
      orders_growth_pct: 0,
      prev_revenue: 0,
      prev_orders: 0
    },
    timeline,
    paymentBreakdown: [],
    topProducts: [],
    categoryBreakdown: [],
    itemBreakdown: [],
    ownerMetrics: {
      grossProfit: 0,
      grossProfitMargin: 0,
      totalExpenses: 0,
      netProfit: 0,
      netProfitMargin: 0,
      expenseCategories: [],
      cashierPerformance: [],
      terminalPerformance: [],
      inventoryValuation: {
        totalProducts: 0,
        totalCostValue: 0,
        totalRetailValue: 0,
        potentialMarginValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0
      },
      damageLoss: {
        cost: 0,
        quantity: 0,
        events: 0
      },
      cashDrawer: {
        cashSales: 0,
        cashExpenses: 0,
        netCashEstimated: 0
      },
      detailedExpenses: [],
      lowStockList: [],
      damageLossList: []
    },
    peakSlot: null,
    recentOrders: []
  }
}
