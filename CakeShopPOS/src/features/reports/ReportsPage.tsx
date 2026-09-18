import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart3,
  Calendar,
  Banknote,
  TrendingUp,
  Tag,
  CreditCard,
  Building2,
  DollarSign,
  Receipt,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Award,
  Layers,
  CalendarDays,
  CalendarRange,
  Clock
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
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [customStartDate, setCustomStartDate] = useState<string>(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [customEndDate, setCustomEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [chartMode, setChartMode] = useState<'revenue' | 'orders' | 'both'>('revenue')
  const [tableTab, setTableTab] = useState<'timeline' | 'orders'>('timeline')
  const [loading, setLoading] = useState<boolean>(false)
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null)

  // Fetch real analytics data from Local Electron DB or Backend API
  const loadAnalytics = async () => {
    if (!currentShop) return
    setLoading(true)
    try {
      // 1. First priority: Direct Local SQLite Query via Electron IPC (Offline-first & 100% Real-Time)
      if (window.electronAPI?.dbQuery) {
        const localReport = await window.electronAPI.dbQuery('db:get-analytics', {
          shopId: currentShop.id,
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

  const isCurrentDayFuture = dayjs(selectedDate).isSame(dayjs(), 'day')

  return (
    <div className="page-container" style={{ overflowY: 'auto', padding: '20px 24px', gap: 20 }}>
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
              background: 'linear-gradient(135deg, #16a34a, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)'
            }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                Sales & Revenue Analytics
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                {currentShop?.name || 'Main Branch'} · Performance Insights & Trends
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

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14
      }}>
        {/* Total Revenue */}
        <div style={{
          background: 'var(--surface)',
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Revenue
            </span>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.5px', marginBottom: 6 }}>
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
            <span style={{ color: 'var(--text-muted)' }}>vs previous period</span>
          </div>
        </div>

        {/* Total Orders */}
        <div style={{
          background: 'var(--surface)',
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Bills / Orders
            </span>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}>
              <Receipt size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 6 }}>
            {analytics?.summary?.total_orders || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
            {analytics && analytics.summary.orders_growth_pct >= 0 ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: '#2563eb',
                background: '#dbeafe',
                padding: '2px 6px',
                borderRadius: 99
              }}>
                <ArrowUpRight size={12} /> +{analytics.summary.orders_growth_pct}%
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
                <ArrowDownRight size={12} /> {analytics?.summary.orders_growth_pct}%
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>completed transactions</span>
          </div>
        </div>

        {/* Avg Ticket Size */}
        <div style={{
          background: 'var(--surface)',
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Average Ticket (AOV)
            </span>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#f5f3ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b5cf6'
            }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 6 }}>
            {formatCurrency(analytics?.summary?.avg_order_value || 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            Average basket size per customer
          </div>
        </div>

        {/* Discounts Given */}
        <div style={{
          background: 'var(--surface)',
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Discounts
            </span>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#fffbeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <Tag size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#d97706', letterSpacing: '-0.5px', marginBottom: 6 }}>
            {formatCurrency(analytics?.summary?.total_discount || 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            Promotional & staff discounts
          </div>
        </div>

        {/* Estimated Profit & Margin */}
        <div style={{
          background: 'var(--surface)',
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Gross Profit & Margin
            </span>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#ecfeff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0891b2'
            }}>
              <Percent size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0891b2', letterSpacing: '-0.5px', marginBottom: 6 }}>
            {formatCurrency(analytics?.summary?.estimated_profit || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
            <span style={{
              background: '#cffafe',
              color: '#0891b2',
              padding: '2px 8px',
              borderRadius: 99
            }}>
              {analytics?.summary?.profit_margin_pct || 0}% Margin
            </span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              {analytics?.summary?.total_items_sold || 0} items sold
            </span>
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
              onClick={() => setTableTab('timeline')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 13,
                fontWeight: tableTab === 'timeline' ? 800 : 600,
                cursor: 'pointer',
                background: tableTab === 'timeline' ? 'var(--surface-2)' : 'transparent',
                color: tableTab === 'timeline' ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              Chronological Breakdown ({period.toUpperCase()})
            </button>
            <button
              onClick={() => setTableTab('orders')}
              style={{
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
              Completed Orders Log ({analytics?.recentOrders?.length || 0})
            </button>
          </div>

          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            {periodDisplayLabel}
          </span>
        </div>

        {/* Tab 1: Timeline Table */}
        {tableTab === 'timeline' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {period === 'daily' ? 'Hour Interval' : 'Date / Day'}
                  </th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Bills / Orders
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Gross Revenue
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Discount Given
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Avg Ticket Value
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Revenue Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics?.timeline && analytics.timeline.length > 0 ? (
                  analytics.timeline.map((row, idx) => {
                    const totalRev = analytics.summary.total_revenue || 1
                    const share = ((row.revenue / totalRev) * 100).toFixed(1)

                    return (
                      <tr
                        key={row.label}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(241, 245, 249, 0.4)',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {row.label}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {row.orders > 0 ? (
                            <span style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              padding: '2px 8px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 700
                            }}>
                              {row.orders}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>0</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: row.revenue > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {formatCurrency(row.revenue)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: row.discount > 0 ? '#d97706' : 'var(--text-muted)' }}>
                          {row.discount > 0 ? formatCurrency(row.discount) : '-'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {row.avgTicket > 0 ? formatCurrency(row.avgTicket) : '-'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {row.revenue > 0 ? `${share}%` : '0%'}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No data recorded for this period
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Table Footer Summary */}
              {analytics && (
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>TOTALS</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#2563eb' }}>
                      {analytics.summary.total_orders} orders
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--primary)', fontSize: 13 }}>
                      {formatCurrency(analytics.summary.total_revenue)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#d97706' }}>
                      {formatCurrency(analytics.summary.total_discount)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary)' }}>
                      {formatCurrency(analytics.summary.avg_order_value)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary)' }}>
                      100%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
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
    peakSlot: null,
    recentOrders: []
  }
}
