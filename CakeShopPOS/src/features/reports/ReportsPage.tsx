import React, { useState, useEffect } from 'react'
import { BarChart3, Calendar, Banknote, ShoppingBag, TrendingUp, Tag } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatDateLong } from '../../lib/formatters'
import dayjs from 'dayjs'

export const ReportsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [metrics, setMetrics] = useState<any>({
    summary: { total_orders: 0, total_revenue: 0, total_discount: 0, avg_order_value: 0 },
    paymentBreakdown: []
  })

  const loadDailyMetrics = async () => {
    if (!currentShop) return
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.dbQuery('db:get-daily-summary', {
          shopId: currentShop.id,
          dateStr: selectedDate
        })
        if (res) setMetrics(res)
      } else {
        // Demo data
        setMetrics({
          summary: { total_orders: 24, total_revenue: 87600, total_discount: 2000, avg_order_value: 3650 },
          paymentBreakdown: [
            { method: 'CASH', total_amount: 62000 },
            { method: 'CARD', total_amount: 20000 },
            { method: 'TRANSFER', total_amount: 5600 }
          ]
        })
      }
    } catch (err) {
      console.error('Failed to load metrics:', err)
    }
  }

  useEffect(() => { loadDailyMetrics() }, [currentShop?.id, selectedDate])

  const paymentIcons: Record<string, string> = { CASH: '💵', CARD: '💳', TRANSFER: '🏦' }

  return (
    <div className="page-container" style={{ overflowY: 'auto' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-title">
            <div className="page-title-icon"><BarChart3 size={18} /></div>
            Daily Sales & Revenue Report
          </div>
          <div className="page-subtitle">
            Performance analytics for {currentShop?.name} · {formatDateLong(selectedDate)}
          </div>
        </div>
        {/* Date Picker */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '8px 14px'
        }}>
          <Calendar size={14} style={{ color: 'var(--primary)' }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              fontFamily: 'Inter, sans-serif'
            }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ flexShrink: 0 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="kpi-label">Total Revenue (අද ආදායම)</div>
          <div className="kpi-value green">{formatCurrency(metrics.summary?.total_revenue)}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-label">Total Orders (බිල්පත් ගණන)</div>
          <div className="kpi-value blue">{metrics.summary?.total_orders || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="kpi-label">Avg Ticket Value (සාමාන්‍ය බිල)</div>
          <div className="kpi-value" style={{ color: '#6d28d9' }}>{formatCurrency(metrics.summary?.avg_order_value)}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-label">Discounts Given</div>
          <div className="kpi-value amber">{formatCurrency(metrics.summary?.total_discount)}</div>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', padding: 20, flexShrink: 0
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
          Payment Methods Breakdown
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {['CASH', 'CARD', 'TRANSFER'].map((method) => {
            const found = metrics.paymentBreakdown?.find((p: any) => p.method === method)
            const amount = found?.total_amount || 0
            const total = metrics.summary?.total_revenue || 1
            const pct = ((amount / total) * 100).toFixed(1)
            return (
              <div key={method} style={{
                background: 'var(--surface-2)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', padding: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 20 }}>{paymentIcons[method]}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{method}</span>
                  </div>
                  <span style={{
                    background: 'var(--primary-bg)', color: 'var(--primary-dark)',
                    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700
                  }}>{pct}%</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary-dark)' }}>
                  {formatCurrency(amount)}
                </div>
                {/* Bar */}
                <div style={{ marginTop: 10, height: 4, background: 'var(--border)', borderRadius: 99 }}>
                  <div style={{
                    height: '100%', borderRadius: 99, background: 'var(--primary)',
                    width: `${pct}%`, transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Summary Table */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', padding: 20, flexShrink: 0
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
          End-of-Day Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Gross Revenue', val: formatCurrency(metrics.summary?.total_revenue), icon: '💰' },
            { label: 'Discount Given', val: formatCurrency(metrics.summary?.total_discount), icon: '🏷️' },
            { label: 'Net Revenue', val: formatCurrency((metrics.summary?.total_revenue || 0) - (metrics.summary?.total_discount || 0)), icon: '📊' },
            { label: 'Bills Issued', val: `${metrics.summary?.total_orders || 0} orders`, icon: '🧾' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: 'var(--surface-2)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border-light)'
            }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
