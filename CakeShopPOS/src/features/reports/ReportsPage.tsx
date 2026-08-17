import React, { useState, useEffect } from 'react'
import { BarChart3, Calendar, Banknote, ShoppingBag, TrendingUp, Tag, CreditCard, Building2, DollarSign, Receipt, Percent } from 'lucide-react'
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
          summary: { total_orders: 12, total_revenue: 38400, total_discount: 1200, avg_order_value: 3200 },
          paymentBreakdown: [
            { method: 'CASH', total_amount: 24000 },
            { method: 'CARD', total_amount: 12400 },
            { method: 'TRANSFER', total_amount: 2000 }
          ]
        })
      }
    } catch (err) {
      console.error('Failed to load metrics:', err)
    }
  }

  useEffect(() => { loadDailyMetrics() }, [currentShop?.id, selectedDate])

  const paymentIcons: Record<string, React.ReactNode> = {
    CASH: <Banknote size={18} color="#16a34a" />,
    CARD: <CreditCard size={18} color="#2563eb" />,
    TRANSFER: <Building2 size={18} color="#7c3aed" />
  }

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
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value green">{formatCurrency(metrics.summary?.total_revenue)}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-label">Total Orders</div>
          <div className="kpi-value blue">{metrics.summary?.total_orders || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="kpi-label">Avg Ticket Value</div>
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
                    <span style={{ display: 'flex' }}>{paymentIcons[method]}</span>
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
            { label: 'Gross Revenue', val: formatCurrency(metrics.summary?.total_revenue), icon: <DollarSign size={18} color="#16a34a" /> },
            { label: 'Discount Given', val: formatCurrency(metrics.summary?.total_discount), icon: <Tag size={18} color="#d97706" /> },
            { label: 'Net Revenue', val: formatCurrency((metrics.summary?.total_revenue || 0) - (metrics.summary?.total_discount || 0)), icon: <TrendingUp size={18} color="#2563eb" /> },
            { label: 'Bills Issued', val: `${metrics.summary?.total_orders || 0} orders`, icon: <Receipt size={18} color="#7c3aed" /> },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: 'var(--surface-2)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border-light)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {item.icon}
              </div>
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
