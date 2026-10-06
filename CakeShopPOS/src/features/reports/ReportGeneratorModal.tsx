import React, { useState } from 'react'
import {
  X,
  Printer,
  Download,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Package,
  Crown
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import dayjs from 'dayjs'
import { message } from 'antd'
import { downloadCsv, money, qty, pct, csvDate, csvTime, CsvRow } from '../../lib/csvExport'

export type ReportKind = 'pnl' | 'sales' | 'expenses' | 'inventory' | 'products'

interface ReportGeneratorModalProps {
  onClose: () => void
  analytics: any
  currentShop?: any
  currentPeriodLabel: string
}

export const ReportGeneratorModal: React.FC<ReportGeneratorModalProps> = ({
  onClose,
  analytics,
  currentShop,
  currentPeriodLabel
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportKind>('pnl')

  if (!analytics) return null

  const owner = analytics.ownerMetrics || {}
  const summary = analytics.summary || {}
  const shopName = currentShop?.name || 'Wasana Cake - Katugastota'
  const shopAddress = currentShop?.address || 'Katugastota, Kandy, Sri Lanka'
  const shopPhone = currentShop?.phone || '+94 81 249 2000'
  const generatedTime = dayjs().format('YYYY-MM-DD hh:mm A')

  // CSV Export for the chosen report type (Pure single-table per report, uniform columns, no metadata noise)
  const handleExportCSV = () => {
    const revenue = Number(summary.total_revenue) || 0
    const pctOfRevenue = (v: number) => (revenue > 0 ? (v / revenue) * 100 : 0)
    const rangeLabel = analytics.startDate === analytics.endDate
      ? (analytics.startDate || dayjs().format('YYYY-MM-DD'))
      : `${analytics.startDate || dayjs().format('YYYY-MM-DD')}_to_${analytics.endDate || dayjs().format('YYYY-MM-DD')}`

    if (selectedReport === 'pnl') {
      const cd = owner.cashDrawer || {}
      const rows: CsvRow[] = [
        ['Section', 'Line Item', 'Amount (LKR)', '% of Net Revenue', 'Description'],
        ['1. REVENUE', 'Gross Orders Subtotal', money(summary.total_subtotal), pct(pctOfRevenue(Number(summary.total_subtotal) || 0)), 'Total sales volume before discounts'],
        ['1. REVENUE', 'Customer Discounts', money(summary.total_discount), pct(pctOfRevenue(Number(summary.total_discount) || 0)), 'Customer promotions and coupon deductions'],
        ['1. REVENUE', 'Tax / VAT Collected', money(summary.total_tax), pct(pctOfRevenue(Number(summary.total_tax) || 0)), 'Sales tax collected on completed orders'],
        ['1. REVENUE', 'Net Sales Revenue', money(revenue), '100.0%', 'Gross Subtotal minus Customer Discounts'],
        ['2. COST OF SALES', 'Cost of Goods Sold (COGS)', money(summary.total_cost), pct(pctOfRevenue(Number(summary.total_cost) || 0)), 'Direct recipe and wholesale cost of sold products'],
        ['3. PROFITABILITY', 'Gross Profit', money(owner.grossProfit ?? summary.estimated_profit), pct(owner.grossProfitMargin ?? summary.profit_margin_pct), 'Net Sales Revenue minus Cost of Goods Sold'],
        ['4. OPERATING EXPENSES', 'Total Operating Expenses', money(owner.totalExpenses), pct(pctOfRevenue(Number(owner.totalExpenses) || 0)), 'Salaries, utilities, packaging, rent and maintenance'],
        ['5. PROFITABILITY', 'Net Operating Profit (Bottom Line)', money(owner.netProfit), pct(owner.netProfitMargin), 'Gross Profit minus Operating Expenses'],
        ['6. CASH RECONCILIATION', 'Physical Cash Collected', money(cd.cashSales), pct(pctOfRevenue(Number(cd.cashSales) || 0)), 'Physical cash tenders received into drawer from sales'],
        ['6. CASH RECONCILIATION', 'Physical Cash Paid Out', money(cd.cashExpenses), pct(pctOfRevenue(Number(cd.cashExpenses) || 0)), 'Petty cash expenses paid out of register'],
        ['6. CASH RECONCILIATION', 'Net Cash in Register', money(cd.netCashEstimated), pct(pctOfRevenue(Number(cd.netCashEstimated) || 0)), 'Cash sales minus petty cash expenses']
      ]
      downloadCsv(`Executive_PnL_Statement_${rangeLabel}.csv`, rows)
      message.success('Executive P&L statement exported successfully')

    } else if (selectedReport === 'sales') {
      const orders = analytics.recentOrders || []
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
        const itm = Number(o.items_count) || 0
        const sub = Number(o.subtotal ?? o.total_amount) || 0
        const disc = Number(o.discount_amount) || 0
        const tx = Number(o.tax_amount) || 0
        const tot = Number(o.total_amount) || 0

        totalItems += itm
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
          qty(itm),
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

      downloadCsv(`Sales_Orders_Ledger_${rangeLabel}.csv`, rows)
      message.success(`Sales ledger exported successfully (${orders.length} orders)`)

    } else if (selectedReport === 'expenses') {
      const expenses = owner.detailedExpenses || []
      const headers = [
        'Voucher ID',
        'Date',
        'Category',
        'Description',
        'Recorded By',
        'Payment Method',
        'Amount (LKR)',
        'Notes'
      ]

      let totalAmount = 0
      const rows: CsvRow[] = [headers]

      for (const e of expenses) {
        const amt = Number(e.amount) || 0
        totalAmount += amt

        rows.push([
          e.id || e.local_id || '',
          csvDate(e.expense_date),
          e.category || 'Other',
          e.description || '',
          e.added_by || 'Staff',
          (e.payment_method || 'CASH').toUpperCase(),
          money(amt),
          e.notes || ''
        ])
      }

      rows.push([
        `TOTAL (${expenses.length} Vouchers)`,
        '',
        '',
        '',
        '',
        '',
        money(totalAmount),
        ''
      ])

      downloadCsv(`Operating_Expenses_Ledger_${rangeLabel}.csv`, rows)
      message.success(`Operating expenses exported successfully (${expenses.length} vouchers)`)

    } else if (selectedReport === 'inventory') {
      const lowStock = owner.lowStockList || []
      const headers = [
        'Item Code',
        'Product Name',
        'Category',
        'Current Stock',
        'Min Threshold',
        'Unit',
        'Cost Price (LKR)',
        'Retail Price (LKR)',
        'Total Cost Value (LKR)',
        'Stock Status'
      ]

      let totalStockCost = 0
      const rows: CsvRow[] = [headers]

      for (const i of lowStock) {
        const curStock = Number(i.current_stock) || 0
        const costPrice = Number(i.cost_price) || 0
        const stockCost = curStock * costPrice
        totalStockCost += stockCost

        rows.push([
          i.item_code || '',
          i.product_name || '',
          i.category_name || '',
          qty(curStock),
          qty(i.min_quantity || 0),
          i.unit || 'pcs',
          money(costPrice),
          money(i.price),
          money(stockCost),
          curStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'
        ])
      }

      rows.push([
        `TOTAL (${lowStock.length} Low Stock Items)`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        money(totalStockCost),
        ''
      ])

      downloadCsv(`Inventory_LowStock_Audit_${rangeLabel}.csv`, rows)
      message.success(`Inventory low-stock audit exported successfully (${lowStock.length} items)`)

    } else if (selectedReport === 'products') {
      const items = analytics.itemBreakdown || []
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

      for (const p of items) {
        const q = Number(p.total_qty) || 0
        const d = Number(p.total_discount) || 0
        const r = Number(p.total_revenue) || 0
        const c = Number(p.total_cogs) || 0
        const profit = Number(p.gross_profit) || 0

        totalQty += q
        totalDiscount += d
        totalRevenue += r
        totalCogs += c
        totalProfit += profit

        rows.push([
          p.item_code || '',
          p.product_name || '',
          p.category_name || '',
          qty(q),
          money(p.avg_unit_price),
          money(p.avg_cost_price),
          money(d),
          money(r),
          money(c),
          money(profit),
          pct(p.margin_pct),
          pct(p.revenue_share_pct)
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

      downloadCsv(`Product_Sales_Profit_${rangeLabel}.csv`, rows)
      message.success(`Product profit report exported successfully (${items.length} products)`)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const reportTypes = [
    {
      key: 'pnl' as ReportKind,
      title: 'Executive P&L Statement',
      sinhala: 'සමස්ත ලාභ-අලාභ වාර්තාව',
      desc: 'Revenue, COGS, operating expenses & net margins',
      icon: <Crown size={16} />
    },
    {
      key: 'sales' as ReportKind,
      title: 'Sales & Invoices Report',
      sinhala: 'දෛනික විකුණුම් වාර්තාව',
      desc: 'Bills log, payments, discounts & ticket averages',
      icon: <DollarSign size={16} />
    },
    {
      key: 'expenses' as ReportKind,
      title: 'Operating Expenses Report',
      sinhala: 'දෛනික වියදම් විස්තර වාර්තාව',
      desc: 'Vouchers categorized by rent, utilities, wages, etc.',
      icon: <TrendingDown size={16} />
    },
    {
      key: 'inventory' as ReportKind,
      title: 'Inventory & Stock Audit',
      sinhala: 'තොග හා අඩු තොග වාර්තාව',
      desc: 'Locked capital, critical low stock & damaged loss',
      icon: <Package size={16} />
    },
    {
      key: 'products' as ReportKind,
      title: 'Item Sales & Profit Contribution',
      sinhala: 'භාණ්ඩ අනුව ලාභ වාර්තාව',
      desc: 'Product unit sales, revenue share & gross margins',
      icon: <TrendingUp size={16} />
    }
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15, 23, 42, 0.7)',
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
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
          width: '100%',
          maxWidth: 1040,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Official Report Generator (ව්‍යාපාරික වාර්තා සකසන්න)
              </h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                Generate, preview, print, or export executive-grade financial &amp; operational reports
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
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={14} color="#0f172a" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <Printer size={14} />
              <span>Print Report / PDF</span>
            </button>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Report Type Selector Pills */}
        <div
          style={{
            padding: '12px 24px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: 10,
            overflowX: 'auto'
          }}
        >
          {reportTypes.map((rt) => {
            const isSelected = selectedReport === rt.key
            return (
              <button
                key={rt.key}
                onClick={() => setSelectedReport(rt.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  background: isSelected ? '#0f172a' : '#f8fafc',
                  color: isSelected ? '#ffffff' : '#0f172a',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <span style={{ color: isSelected ? '#ffffff' : '#475569', display: 'flex' }}>
                  {rt.icon}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#ffffff' : '#0f172a' }}>
                    {rt.title}
                  </div>
                  <div style={{ fontSize: 10, color: isSelected ? '#cbd5e1' : '#64748b' }}>
                    {rt.sinhala}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Document Preview Pane */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', background: '#e2e8f0' }}>
          {/* Printable Report Sheet Document */}
          <div
            id="printable-report-content"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '36px 42px',
              maxWidth: 880,
              margin: '0 auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              color: '#0f172a',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}
          >
            {/* Store & Report Letterhead */}
            <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', textTransform: 'uppercase', color: '#0f172a' }}>
                  {shopName}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{shopAddress} · Tel: {shopPhone}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>POS Management &amp; Fiscal Audit System</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: '#16a34a' }}>
                  {reportTypes.find(r => r.key === selectedReport)?.title}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginTop: 3 }}>
                  Period: {currentPeriodLabel}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Generated on: {generatedTime}
                </div>
              </div>
            </div>

            {/* 1. REPORT CONTENT: P&L STATEMENT */}
            {selectedReport === 'pnl' && (
              <div>
                {/* Highlights Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Revenue</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{formatCurrency(summary.total_revenue || 0)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Product Cost (COGS)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1', marginTop: 4 }}>{formatCurrency(summary.total_cost || 0)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Operating Expenses</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#ea580c', marginTop: 4 }}>{formatCurrency(owner.totalExpenses || 0)}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #86efac' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Net Profit</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>{formatCurrency(owner.netProfit || 0)}</div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800 }}>Financial Statement Line</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>Amount (Rs.)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>% of Gross Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>1. Gross Sales Revenue</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(summary.total_revenue || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>100.0%</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', color: '#64748b', paddingLeft: 24 }}>- Gross Subtotal (Before Discounts)</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{formatCurrency(summary.total_subtotal || summary.total_revenue || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>-</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', color: '#d97706', paddingLeft: 24 }}>- Total Discounts Awarded</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#d97706' }}>-{formatCurrency(summary.total_discount || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#d97706' }}>{summary.total_revenue > 0 ? `${((summary.total_discount / summary.total_revenue) * 100).toFixed(1)}%` : '0%'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#6366f1' }}>2. Less: Cost of Goods Sold (COGS)</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#6366f1' }}>-{formatCurrency(summary.total_cost || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6366f1' }}>{summary.total_revenue > 0 ? `${((summary.total_cost / summary.total_revenue) * 100).toFixed(1)}%` : '0%'}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>3. GROSS PROFIT (දළ ලාභය)</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#0891b2' }}>{formatCurrency(owner.grossProfit || summary.estimated_profit || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0891b2' }}>{owner.grossProfitMargin || summary.profit_margin_pct || 0}%</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ea580c' }}>4. Less: Operating Expenses</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>-{formatCurrency(owner.totalExpenses || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ea580c' }}>{summary.total_revenue > 0 ? `${((owner.totalExpenses / summary.total_revenue) * 100).toFixed(1)}%` : '0%'}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', background: '#f0fdf4' }}>
                      <td style={{ padding: '12px', fontWeight: 900, fontSize: 13, color: '#166534' }}>5. NET BOTTOM LINE PROFIT (ශුද්ධ ලාභය)</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#16a34a' }}>{formatCurrency(owner.netProfit || 0)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#16a34a' }}>{owner.netProfitMargin || 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. REPORT CONTENT: SALES & INVOICES */}
            {selectedReport === 'sales' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Revenue</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{formatCurrency(summary.total_revenue || 0)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Orders</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{summary.total_orders || 0}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Avg Ticket</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6', marginTop: 4 }}>{formatCurrency(summary.avg_order_value || 0)}</div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Order No</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Date &amp; Time</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Items</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Method</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Discount</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.recentOrders || []).map((o: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{o.order_no}</td>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{formatDateTime(o.created_at)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{o.items_count || 1}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{o.payment_method}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{o.discount_amount > 0 ? formatCurrency(o.discount_amount) : '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(o.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. REPORT CONTENT: OPERATING EXPENSES */}
            {selectedReport === 'expenses' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: '#fff7ed', padding: 12, borderRadius: 8, border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>Total Operating Expenses</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#ea580c', marginTop: 4 }}>{formatCurrency(owner.totalExpenses || 0)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Expense Vouchers</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{(owner.detailedExpenses || []).length}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Drawer Cash Payouts</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{formatCurrency(owner.cashDrawer?.cashExpenses || owner.totalExpenses || 0)}</div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Date</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Category</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Description</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Added By</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Payment Mode</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(owner.detailedExpenses || []).map((e: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{e.expense_date}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{e.category}</td>
                        <td style={{ padding: '6px 8px' }}>{e.description || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{e.added_by || 'Staff'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{e.payment_method || 'CASH'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>{formatCurrency(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. REPORT CONTENT: INVENTORY & LOW STOCK */}
            {selectedReport === 'inventory' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cost Value (Locked)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{formatCurrency(owner.inventoryValuation?.totalCostValue || 0)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Retail Selling Value</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{formatCurrency(owner.inventoryValuation?.totalRetailValue || 0)}</div>
                  </div>
                  <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Low Stock Items</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginTop: 4 }}>{owner.inventoryValuation?.lowStockCount || 0}</div>
                  </div>
                  <div style={{ background: '#fee2e2', padding: 12, borderRadius: 8, border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Out of Stock</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{owner.inventoryValuation?.outOfStockCount || 0}</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>
                  Critical Low Stock &amp; Depleted Inventory Reorder Schedule
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Product Name</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Code</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Category</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Current Stock</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Min Stock</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Cost Price</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Retail Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(owner.lowStockList || []).map((i: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{i.product_name}</td>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{i.item_code}</td>
                        <td style={{ padding: '6px 8px' }}>{i.category_name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: (i.current_stock || 0) <= 0 ? '#dc2626' : '#d97706' }}>
                          {i.current_stock} {i.unit || 'pcs'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{i.min_quantity}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(i.cost_price)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(i.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. REPORT CONTENT: PRODUCTS PROFIT */}
            {selectedReport === 'products' && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Product Name</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>Category</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Qty Sold</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Revenue</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>COGS</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Gross Profit</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.itemBreakdown || []).map((p: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{p.product_name}</td>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{p.category_name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{p.total_qty}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(p.total_revenue)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6366f1' }}>{formatCurrency(p.total_cogs)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#0891b2' }}>{formatCurrency(p.gross_profit)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{p.margin_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signatures & Certification Block */}
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 28, marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'center', fontSize: 11 }}>
              <div>
                <div style={{ borderBottom: '1px dashed #94a3b8', height: 24, marginBottom: 6 }} />
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Prepared By (Cashier/Staff)</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>Signature &amp; Date</div>
              </div>

              <div>
                <div style={{ borderBottom: '1px dashed #94a3b8', height: 24, marginBottom: 6 }} />
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Checked By (Store Manager)</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>Signature &amp; Date</div>
              </div>

              <div>
                <div style={{ borderBottom: '1px dashed #94a3b8', height: 24, marginBottom: 6 }} />
                <div style={{ fontWeight: 800, color: '#16a34a' }}>Approved By (Business Owner)</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>Official Seal &amp; Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
