import React, { useState, useEffect } from 'react'
import { BarChart3, Banknote, CreditCard, ArrowRightLeft, DollarSign, Calendar } from 'lucide-react'
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
      }
    } catch (err) {
      console.error('Failed to load metrics:', err)
    }
  }

  useEffect(() => {
    loadDailyMetrics()
  }, [currentShop?.id, selectedDate])

  return (
    <div className="flex h-full w-full flex-col p-6 overflow-y-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={22} className="text-brand-400" />
            <span>Daily Sales & Revenue Report</span>
          </h2>
          <p className="text-xs text-slate-400">
            Performance analytics for {currentShop?.name} on {formatDateLong(selectedDate)}
          </p>
        </div>

        {/* Date Filter Input */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 border border-slate-800 text-xs">
          <Calendar size={14} className="text-brand-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">TOTAL REVENUE (අද ආදායම)</p>
          <p className="text-2xl font-extrabold text-brand-400 mt-1">
            {formatCurrency(metrics.summary?.total_revenue)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">TOTAL ORDERS (බිල්පත් ගණන)</p>
          <p className="text-2xl font-extrabold text-cyan-400 mt-1">
            {metrics.summary?.total_orders || 0}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">AVG TICKET VALUE (සාමාන්‍ය බිල)</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">
            {formatCurrency(metrics.summary?.avg_order_value)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">DISCOUNTS GIVEN</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1">
            {formatCurrency(metrics.summary?.total_discount)}
          </p>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Payment Methods Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          {['CASH', 'CARD', 'TRANSFER'].map((method) => {
            const found = metrics.paymentBreakdown?.find((p: any) => p.method === method)
            const amount = found?.total_amount || 0
            const percentage =
              metrics.summary?.total_revenue > 0
                ? ((amount / metrics.summary.total_revenue) * 100).toFixed(1)
                : '0.0'

            return (
              <div key={method} className="rounded-xl bg-slate-800/40 p-4 border border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">{method}</span>
                  <span className="text-xs font-bold text-brand-400">{percentage}%</span>
                </div>
                <p className="text-lg font-extrabold text-white">{formatCurrency(amount)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
