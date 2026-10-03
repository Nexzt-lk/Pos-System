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

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom'

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
  }
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
  }>
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#16a34a',
  CARD: '#2563eb',
  TRANSFER: '#8b5cf6',
  MIXED: '#f59e0b'
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote size={15} color="#16a34a" />,
  CARD: <CreditCard size={15} color="#2563eb" />,
  TRANSFER: <Building2 size={15} color="#8b5cf6" />,
  MIXED: <Layers size={15} color="#f59e0b" />
}

export const ReportsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [viewMode, setViewMode] = useState<'store' | 'owner'>('store')
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
    const shopId = currentShop?.id || 'b0000000-0000-0000-0000-000000000001'
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

        if (localReport) {
          setAnalytics(localReport)
          setLoading(false)
          return
        }
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

        setAnalytics({
          period,
          startDate: backendReport.fromDate ? dayjs(backendReport.fromDate).format('YYYY-MM-DD') : selectedDate,
          endDate: backendReport.toDate ? dayjs(backendReport.toDate).format('YYYY-MM-DD') : selectedDate,
          summary: {
            total_orders: backendReport.orderCount || 0,
            total_revenue: backendReport.totalSales || 0,
            total_subtotal: (backendReport.totalSales || 0) + (backendReport.totalDiscount || 0),
            total_discount: backendReport.totalDiscount || 0,
            total_tax: backendReport.totalTax || 0,
            avg_order_value: backendReport.orderCount > 0 ? (backendReport.totalSales / backendReport.orderCount) : 0,
            net_revenue: backendReport.netIncome || backendReport.totalSales || 0,
            total_cost: backendReport.costOfGoodsSold || 0,
            estimated_profit: backendReport.profitEstimate || (backendReport.totalSales - (backendReport.costOfGoodsSold || 0)),
            profit_margin_pct: backendReport.totalSales > 0 ? Number((((backendReport.profitEstimate || 0) / backendReport.totalSales) * 100).toFixed(1)) : 0,
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
          itemBreakdown: mappedTopProducts.map((tp, idx) => ({
            product_id: `p-${idx}`,
            product_name: tp.product_name,
            item_code: `ITEM-${(idx + 1).toString().padStart(3, '0')}`,
            category_name: 'General',
            avg_unit_price: tp.total_qty > 0 ? Math.round(tp.total_revenue / tp.total_qty) : 0,
            avg_cost_price: tp.total_qty > 0 ? Math.round((tp.total_revenue * 0.6) / tp.total_qty) : 0,
            total_qty: tp.total_qty,
            total_discount: 0,
            total_revenue: tp.total_revenue,
            total_cogs: Math.round(tp.total_revenue * 0.6),
            gross_profit: Math.round(tp.total_revenue * 0.4),
            margin_pct: 40.0,
            revenue_share_pct: (backendReport.totalSales || 1) > 0 ? Number(((tp.total_revenue / (backendReport.totalSales || 1)) * 100).toFixed(1)) : 0
          })),
          ownerMetrics: {
            grossProfit: backendReport.profitEstimate || ((backendReport.totalSales || 0) - (backendReport.costOfGoodsSold || 0)),
            grossProfitMargin: backendReport.totalSales > 0 ? Number((((backendReport.profitEstimate || 0) / backendReport.totalSales) * 100).toFixed(1)) : 0,
            totalExpenses: 0,
            netProfit: backendReport.netIncome || backendReport.profitEstimate || 0,
            netProfitMargin: backendReport.totalSales > 0 ? Number((((backendReport.netIncome || 0) / backendReport.totalSales) * 100).toFixed(1)) : 0,
            expenseCategories: [],
            cashierPerformance: [],
            terminalPerformance: [{ terminal_id: 'T1', orders_count: backendReport.orderCount || 0, total_revenue: backendReport.totalSales || 0 }],
            inventoryValuation: {
              totalProducts: mappedTopProducts.length,
              totalCostValue: 0,
              totalRetailValue: 0,
              potentialMarginValue: 0,
              lowStockCount: 0,
              outOfStockCount: 0
            },
            damageLoss: { cost: 0, quantity: 0, events: 0 },
            cashDrawer: {
              cashSales: backendReport.paymentBreakdown?.cashAmount || 0,
              cashExpenses: 0,
              netCashEstimated: backendReport.paymentBreakdown?.cashAmount || 0
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
  }, [currentShop?.id, period, selectedDate, customStartDate, customEndDate])

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

  // Export data to CSV
  const handleExportCSV = () => {
    if (!analytics) return
    const headers = ['Label/Time', 'Orders Count', 'Gross Revenue (Rs.)', 'Discount (Rs.)', 'Avg Ticket (Rs.)']
    const rows = analytics.timeline.map((t) => [
      `"${t.label}"`,
      t.orders,
      t.revenue,
      t.discount,
      t.avgTicket
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Sales_Report_${period}_${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#ffffff',
          padding: '12px 16px',
          borderRadius: 10,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: 12,
          minWidth: 180,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontWeight: 800, color: '#94a3b8', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
            {data.label}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <span style={{ color: '#86efac', fontWeight: 600 }}>Total Revenue:</span>
            <span style={{ fontWeight: 800 }}>{formatCurrency(data.revenue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <span style={{ color: '#93c5fd', fontWeight: 600 }}>Total Orders:</span>
            <span style={{ fontWeight: 800 }}>{data.orders} bills</span>
          </div>
          {data.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <span style={{ color: '#fcd34d', fontWeight: 600 }}>Discounts:</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(data.discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>Avg Ticket:</span>
            <span style={{ fontWeight: 700 }}>{formatCurrency(data.avgTicket)}</span>
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
    <div className="page-container" style={{ overflowY: 'auto', padding: '20px 24px', gap: 20 }}>
      {/* Top View Mode Switcher: Store Sales & Item Analytics vs Owner's Executive Hub */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: 'var(--surface)',
        padding: '10px 16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setViewMode('store')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 'var(--radius)',
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: viewMode === 'store' ? 'var(--primary)' : 'var(--surface-2)',
              color: viewMode === 'store' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: viewMode === 'store' ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <BarChart3 size={16} />
            <span>Store Sales & Items Analysis (විකුණුම් හා භාණ්ඩ විශ්ලේෂණය)</span>
          </button>

          <button
            onClick={() => setViewMode('owner')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 'var(--radius)',
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: viewMode === 'owner' ? 'linear-gradient(135deg, #0f172a, #1e293b)' : 'var(--surface-2)',
              color: viewMode === 'owner' ? '#facc15' : 'var(--text-secondary)',
              boxShadow: viewMode === 'owner' ? '0 4px 12px rgba(15, 23, 42, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Crown size={16} color={viewMode === 'owner' ? '#facc15' : '#eab308'} />
            <span>Owner's Executive Hub (හිමිකරුගේ ප්‍රධාන ව්‍යාපාර පුවරුව)</span>
            <span style={{
              background: viewMode === 'owner' ? '#facc15' : '#fef08a',
              color: '#854d0e',
              fontSize: 10,
              fontWeight: 800,
              padding: '1px 7px',
              borderRadius: 99
            }}>
              OWNER
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} color="var(--primary)" />
          <span>{viewMode === 'store' ? 'Operational Level Reporting' : 'C-Suite Business Intelligence'}</span>
        </div>
      </div>

      {/* Header & Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        background: 'var(--surface)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Title & Branch */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: viewMode === 'store' ? 'linear-gradient(135deg, #16a34a, #059669)' : 'linear-gradient(135deg, #0f172a, #1e293b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: viewMode === 'store' ? '#ffffff' : '#facc15',
              boxShadow: viewMode === 'store' ? '0 4px 10px rgba(22, 163, 74, 0.3)' : '0 4px 10px rgba(15, 23, 42, 0.4)'
            }}>
              {viewMode === 'store' ? <BarChart3 size={20} /> : <Crown size={20} color="#facc15" />}
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                {viewMode === 'store' ? 'Sales & Revenue Analytics' : "Owner's Executive Business Intelligence (P&L Hub)"}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                {viewMode === 'store'
                  ? `${currentShop?.name || 'Main Branch'} · Performance Insights & Item Breakdown`
                  : `${currentShop?.name || 'Main Branch'} · Comprehensive Profit & Loss, Expenses, Cash Reconciliation & Staff Audit`}
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Tabs (Daily, Weekly, Monthly, Custom) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            background: 'var(--surface-2)',
            padding: 4,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
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
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: period === tab.key ? 700 : 500,
                  cursor: 'pointer',
                  background: period === tab.key ? 'var(--surface)' : 'transparent',
                  color: period === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: period === tab.key ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.18s ease'
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
              background: 'var(--surface-2)',
              padding: '4px 8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)'
            }}>
              <button
                onClick={handlePrevPeriod}
                title="Previous Period"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}>
                <Calendar size={13} style={{ color: 'var(--primary)' }} />
                <span>{periodDisplayLabel}</span>
              </div>

              <button
                onClick={handleNextPeriod}
                disabled={isCurrentDayFuture && period === 'daily'}
                title="Next Period"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--surface)',
                  cursor: isCurrentDayFuture && period === 'daily' ? 'not-allowed' : 'pointer',
                  opacity: isCurrentDayFuture && period === 'daily' ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={handleSetToday}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  marginLeft: 4
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
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)'
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshButton onClick={loadAnalytics} isLoading={loading} label="" />

            <button
              onClick={() => setShowReportGen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, #16a34a, #059669)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
              }}
              title="Generate Official Business Report (වාර්තා සැකසීම)"
            >
              <FileText size={14} />
              <span>Generate Report</span>
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              <Download size={14} style={{ color: 'var(--primary)' }} />
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* ───── VIEW MODE 1: STORE SALES & ITEM-WISE PERFORMANCE ───── */}
      {viewMode === 'store' && (
        <>
          {/* Interactive Clickable KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14
          }}>
            {/* Card 1: Total Revenue (දෛනික ආදායම) */}
            <div
              onClick={() => setDetailModal('revenue')}
              role="button"
              tabIndex={0}
              style={{
                background: 'var(--surface)',
                padding: '18px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(22, 163, 74, 0.15)'
                e.currentTarget.style.borderColor = '#16a34a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Daily Revenue (දෛනික ආදායම)
                  </span>
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>
                    Click for Sales Breakdown ↗
                  </div>
                </div>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(22, 163, 74, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a'
                }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', letterSpacing: '-0.5px', marginBottom: 6 }}>
                {formatCurrency(analytics?.summary?.total_revenue || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                {analytics && analytics.summary.revenue_growth_pct >= 0 ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: '#16a34a',
                    background: '#dcfce7',
                    padding: '2px 6px',
                    borderRadius: 99
                  }}>
                    <ArrowUpRight size={12} /> +{analytics.summary.revenue_growth_pct}%
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: '#ef4444',
                    background: '#fee2e2',
                    padding: '2px 6px',
                    borderRadius: 99
                  }}>
                    <ArrowDownRight size={12} /> {analytics?.summary.revenue_growth_pct}%
                  </span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>{analytics?.summary?.total_orders || 0} completed bills</span>
              </div>
            </div>

            {/* Card 2: Daily Expenses (දෛනික වියදම්) */}
            <div
              onClick={() => setDetailModal('expenses')}
              role="button"
              tabIndex={0}
              style={{
                background: 'var(--surface)',
                padding: '18px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(234, 88, 12, 0.15)'
                e.currentTarget.style.borderColor = '#ea580c'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Operating Expenses (දෛනික වියදම්)
                  </span>
                  <div style={{ fontSize: 10, color: '#ea580c', fontWeight: 700, marginTop: 2 }}>
                    Click for Vouchers Audit ↗
                  </div>
                </div>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(234, 88, 12, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c'
                }}>
                  <TrendingDown size={18} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ea580c', letterSpacing: '-0.5px', marginBottom: 6 }}>
                {formatCurrency(analytics?.ownerMetrics?.totalExpenses || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                <span style={{
                  background: '#ffedd5',
                  color: '#c2410c',
                  padding: '2px 8px',
                  borderRadius: 99
                }}>
                  {analytics?.ownerMetrics?.expenseCategories?.length || 0} categories
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Cash outflow: {formatCurrency(analytics?.ownerMetrics?.cashDrawer?.cashExpenses || analytics?.ownerMetrics?.totalExpenses || 0)}
                </span>
              </div>
            </div>

            {/* Card 3: Net Profit (ශුද්ධ ලාභය) */}
            <div
              onClick={() => setDetailModal('profit')}
              role="button"
              tabIndex={0}
              style={{
                background: 'var(--surface)',
                padding: '18px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(5, 150, 105, 0.15)'
                e.currentTarget.style.borderColor = '#059669'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Net Profit (ශුද්ධ ලාභය)
                  </span>
                  <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                    Click for P&L Statement ↗
                  </div>
                </div>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(5, 150, 105, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669'
                }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: (analytics?.ownerMetrics?.netProfit || 0) >= 0 ? '#059669' : '#dc2626', letterSpacing: '-0.5px', marginBottom: 6 }}>
                {formatCurrency(analytics?.ownerMetrics?.netProfit ?? analytics?.summary?.estimated_profit ?? 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
                <span style={{
                  background: (analytics?.ownerMetrics?.netProfitMargin || 0) >= 15 ? '#d1fae5' : '#fee2e2',
                  color: (analytics?.ownerMetrics?.netProfitMargin || 0) >= 15 ? '#065f46' : '#991b1b',
                  padding: '2px 8px',
                  borderRadius: 99
                }}>
                  {analytics?.ownerMetrics?.netProfitMargin ?? analytics?.summary?.profit_margin_pct ?? 0}% Net Margin
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  Take-home
                </span>
              </div>
            </div>

            {/* Card 4: Inventory Valuation & Low Stock (තොග වටිනාකම & අඩු තොග) */}
            <div
              onClick={() => setDetailModal('inventory')}
              role="button"
              tabIndex={0}
              style={{
                background: 'var(--surface)',
                padding: '18px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.15)'
                e.currentTarget.style.borderColor = '#2563eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Stock Value &amp; Low Stock (තොගය)
                  </span>
                  <div style={{ fontSize: 10, color: '#2563eb', fontWeight: 700, marginTop: 2 }}>
                    Click for Stock Audit ↗
                  </div>
                </div>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(37, 99, 235, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  <Package size={18} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 6 }}>
                {formatCurrency(analytics?.ownerMetrics?.inventoryValuation?.totalCostValue || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                {(analytics?.ownerMetrics?.inventoryValuation?.lowStockCount || 0) > 0 ? (
                  <span style={{
                    background: '#fef3c7',
                    color: '#d97706',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontWeight: 700
                  }}>
                    ⚠ {analytics?.ownerMetrics?.inventoryValuation?.lowStockCount || 0} Low Stock
                  </span>
                ) : (
                  <span style={{
                    background: '#dcfce7',
                    color: '#16a34a',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontWeight: 700
                  }}>
                    ✓ Stock Healthy
                  </span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>
                  Retail: {formatCurrency(analytics?.ownerMetrics?.inventoryValuation?.totalRetailValue || 0)}
                </span>
              </div>
            </div>

            {/* Card 5: Total Orders & Basket (මුළු බිල්පත්) */}
            <div
              onClick={() => setDetailModal('orders')}
              role="button"
              tabIndex={0}
              style={{
                background: 'var(--surface)',
                padding: '18px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(2, 132, 199, 0.15)'
                e.currentTarget.style.borderColor = '#0284c7'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Orders (මුළු බිල්පත්)
                  </span>
                  <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 700, marginTop: 2 }}>
                    Click for Orders Log ↗
                  </div>
                </div>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(2, 132, 199, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7'
                }}>
                  <Receipt size={18} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 6 }}>
                {analytics?.summary?.total_orders || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                <span style={{ color: 'var(--text-muted)' }}>Avg Ticket (AOV):</span>
                <span style={{ fontWeight: 800, color: '#8b5cf6' }}>{formatCurrency(analytics?.summary?.avg_order_value || 0)}</span>
              </div>
            </div>

            {/* Card 6: Cash in Drawer (මුදල් ලාච්චුවේ ශේෂය) */}
            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{
                background: 'var(--surface)',
                padding: '18px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(217, 119, 6, 0.15)'
                e.currentTarget.style.borderColor = '#d97706'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Cash In Register (මුදල් ලාච්චුව)
                  </span>
                  <div style={{ fontSize: 10, color: '#d97706', fontWeight: 700, marginTop: 2 }}>
                    Click for Reconciliation ↗
                  </div>
                </div>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(217, 119, 6, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706'
                }}>
                  <Wallet size={18} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#d97706', letterSpacing: '-0.5px', marginBottom: 6 }}>
                {formatCurrency(analytics?.ownerMetrics?.cashDrawer?.netCashEstimated || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                <span style={{ color: '#16a34a' }}>+{formatCurrency(analytics?.ownerMetrics?.cashDrawer?.cashSales || 0)}</span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span style={{ color: '#dc2626' }}>-{formatCurrency(analytics?.ownerMetrics?.cashDrawer?.cashExpenses || 0)}</span>
              </div>
            </div>
          </div>

      {/* Main Interactive Chart Section */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-sm)'
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
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Sales & Revenue Progression Chart
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {period === 'daily' && 'Hourly sales velocity and transaction distribution'}
              {period === 'weekly' && 'Daily revenue trends over the 7-day period'}
              {period === 'monthly' && 'Full month day-by-day revenue pattern'}
              {period === 'custom' && 'Timeline breakdown across custom dates'}
            </p>
          </div>

          {/* Chart View Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--surface-2)',
            padding: 3,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}>
            <button
              onClick={() => setChartMode('revenue')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 12,
                fontWeight: chartMode === 'revenue' ? 700 : 500,
                cursor: 'pointer',
                background: chartMode === 'revenue' ? '#16a34a' : 'transparent',
                color: chartMode === 'revenue' ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              Revenue (Rs.)
            </button>
            <button
              onClick={() => setChartMode('orders')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 12,
                fontWeight: chartMode === 'orders' ? 700 : 500,
                cursor: 'pointer',
                background: chartMode === 'orders' ? '#2563eb' : 'transparent',
                color: chartMode === 'orders' ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              Orders Count
            </button>
            <button
              onClick={() => setChartMode('both')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 12,
                fontWeight: chartMode === 'both' ? 700 : 500,
                cursor: 'pointer',
                background: chartMode === 'both' ? 'var(--surface)' : 'transparent',
                color: chartMode === 'both' ? 'var(--text-primary)' : 'var(--text-secondary)'
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="orders" name="Orders" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              ) : (
                <AreaChart data={analytics.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                  />
                  {chartMode === 'both' && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#2563eb' }}
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
                    stroke="#16a34a"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                    activeDot={{ r: 6, stroke: '#16a34a', strokeWidth: 2, fill: '#ffffff' }}
                  />
                  {chartMode === 'both' && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      name="Orders"
                      stroke="#2563eb"
                      strokeWidth={2}
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
              color: 'var(--text-muted)'
            }}>
              <BarChart3 size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
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
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: '#fef3c7',
              color: '#d97706'
            }}>
              <Sparkles size={16} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Peak Performance Window:</strong> Highest sales occurred at{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{analytics.peakSlot.label}</strong> generating{' '}
              <strong style={{ color: 'var(--primary)' }}>{formatCurrency(analytics.peakSlot.revenue)}</strong> across{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{analytics.peakSlot.orders} orders</strong>.
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
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Payment Methods Breakdown
            </h3>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
              {analytics?.paymentBreakdown.reduce((sum, p) => sum + p.count, 0)} Total Payments
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {/* Donut Chart */}
            <div style={{ width: 130, height: 130, flexShrink: 0 }}>
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
                      outerRadius={58}
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
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                  No Data
                </div>
              )}
            </div>

            {/* Payment List Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
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
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'flex' }}>{PAYMENT_ICONS[method]}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {method}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatCurrency(amount)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
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
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={16} color="#eab308" />
              Top Selling Products
            </h3>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
              By Revenue
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analytics?.topProducts && analytics.topProducts.length > 0 ? (
              analytics.topProducts.slice(0, 5).map((prod, idx) => {
                const maxRev = analytics.topProducts[0]?.total_revenue || 1
                const pct = Math.round((prod.total_revenue / maxRev) * 100)

                return (
                  <div key={prod.product_name} style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 20,
                          height: 20,
                          borderRadius: 99,
                          background: idx === 0 ? '#fef08a' : idx === 1 ? '#e2e8f0' : '#fed7aa',
                          color: idx === 0 ? '#854d0e' : '#475569',
                          fontSize: 10,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.product_name}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(prod.total_revenue)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
                          ({prod.total_qty} sold)
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: idx === 0 ? '#16a34a' : '#3b82f6',
                        borderRadius: 99,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No product sales recorded in this period
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="#8b5cf6" />
              Category Distribution
            </h3>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
              Sales Share
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
              analytics.categoryBreakdown.map((cat) => {
                const totalRev = analytics.summary.total_revenue || 1
                const pct = ((cat.total_revenue / totalRev) * 100).toFixed(1)

                return (
                  <div key={cat.category_name} style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 10,
                          height: 10,
                          borderRadius: 99,
                          background: cat.color || '#6366f1'
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cat.category_name}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(cat.total_revenue)}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#475569',
                          background: 'var(--surface)',
                          padding: '1px 6px',
                          borderRadius: 99,
                          border: '1px solid var(--border)',
                          marginLeft: 6
                        }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: cat.color || '#6366f1',
                        borderRadius: 99,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No category data for this period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Chronological Breakdown & Recent Transactions */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 20
      }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 12,
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setTableTab('items')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 13,
                fontWeight: tableTab === 'items' ? 800 : 600,
                cursor: 'pointer',
                background: tableTab === 'items' ? 'var(--surface-2)' : 'transparent',
                color: tableTab === 'items' ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              <Package size={15} />
              <span>Item-Wise Performance Breakdown ({filteredAndSortedItems.length})</span>
            </button>
            <button
              onClick={() => setTableTab('orders')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 13,
                fontWeight: tableTab === 'orders' ? 800 : 600,
                cursor: 'pointer',
                background: tableTab === 'orders' ? 'var(--surface-2)' : 'transparent',
                color: tableTab === 'orders' ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              <Receipt size={15} />
              <span>Completed Orders Log ({analytics?.recentOrders?.length || 0})</span>
            </button>
          </div>

          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
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
                background: 'var(--surface-2)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Units Sold
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                  {itemSummary.totalQty} units
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  across {itemSummary.uniqueCount} unique menu items
                </div>
              </div>

              <div style={{
                background: 'var(--surface-2)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Top Revenue Generator
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#2563eb', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {itemSummary.topRevenueItem?.product_name || 'None'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {itemSummary.topRevenueItem ? formatCurrency(itemSummary.topRevenueItem.total_revenue) : '-'} ({itemSummary.topRevenueItem?.total_qty || 0} sold)
                </div>
              </div>

              <div style={{
                background: 'var(--surface-2)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Most Profitable Item
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0891b2', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {itemSummary.topProfitItem?.product_name || 'None'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  Profit: {itemSummary.topProfitItem ? formatCurrency(itemSummary.topProfitItem.gross_profit) : '-'}
                </div>
              </div>

              <div style={{
                background: 'var(--surface-2)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Highest Margin Product
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {itemSummary.topMarginItem?.product_name || 'None'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
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
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                {/* Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  flex: 1,
                  maxWidth: 320
                }}>
                  <Search size={14} color="var(--text-muted)" />
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
                      color: 'var(--text-primary)'
                    }}
                  />
                  {itemSearch && (
                    <button
                      onClick={() => setItemSearch('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                {uniqueCategories.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={13} color="var(--text-muted)" />
                    <select
                      value={itemCategoryFilter}
                      onChange={(e) => setItemCategoryFilter(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
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
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Sort:</span>
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
                      padding: '4px 10px',
                      borderRadius: 99,
                      border: '1px solid',
                      borderColor: itemSortKey === s.key ? 'var(--primary)' : 'var(--border)',
                      background: itemSortKey === s.key ? 'var(--primary)' : 'var(--surface)',
                      color: itemSortKey === s.key ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: 11,
                      fontWeight: 700,
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
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)', width: 60 }}>
                      # / Code
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Product / Item Name
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Category
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Selling / Cost Price
                    </th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', width: 120 }}>
                      Units Sold
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Gross Revenue
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      COGS Cost
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Gross Profit
                    </th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Margin %
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
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
                            borderBottom: '1px solid var(--border-light)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(241, 245, 249, 0.4)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                            <span style={{
                              fontSize: 10,
                              background: 'var(--surface-2)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid var(--border)'
                            }}>
                              {item.item_code || idx + 1}
                            </span>
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13 }}>
                                {item.product_name}
                              </span>
                              {idx === 0 && (
                                <span style={{
                                  background: '#fef08a',
                                  color: '#854d0e',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 99
                                }}>
                                  ⭐ TOP SELLER
                                </span>
                              )}
                              {item.margin_pct >= 50 && (
                                <span style={{
                                  background: '#dcfce7',
                                  color: '#16a34a',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 99
                                }}>
                                  💎 HIGH MARGIN
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            <span style={{
                              background: 'var(--surface-2)',
                              padding: '2px 8px',
                              borderRadius: 99,
                              fontSize: 11
                            }}>
                              {item.category_name}
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatCurrency(item.avg_unit_price)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Cost: {formatCurrency(item.avg_cost_price)}
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, color: '#2563eb', fontSize: 13 }}>
                              {item.total_qty}
                            </div>
                            <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${qtyBarWidth}%`,
                                background: idx === 0 ? '#16a34a' : '#3b82f6',
                                borderRadius: 99
                              }} />
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>
                            {formatCurrency(item.total_revenue)}
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {formatCurrency(item.total_cogs)}
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: item.gross_profit >= 0 ? '#0891b2' : '#ef4444', fontSize: 13 }}>
                            {formatCurrency(item.gross_profit)}
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 800,
                              background: item.margin_pct >= 40 ? '#dcfce7' : item.margin_pct >= 20 ? '#fef3c7' : '#fee2e2',
                              color: item.margin_pct >= 40 ? '#16a34a' : item.margin_pct >= 20 ? '#d97706' : '#ef4444'
                            }}>
                              {item.margin_pct}%
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {item.revenue_share_pct}%
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <Package size={28} color="var(--text-muted)" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>No item sales recorded matching your filters</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Totals Summary Footer */}
                {filteredAndSortedItems.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                      <td colSpan={4} style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                        TOTALS ({filteredAndSortedItems.length} Products Displayed)
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#2563eb', fontSize: 13 }}>
                        {filteredAndSortedItems.reduce((sum, i) => sum + i.total_qty, 0)} units
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--primary)', fontSize: 14 }}>
                        {formatCurrency(filteredAndSortedItems.reduce((sum, i) => sum + i.total_revenue, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatCurrency(filteredAndSortedItems.reduce((sum, i) => sum + i.total_cogs, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#0891b2', fontSize: 14 }}>
                        {formatCurrency(filteredAndSortedItems.reduce((sum, i) => sum + i.gross_profit, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-primary)' }}>
                        {(() => {
                          const rev = filteredAndSortedItems.reduce((sum, i) => sum + i.total_revenue, 0)
                          const prof = filteredAndSortedItems.reduce((sum, i) => sum + i.gross_profit, 0)
                          return rev > 0 ? `${((prof / rev) * 100).toFixed(1)}%` : '0%'
                        })()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary)' }}>
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
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Order No.</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Time</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Items</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Payment</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Discount</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Total Amount</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.recentOrders && analytics.recentOrders.length > 0 ? (
                  analytics.recentOrders.map((ord, idx) => (
                    <tr
                      key={ord.id || ord.order_no}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(241, 245, 249, 0.4)'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {ord.order_no}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        {formatDateTime(ord.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {ord.items_count || 1} items
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 99,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)'
                        }}>
                          {PAYMENT_ICONS[ord.payment_method] || null}
                          {ord.payment_method}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: ord.discount_amount > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        {ord.discount_amount > 0 ? formatCurrency(ord.discount_amount) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatCurrency(ord.total_amount)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          background: '#dcfce7',
                          color: '#16a34a',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 99
                        }}>
                          COMPLETED
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
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

          {/* ── P&L Scoreboard Card ── */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: 24,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Crown size={20} color="#d97706" />
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Executive Profit &amp; Loss (P&amp;L) Statement
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Comprehensive financial summary for {periodDisplayLabel}.
                </p>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: 99,
                background: owner.netProfit >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                border: `1px solid ${owner.netProfit >= 0 ? '#16a34a' : '#dc2626'}`,
                color: owner.netProfit >= 0 ? '#16a34a' : '#dc2626',
                fontSize: 12, fontWeight: 800
              }}>
                <ShieldCheck size={14} />
                <span>Net Margin: {owner.netProfitMargin}%</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div
                onClick={() => setDetailModal('revenue')}
                role="button"
                tabIndex={0}
                style={{ background: 'var(--surface-2)', padding: '16px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>1. Gross Revenue ↗</span>
                  <DollarSign size={16} color="var(--primary)" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(analytics?.summary?.total_revenue || 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{analytics?.summary?.total_orders || 0} completed orders</div>
              </div>

              <div
                onClick={() => setDetailModal('profit')}
                role="button"
                tabIndex={0}
                style={{ background: 'var(--surface-2)', padding: '16px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>2. Product Cost (COGS) ↗</span>
                  <Layers size={16} color="#6366f1" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{formatCurrency(analytics?.summary?.total_cost || 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Direct ingredient &amp; production cost</div>
              </div>

              <div
                onClick={() => setDetailModal('profit')}
                role="button"
                tabIndex={0}
                style={{ background: 'var(--surface-2)', padding: '16px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>3. Gross Profit ↗</span>
                  <TrendingUp size={16} color="#059669" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{formatCurrency(owner.grossProfit)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Gross Margin: <strong style={{ color: '#059669' }}>{owner.grossProfitMargin}%</strong></div>
              </div>

              <div
                onClick={() => setDetailModal('expenses')}
                role="button"
                tabIndex={0}
                style={{ background: 'var(--surface-2)', padding: '16px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ea580c'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>4. Operating Expenses ↗</span>
                  <TrendingDown size={16} color="#ea580c" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c' }}>{formatCurrency(owner.totalExpenses)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{owner.expenseCategories.length} expense categories logged</div>
              </div>

              <div
                onClick={() => setDetailModal('profit')}
                role="button"
                tabIndex={0}
                style={{
                  background: owner.netProfit >= 0 ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                  padding: '16px 18px', borderRadius: 'var(--radius)',
                  border: `2px solid ${owner.netProfit >= 0 ? '#16a34a' : '#dc2626'}`,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: owner.netProfit >= 0 ? '#16a34a' : '#dc2626', textTransform: 'uppercase' }}>5. Net Bottom Line ↗</span>
                  <Crown size={16} color={owner.netProfit >= 0 ? '#16a34a' : '#dc2626'} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: owner.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(owner.netProfit)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: owner.netProfit >= 0 ? '#15803d' : '#b91c1c', marginTop: 4 }}>Take-Home: {owner.netProfitMargin}% of revenue</div>
              </div>
            </div>

            {analytics && analytics.summary.total_revenue > 0 && (
              <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  <span>Revenue Capital Allocation Waterfall</span>
                  <span style={{ color: 'var(--text-muted)' }}>100% of {formatCurrency(analytics.summary.total_revenue)}</span>
                </div>
                <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: '#e2e8f0', gap: 2 }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, (analytics.summary.total_cost / analytics.summary.total_revenue) * 100))}%`, background: '#6366f1' }} />
                  <div style={{ width: `${Math.min(100, Math.max(0, (owner.totalExpenses / analytics.summary.total_revenue) * 100))}%`, background: '#ea580c' }} />
                  <div style={{ width: `${Math.min(100, Math.max(0, (owner.netProfit / analytics.summary.total_revenue) * 100))}%`, background: owner.netProfit >= 0 ? '#16a34a' : '#dc2626' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1' }} /><span>COGS: <strong>{Math.round((analytics.summary.total_cost / analytics.summary.total_revenue) * 100)}%</strong> ({formatCurrency(analytics.summary.total_cost)})</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ea580c' }} /><span>Expenses: <strong>{Math.round((owner.totalExpenses / analytics.summary.total_revenue) * 100)}%</strong> ({formatCurrency(owner.totalExpenses)})</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: owner.netProfit >= 0 ? '#16a34a' : '#dc2626' }} /><span>Net Profit: <strong>{owner.netProfitMargin}%</strong> ({formatCurrency(owner.netProfit)})</span></div>
                </div>
              </div>
            )}
          </div>

          {/* ── Cash Reconciliation Label ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <Wallet size={16} color="#16a34a" />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Counter Cash Reconciliation &amp; Drawer Audit</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Real-time physical cash tracking</span>
          </div>

          {/* ── Cash Reconciliation 3 standalone cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{ background: 'var(--surface)', border: '1px solid rgba(22,163,74,0.3)', borderLeft: '4px solid #16a34a', padding: '18px 20px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <ArrowUpRight size={16} /><span>Cash Inflow (Sales) ↗</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a' }}>{formatCurrency(owner.cashDrawer.cashSales)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Collected directly from cash customers</div>
            </div>

            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{ background: 'var(--surface)', border: '1px solid rgba(220,38,38,0.3)', borderLeft: '4px solid #dc2626', padding: '18px 20px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <ArrowDownRight size={16} /><span>Cash Outflow (Counter Expenses) ↗</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>{formatCurrency(owner.cashDrawer.cashExpenses)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Petty cash and vendor payments from drawer</div>
            </div>

            <div
              onClick={() => setDetailModal('cash')}
              role="button"
              tabIndex={0}
              style={{ background: 'var(--surface)', border: '2px solid var(--primary)', borderLeft: '4px solid var(--primary)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                <Coins size={16} /><span>Expected Cash In Register ↗</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>{formatCurrency(owner.cashDrawer.netCashEstimated)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Net sales cash minus payouts (excl. initial float)</div>
            </div>
          </div>

          {/* ── Staff & Cashier Accountability – standalone card ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Users size={18} color="var(--primary)" />
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Staff &amp; Cashier Accountability Matrix</h4>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Track billing volumes, revenue contribution, and discounts given per staff</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Cashier</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>Orders</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Revenue</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Discounts</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Avg Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {owner.cashierPerformance.length > 0 ? (
                    owner.cashierPerformance.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.cashier_name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}><span style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{c.orders_count}</span></td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(c.total_revenue)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: c.total_discount > 0 ? '#d97706' : 'var(--text-muted)' }}>{c.total_discount > 0 ? formatCurrency(c.total_discount) : '-'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(c.avg_ticket)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No cashier transactions recorded for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── POS Terminal Sales – standalone card ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Monitor size={18} color="var(--primary)" />
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>POS Terminal Sales Performance</h4>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Compare workload and billings across Counter Terminals</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {owner.terminalPerformance.length > 0 ? (
                owner.terminalPerformance.map((t, idx) => {
                  const totalRev = analytics?.summary?.total_revenue || 1
                  const share = Math.round((t.total_revenue / totalRev) * 100)
                  return (
                    <div key={idx} style={{ padding: '12px 14px', borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--primary)', color: '#fff' }}>{t.terminal_id}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.orders_count} orders completed</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(t.total_revenue)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${share}%`, height: '100%', background: 'var(--primary)' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{share}%</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No terminal records for this period</div>
              )}
            </div>
          </div>

          {/* ── Operating Expenses Breakdown – standalone card ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingDown size={18} color="#ea580c" />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Operating Expenses Breakdown</h4>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Expenses categorized from store expenses registry</div>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ea580c' }}>Total: {formatCurrency(owner.totalExpenses)}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Category</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>Vouchers</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {owner.expenseCategories.length > 0 ? (
                    owner.expenseCategories.map((exp, idx) => {
                      const share = owner.totalExpenses > 0 ? Math.round((exp.total_amount / owner.totalExpenses) * 100) : 0
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>{exp.category}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}><span style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{exp.count}</span></td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>{formatCurrency(exp.total_amount)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>{share}%</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No operating expenses logged for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Inventory Capital Valuation – standalone card ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="#2563eb" />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Inventory Capital Valuation &amp; Spoilage Audit</h4>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Live snapshot of locked capital, potential retail margin, and spoilage losses</div>
                </div>
              </div>
              <button
                onClick={() => setDetailModal('inventory')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#2563eb'
                }}
              >
                <span>Full Audit ↗</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div
                onClick={() => setDetailModal('inventory')}
                style={{ background: 'var(--surface-2)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capital In Stock (At Cost) ↗</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{formatCurrency(owner.inventoryValuation.totalCostValue)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{owner.inventoryValuation.totalProducts} active products</div>
              </div>

              <div
                onClick={() => setDetailModal('inventory')}
                style={{ background: 'var(--surface-2)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retail Value (Selling Price) ↗</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{formatCurrency(owner.inventoryValuation.totalRetailValue)}</div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>+{formatCurrency(owner.inventoryValuation.potentialMarginValue)} profit potential</div>
              </div>

              <div
                onClick={() => setDetailModal('inventory')}
                style={{
                  background: owner.inventoryValuation.lowStockCount > 0 ? 'rgba(217,119,6,0.08)' : 'var(--surface-2)',
                  border: `1px solid ${owner.inventoryValuation.lowStockCount > 0 ? '#d97706' : 'var(--border-light)'}`,
                  padding: '14px 16px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <AlertTriangle size={20} color={owner.inventoryValuation.lowStockCount > 0 ? '#d97706' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: owner.inventoryValuation.lowStockCount > 0 ? '#d97706' : 'var(--text-primary)' }}>{owner.inventoryValuation.lowStockCount} Items ↗</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Low Stock Warning</div>
                </div>
              </div>

              <div
                onClick={() => setDetailModal('inventory')}
                style={{
                  background: owner.inventoryValuation.outOfStockCount > 0 ? 'rgba(220,38,38,0.08)' : 'var(--surface-2)',
                  border: `1px solid ${owner.inventoryValuation.outOfStockCount > 0 ? '#dc2626' : 'var(--border-light)'}`,
                  padding: '14px 16px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <AlertTriangle size={20} color={owner.inventoryValuation.outOfStockCount > 0 ? '#dc2626' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: owner.inventoryValuation.outOfStockCount > 0 ? '#dc2626' : 'var(--text-primary)' }}>{owner.inventoryValuation.outOfStockCount} Items ↗</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Out of Stock Risk</div>
                </div>
              </div>
            </div>

            <div
              onClick={() => setDetailModal('inventory')}
              style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Spoilage &amp; Damaged Stock Lost ↗</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{owner.damageLoss.quantity} units lost across {owner.damageLoss.events} incidents (Click to view breakdown)</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>{formatCurrency(owner.damageLoss.cost)}</div>
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
