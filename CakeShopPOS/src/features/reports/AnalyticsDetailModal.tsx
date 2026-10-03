import React, { useState, useMemo } from 'react'
import {
  X,
  Printer,
  Download,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Package,
  Receipt,
  Wallet,
  AlertTriangle,
  Search
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import dayjs from 'dayjs'

export type DetailModalType = null | 'revenue' | 'expenses' | 'profit' | 'inventory' | 'orders' | 'cash'

interface AnalyticsDetailModalProps {
  type: DetailModalType
  onClose: () => void
  analytics: any
  shopName?: string
  periodLabel: string
}

export const AnalyticsDetailModal: React.FC<AnalyticsDetailModalProps> = ({
  type,
  onClose,
  analytics,
  shopName = 'Wasana Cake',
  periodLabel
}) => {
  if (!type || !analytics) return null

  // State for search and filter within modals
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  // Print helper
  const handlePrint = () => {
    window.print()
  }

  // 1. REVENUE DATA
  const paymentBreakdown = analytics.paymentBreakdown || []
  const recentOrders = analytics.recentOrders || []
  const filteredOrders = useMemo(() => {
    return recentOrders.filter((ord: any) => {
      const matchSearch = searchTerm
        ? ord.order_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ord.payment_method?.toLowerCase().includes(searchTerm.toLowerCase())
        : true
      const matchCat = categoryFilter !== 'ALL' ? ord.payment_method === categoryFilter : true
      return matchSearch && matchCat
    })
  }, [recentOrders, searchTerm, categoryFilter])

  // 2. EXPENSES DATA
  const owner = analytics.ownerMetrics || {}
  const detailedExpenses = owner.detailedExpenses || []
  const expenseCategories = owner.expenseCategories || []
  const filteredExpenses = useMemo(() => {
    return detailedExpenses.filter((exp: any) => {
      const matchSearch = searchTerm
        ? (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (exp.added_by && exp.added_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()))
        : true
      const matchCat = categoryFilter !== 'ALL' ? exp.category === categoryFilter : true
      return matchSearch && matchCat
    })
  }, [detailedExpenses, searchTerm, categoryFilter])

  // 3. INVENTORY DATA
  const lowStockList = owner.lowStockList || []
  const damageLossList = owner.damageLossList || []
  const filteredLowStock = useMemo(() => {
    return lowStockList.filter((item: any) => {
      const matchSearch = searchTerm
        ? (item.product_name && item.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.item_code && item.item_code.toLowerCase().includes(searchTerm.toLowerCase()))
        : true
      const matchCat = categoryFilter !== 'ALL' ? item.category_name === categoryFilter : true
      return matchSearch && matchCat
    })
  }, [lowStockList, searchTerm, categoryFilter])

  // CSV Export for the current modal
  const handleExportCSV = () => {
    let headers: string[] = []
    let rows: any[][] = []
    let filename = `report_${type}_${dayjs().format('YYYY-MM-DD')}.csv`

    if (type === 'revenue' || type === 'orders') {
      headers = ['Order No', 'Date Time', 'Items', 'Payment Method', 'Discount (Rs)', 'Total Amount (Rs)', 'Status']
      rows = filteredOrders.map((o: any) => [
        `"${o.order_no}"`,
        `"${formatDateTime(o.created_at)}"`,
        o.items_count,
        `"${o.payment_method}"`,
        o.discount_amount || 0,
        o.total_amount,
        `"${o.status}"`
      ])
    } else if (type === 'expenses') {
      headers = ['Date', 'Category', 'Description', 'Added By', 'Payment Method', 'Amount (Rs)', 'Notes']
      rows = filteredExpenses.map((e: any) => [
        `"${e.expense_date}"`,
        `"${e.category}"`,
        `"${e.description}"`,
        `"${e.added_by}"`,
        `"${e.payment_method}"`,
        e.amount,
        `"${e.notes || ''}"`
      ])
    } else if (type === 'inventory') {
      headers = ['Product Name', 'Item Code', 'Category', 'Current Stock', 'Min Threshold', 'Cost Price (Rs)', 'Retail Price (Rs)', 'Unit']
      rows = filteredLowStock.map((i: any) => [
        `"${i.product_name}"`,
        `"${i.item_code}"`,
        `"${i.category_name}"`,
        i.current_stock,
        i.min_quantity,
        i.cost_price,
        i.price,
        `"${i.unit || 'pcs'}"`
      ])
    } else if (type === 'profit') {
      headers = ['Metric', 'Amount (Rs)', 'Percentage']
      rows = [
        ['Gross Sales Revenue', analytics.summary.total_revenue, '100%'],
        ['Cost of Goods Sold (COGS)', analytics.summary.total_cost, `${((analytics.summary.total_cost / (analytics.summary.total_revenue || 1)) * 100).toFixed(1)}%`],
        ['Gross Profit', owner.grossProfit || 0, `${owner.grossProfitMargin || 0}%`],
        ['Operating Expenses', owner.totalExpenses || 0, `${((owner.totalExpenses / (analytics.summary.total_revenue || 1)) * 100).toFixed(1)}%`],
        ['Net Profit (Take-Home)', owner.netProfit || 0, `${owner.netProfitMargin || 0}%`]
      ]
    } else if (type === 'cash') {
      headers = ['Cash Stream', 'Amount (Rs)', 'Description']
      rows = [
        ['Cash Inflow (Sales)', owner.cashDrawer?.cashSales || 0, 'Direct cash collected from customers'],
        ['Cash Outflow (Expenses)', owner.cashDrawer?.cashExpenses || 0, 'Counter petty cash paid out'],
        ['Expected Cash In Register', owner.cashDrawer?.netCashEstimated || 0, 'Net cash physically in register']
      ]
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Titles and icons by modal type
  const modalConfig = {
    revenue: {
      title: 'Daily Sales & Income Breakdown',
      sinhalaTitle: 'දෛනික ආදායම් හා විකුණුම් විස්තරය',
      icon: <DollarSign size={22} color="#16a34a" />,
      color: '#16a34a',
      bgColor: '#dcfce7'
    },
    expenses: {
      title: 'Daily Operating Expenses Audit',
      sinhalaTitle: 'දෛනික මෙහෙයුම් වියදම් විගණනය',
      icon: <TrendingDown size={22} color="#ea580c" />,
      color: '#ea580c',
      bgColor: '#ffedd5'
    },
    profit: {
      title: 'Executive Profit & Loss (P&L) Statement',
      sinhalaTitle: 'විධායක ලාභ-අලාභ (P&L) වාර්තාව',
      icon: <TrendingUp size={22} color="#059669" />,
      color: '#059669',
      bgColor: '#d1fae5'
    },
    inventory: {
      title: 'Inventory Capital & Low Stock Audit',
      sinhalaTitle: 'තොග වටිනාකම හා අඩු තොග විගණනය',
      icon: <Package size={22} color="#2563eb" />,
      color: '#2563eb',
      bgColor: '#dbeafe'
    },
    orders: {
      title: 'Customer Bills & Order Volume Log',
      sinhalaTitle: 'මුළු බිල්පත් හා පාරිභෝගික වාර්තාව',
      icon: <Receipt size={22} color="#0284c7" />,
      color: '#0284c7',
      bgColor: '#e0f2fe'
    },
    cash: {
      title: 'Counter Cash Reconciliation & Drawer Audit',
      sinhalaTitle: 'මුදල් ලාච්චුවේ ශේෂය හා ගිණුම් විගණනය',
      icon: <Wallet size={22} color="#d97706" />,
      color: '#d97706',
      bgColor: '#fef3c7'
    }
  }[type]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border, #e2e8f0)',
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2, #f8fafc)',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: modalConfig.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {modalConfig.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                  {modalConfig.title}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: modalConfig.bgColor,
                    color: modalConfig.color
                  }}
                >
                  LIVE BREAKDOWN
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
                {modalConfig.sinhalaTitle} · {shopName} ({periodLabel})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text-primary, #1e293b)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Export this data to CSV"
            >
              <Download size={14} color="var(--primary, #16a34a)" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text-primary, #1e293b)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Print this sheet"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary, #64748b)'
              }}
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ──────────────── 1. REVENUE BREAKDOWN ──────────────── */}
          {type === 'revenue' && (
            <>
              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Gross Revenue</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>{formatCurrency(analytics.summary.total_revenue)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>{analytics.summary.total_orders} total orders</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Subtotal (Before Disc.)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary, #0f172a)', marginTop: 4 }}>{formatCurrency(analytics.summary.total_subtotal || analytics.summary.total_revenue)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Item base pricing</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Discounts Awarded</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#d97706', marginTop: 4 }}>{formatCurrency(analytics.summary.total_discount)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Customer savings</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Avg Ticket (AOV)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#8b5cf6', marginTop: 4 }}>{formatCurrency(analytics.summary.avg_order_value)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Per completed bill</div>
                </div>
              </div>

              {/* Payment Methods Distribution */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary, #0f172a)' }}>
                  Payment Method Distribution (ගෙවීම් ක්‍රම)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {paymentBreakdown.map((pm: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: 'var(--surface-2, #f8fafc)',
                        border: '1px solid var(--border, #e2e8f0)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                          {pm.method}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>
                          {pm.percent}%
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                        {formatCurrency(pm.total_amount)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
                        {pm.count} transaction{pm.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Completed Orders List */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                    Completed Orders for {periodLabel} ({filteredOrders.length})
                  </h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2, #f8fafc)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
                      <Search size={13} color="var(--text-muted, #94a3b8)" />
                      <input
                        type="text"
                        placeholder="Search bill no..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 340 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Bill No.</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Time</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Items</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Method</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Discount</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Total (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length > 0 ? (
                        filteredOrders.map((ord: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{ord.order_no}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #64748b)' }}>{formatDateTime(ord.created_at)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{ord.items_count || 1}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2, #f8fafc)' }}>
                                {ord.payment_method}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: ord.discount_amount > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)' }}>
                              {ord.discount_amount > 0 ? formatCurrency(ord.discount_amount) : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                              {formatCurrency(ord.total_amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                            No orders found matching the filter
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ──────────────── 2. EXPENSES BREAKDOWN ──────────────── */}
          {type === 'expenses' && (
            <>
              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Total Expenses</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ea580c', marginTop: 4 }}>{formatCurrency(owner.totalExpenses || 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>{detailedExpenses.length} expense vouchers</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Cash Drawer Outflow</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>{formatCurrency(owner.cashDrawer?.cashExpenses || owner.totalExpenses || 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Petty cash paid from counter</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Active Categories</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary, #0f172a)', marginTop: 4 }}>{expenseCategories.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Expense types logged</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>% of Gross Revenue</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ea580c', marginTop: 4 }}>
                    {analytics.summary.total_revenue > 0 ? `${Math.round(((owner.totalExpenses || 0) / analytics.summary.total_revenue) * 100)}%` : '0%'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Operational overhead load</div>
                </div>
              </div>

              {/* Categories Bar / Breakdown */}
              {expenseCategories.length > 0 && (
                <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary, #0f172a)' }}>
                    Expense Categories Breakdown (වියදම් වර්ගීකරණය)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {expenseCategories.map((c: any, idx: number) => {
                      const share = owner.totalExpenses > 0 ? Math.round((c.total_amount / owner.totalExpenses) * 100) : 0
                      return (
                        <div key={idx} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{c.category}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c' }}>{share}%</span>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#ea580c' }}>{formatCurrency(c.total_amount)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>{c.count} records</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Expense Vouchers List */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                    Itemized Operating Expense Vouchers ({filteredExpenses.length})
                  </h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {expenseCategories.length > 0 && (
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 12, background: 'var(--surface-2, #f8fafc)' }}
                      >
                        <option value="ALL">All Categories</option>
                        {expenseCategories.map((c: any) => (
                          <option key={c.category} value={c.category}>{c.category}</option>
                        ))}
                      </select>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2, #f8fafc)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
                      <Search size={13} color="var(--text-muted, #94a3b8)" />
                      <input
                        type="text"
                        placeholder="Search description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 340 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Category</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Description</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Added By</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Payment</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.length > 0 ? (
                        filteredExpenses.map((exp: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #64748b)' }}>{exp.expense_date}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#ffedd5', color: '#ea580c' }}>
                                {exp.category}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                              {exp.description || 'No description'}
                              {exp.notes ? <div style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)' }}>{exp.notes}</div> : null}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>{exp.added_by || 'Staff'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
                                {exp.payment_method || 'CASH'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>
                              {formatCurrency(exp.amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                            No expenses recorded for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ──────────────── 3. PROFIT & LOSS BREAKDOWN ──────────────── */}
          {type === 'profit' && (
            <>
              {/* Full P&L Statement Waterfall */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 20 }}>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px', color: 'var(--text-primary, #0f172a)' }}>
                  Executive Profit &amp; Loss Breakdown (P&amp;L Waterfall)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Step 1: Gross Revenue */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 99, background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>1</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>Gross Sales Revenue (මුළු විකුණුම් ආදායම)</div>
                        <div style={{ fontSize: 11, color: '#15803d' }}>Total customer billings across all categories</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>{formatCurrency(analytics.summary.total_revenue)}</div>
                  </div>

                  {/* Step 2: Cost of Goods Sold */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 99, background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>2</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#3730a3' }}>(-) Cost of Goods Sold (COGS - භාණ්ඩ පිරිවැය)</div>
                        <div style={{ fontSize: 11, color: '#4338ca' }}>Direct ingredient and recipe wholesale production cost</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#6366f1' }}>-{formatCurrency(analytics.summary.total_cost)}</div>
                  </div>

                  {/* Step 3: Gross Profit */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, background: '#ecfeff', border: '1px solid #a5f3fc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 99, background: '#0891b2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>3</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#155e75' }}>(=) Gross Profit (දළ ලාභය)</div>
                        <div style={{ fontSize: 11, color: '#0e7490' }}>Gross Margin: {owner.grossProfitMargin || analytics.summary.profit_margin_pct || 0}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0891b2' }}>{formatCurrency(owner.grossProfit || analytics.summary.estimated_profit || 0)}</div>
                  </div>

                  {/* Step 4: Operating Expenses */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 99, background: '#ea580c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>4</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#9a3412' }}>(-) Operating Expenses (මෙහෙයුම් වියදම්)</div>
                        <div style={{ fontSize: 11, color: '#c2410c' }}>Rent, utilities, wages, maintenance, transport, etc.</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#ea580c' }}>-{formatCurrency(owner.totalExpenses || 0)}</div>
                  </div>

                  {/* Step 5: Net Profit Bottom Line */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 18px',
                      borderRadius: 10,
                      background: (owner.netProfit || 0) >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                      border: `2px solid ${(owner.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 99, background: (owner.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>5</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: (owner.netProfit || 0) >= 0 ? '#166534' : '#991b1b' }}>
                          (=) NET BOTTOM LINE PROFIT (හිමිකරුගේ ශුද්ධ ලාභය)
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: (owner.netProfit || 0) >= 0 ? '#15803d' : '#b91c1c' }}>
                          Net Take-Home Margin: {owner.netProfitMargin || 0}% of sales
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: (owner.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                      {formatCurrency(owner.netProfit || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ──────────────── 4. INVENTORY BREAKDOWN ──────────────── */}
          {type === 'inventory' && (
            <>
              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Capital in Stock (At Cost)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary, #0f172a)', marginTop: 4 }}>
                    {formatCurrency(owner.inventoryValuation?.totalCostValue || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>{owner.inventoryValuation?.totalProducts || 0} active products</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Retail Selling Value</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#2563eb', marginTop: 4 }}>
                    {formatCurrency(owner.inventoryValuation?.totalRetailValue || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                    +{formatCurrency(owner.inventoryValuation?.potentialMarginValue || 0)} profit potential
                  </div>
                </div>
                <div style={{ background: (owner.inventoryValuation?.lowStockCount || 0) > 0 ? '#fef3c7' : 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>Low Stock Items</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#d97706', marginTop: 4 }}>
                    {owner.inventoryValuation?.lowStockCount || 0}
                  </div>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>Need re-ordering soon</div>
                </div>
                <div style={{ background: (owner.inventoryValuation?.outOfStockCount || 0) > 0 ? '#fee2e2' : 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Out of Stock</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>
                    {owner.inventoryValuation?.outOfStockCount || 0}
                  </div>
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Completely depleted items</div>
                </div>
              </div>

              {/* Critical Low Stock Items Table */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={18} color="#d97706" />
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                      Critical Low Stock &amp; Depleted Items ({filteredLowStock.length})
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2, #f8fafc)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
                    <Search size={13} color="var(--text-muted, #94a3b8)" />
                    <input
                      type="text"
                      placeholder="Search low stock item..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140 }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Item Name</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Code</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Category</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Current Stock</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Min Threshold</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Cost Price</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Selling Price</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLowStock.length > 0 ? (
                        filteredLowStock.map((item: any, idx: number) => {
                          const isOut = (item.current_stock || 0) <= 0
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{item.product_name}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #64748b)' }}>{item.item_code}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #64748b)' }}>{item.category_name}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: isOut ? '#dc2626' : '#d97706' }}>
                                {item.current_stock} {item.unit || 'pcs'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>{item.min_quantity}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary, #64748b)' }}>{formatCurrency(item.cost_price)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{formatCurrency(item.price)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: isOut ? '#fee2e2' : '#fef3c7', color: isOut ? '#dc2626' : '#d97706' }}>
                                  {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                            ✓ All items have sufficient stock levels!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Spoilage / Damage Loss Table */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#dc2626' }}>
                  Spoilage, Expiry &amp; Damage Loss Incidents (අපතේ යාම් / හානි වූ තොග)
                </h4>
                {damageLossList.length > 0 ? (
                  <div style={{ overflowX: 'auto', maxHeight: 220 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Item</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Quantity Lost</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Loss Amount (Rs.)</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Reason / Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {damageLossList.map((d: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '6px 10px', color: 'var(--text-secondary, #64748b)' }}>{formatDateTime(d.created_at)}</td>
                            <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{d.product_name}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{d.quantity}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 800 }}>{formatCurrency(d.total_cost)}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-secondary, #64748b)' }}>{d.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>
                    No damage or spoilage loss recorded for this period.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ──────────────── 5. ORDERS BREAKDOWN ──────────────── */}
          {type === 'orders' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Total Completed Bills</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0284c7', marginTop: 4 }}>{analytics.summary.total_orders}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Transactions finalized</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Total Units Sold</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary, #0f172a)', marginTop: 4 }}>{analytics.summary.total_items_sold || 0}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Individual item count</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Average Ticket Value</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#8b5cf6', marginTop: 4 }}>{formatCurrency(analytics.summary.avg_order_value)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>Customer basket size</div>
                </div>
                <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Peak Hour Activity</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#16a34a', marginTop: 8 }}>{analytics.peakSlot?.label || 'Midday'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>{analytics.peakSlot ? `${analytics.peakSlot.orders} bills` : 'Highest velocity'}</div>
                </div>
              </div>

              {/* Orders Table */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                    Complete Transaction Log
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2, #f8fafc)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
                    <Search size={13} color="var(--text-muted, #94a3b8)" />
                    <input
                      type="text"
                      placeholder="Search bill..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140 }}
                    />
                  </div>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 340 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Order No</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Timestamp</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Items Count</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Payment Method</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Discount</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Total (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length > 0 ? (
                        filteredOrders.map((ord: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{ord.order_no}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #64748b)' }}>{formatDateTime(ord.created_at)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{ord.items_count || 1}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2, #f8fafc)' }}>
                                {ord.payment_method}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: ord.discount_amount > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)' }}>
                              {ord.discount_amount > 0 ? formatCurrency(ord.discount_amount) : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                              {formatCurrency(ord.total_amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                            No orders found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ──────────────── 6. CASH DRAWER BREAKDOWN ──────────────── */}
          {type === 'cash' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px 18px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Cash Inflow (Sales)</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                    {formatCurrency(owner.cashDrawer?.cashSales || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>Collected from physical cash bills</div>
                </div>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px 18px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Cash Outflow (Drawer Expenses)</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>
                    {formatCurrency(owner.cashDrawer?.cashExpenses || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Petty cash paid out of register</div>
                </div>

                <div style={{ background: '#eff6ff', border: '2px solid #2563eb', padding: '16px 18px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Net Cash in Drawer</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', marginTop: 4 }}>
                    {formatCurrency(owner.cashDrawer?.netCashEstimated || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 2 }}>Expected physical notes + coins (excl. opening float)</div>
                </div>
              </div>

              {/* Staff Breakdown */}
              <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 18 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary, #0f172a)' }}>
                  Cashier &amp; Staff Register Activity
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Staff Member</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Orders Finalized</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Revenue Collected</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Discounts</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Avg Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(owner.cashierPerformance || []).length > 0 ? (
                        owner.cashierPerformance.map((c: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{c.cashier_name}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{c.orders_count}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(c.total_revenue)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: c.total_discount > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)' }}>
                              {c.total_discount > 0 ? formatCurrency(c.total_discount) : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary, #64748b)' }}>{formatCurrency(c.avg_ticket)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                            No specific cashier transactions separated for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-2, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
            Showing verified offline-first ledger records from local SQLite POS database
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--text-primary, #1e293b)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
