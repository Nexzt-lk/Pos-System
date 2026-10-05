import React, { useState, useMemo } from 'react'
import {
  Truck,
  DollarSign,
  Search,
  Download,
  Banknote,
  Receipt,
  RefreshCw
} from 'lucide-react'
import { Select, Input, DatePicker, message } from 'antd'
import { StockPurchaseRecord } from '../../api/inventoryApi'
import { SupplierDto } from '../../api/suppliersApi'
import { formatCurrency, formatStockQty } from '../../lib/formatters'
import { downloadCsv, money, csvDate, CsvRow } from '../../lib/csvExport'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

interface StockPurchasesLedgerProps {
  purchases: StockPurchaseRecord[]
  suppliers: SupplierDto[]
  isLoading: boolean
  onRefresh: () => void
}

export const StockPurchasesLedger: React.FC<StockPurchasesLedgerProps> = ({
  purchases,
  suppliers,
  isLoading,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all')
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<string>('all')

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      // Search
      const searchLower = searchQuery.toLowerCase().trim()
      const matchSearch =
        !searchLower ||
        item.productName.toLowerCase().includes(searchLower) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(searchLower)) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(searchLower)) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(searchLower)) ||
        (item.note && item.note.toLowerCase().includes(searchLower))

      // Supplier
      const matchSupplier =
        selectedSupplier === 'all' ||
        item.supplierId === selectedSupplier ||
        item.supplierName.toLowerCase() === selectedSupplier.toLowerCase()

      // Payment
      const matchPayment =
        paymentFilter === 'all' ||
        (item.paymentMethod || 'CASH').toUpperCase() === paymentFilter.toUpperCase()

      // Date
      let matchDate = true
      const itemDate = dayjs(item.createdAt)
      const now = dayjs()

      if (dateFilter === 'today') {
        matchDate = itemDate.isSame(now, 'day')
      } else if (dateFilter === '7days') {
        matchDate = itemDate.isAfter(now.subtract(7, 'day'))
      } else if (dateFilter === '30days') {
        matchDate = itemDate.isAfter(now.subtract(30, 'day'))
      } else if (dateFilter === 'custom' && customRange && customRange[0] && customRange[1]) {
        matchDate =
          itemDate.isAfter(customRange[0].startOf('day')) &&
          itemDate.isBefore(customRange[1].endOf('day'))
      }

      return matchSearch && matchSupplier && matchPayment && matchDate
    })
  }, [purchases, searchQuery, selectedSupplier, paymentFilter, dateFilter, customRange])

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalExpenditure = filteredPurchases.reduce((acc, p) => acc + (p.totalCost || 0), 0)
    const totalBatches = filteredPurchases.length
    const uniqueSuppliers = new Set(filteredPurchases.map((p) => p.supplierName || 'Unknown')).size
    const cashExpenses = filteredPurchases
      .filter((p) => (p.paymentMethod || 'CASH').toUpperCase() === 'CASH')
      .reduce((acc, p) => acc + (p.totalCost || 0), 0)

    return {
      totalExpenditure,
      totalBatches,
      uniqueSuppliers,
      cashExpenses
    }
  }, [filteredPurchases])

  const handleExportCsv = () => {
    if (filteredPurchases.length === 0) {
      message.warning('No purchase records to export for this selection.')
      return
    }

    const rows: CsvRow[] = [
      ['STOCK PURCHASES & SUPPLIER EXPENSES LEDGER'],
      ['Generated On', dayjs().format('YYYY-MM-DD HH:mm:ss')],
      ['Total Records', filteredPurchases.length],
      ['Total Spending', money(metrics.totalExpenditure), 'LKR'],
      [''],
      [
        'Date & Time',
        'Product Name',
        'Item Code / SKU',
        'Supplier Name',
        'Quantity Received',
        'Unit',
        'Unit Cost (LKR)',
        'Total Cost (LKR)',
        'Payment Method',
        'Invoice / Bill No',
        'Recorded By',
        'Notes'
      ]
    ]

    filteredPurchases.forEach((p) => {
      rows.push([
        csvDate(p.createdAt),
        p.productName,
        p.itemCode || '—',
        p.supplierName || 'Direct Purchase',
        p.quantity,
        p.unit || 'pcs',
        money(p.costPerUnit),
        money(p.totalCost),
        p.paymentMethod || 'CASH',
        p.invoiceNo || '—',
        p.doneBy || 'Owner',
        p.note || ''
      ])
    })

    const fileName = `Stock_Purchases_Ledger_${dayjs().format('YYYY-MM-DD')}.csv`
    downloadCsv(fileName, rows)
    message.success(`Stock purchase ledger exported (${filteredPurchases.length} rows)`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── KPI Metrics Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {/* Total Stock Spending */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Stock Spending
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(metrics.totalExpenditure)}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>
              {metrics.totalBatches} inward stock batches
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669'
            }}
          >
            <DollarSign size={22} />
          </div>
        </div>

        {/* Suppliers Engaged */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suppliers Engaged
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {metrics.uniqueSuppliers}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
              Active vendor partners
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}
          >
            <Truck size={22} />
          </div>
        </div>

        {/* Cash Drawer Paid Out */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cash Paid from Drawer
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(metrics.cashExpenses)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 1 }}>
              Petty cash stock purchases
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}
          >
            <Banknote size={22} />
          </div>
        </div>

        {/* Average Batch Cost */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avg. Inward Batch
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(metrics.totalBatches > 0 ? metrics.totalExpenditure / metrics.totalBatches : 0)}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
              Per delivery intake
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569'
            }}
          >
            <Receipt size={22} />
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Input
            prefix={<Search size={15} color="#94a3b8" />}
            placeholder="Search by product, supplier, bill # or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ maxWidth: 300, borderRadius: 8 }}
          />

          <Select
            value={selectedSupplier}
            onChange={setSelectedSupplier}
            style={{ width: 220 }}
            options={[
              { value: 'all', label: 'All Suppliers (සියලු සැපයුම්කරුවන්)' },
              ...suppliers.map((s) => ({ value: s.name, label: s.name }))
            ]}
          />

          <Select
            value={paymentFilter}
            onChange={setPaymentFilter}
            style={{ width: 170 }}
            options={[
              { value: 'all', label: 'All Payment Methods' },
              { value: 'CASH', label: 'Cash from Drawer' },
              { value: 'BANK', label: 'Bank Transfer' },
              { value: 'CREDIT', label: 'Credit / Due' }
            ]}
          />

          <Select
            value={dateFilter}
            onChange={(v) => setDateFilter(v as any)}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'All Time' },
              { value: 'today', label: 'Today Only' },
              { value: '7days', label: 'Last 7 Days' },
              { value: '30days', label: 'Last 30 Days' },
              { value: 'custom', label: 'Custom Range...' }
            ]}
          />

          {dateFilter === 'custom' && (
            <RangePicker
              value={customRange as any}
              onChange={(dates) => setCustomRange(dates as any)}
              style={{ borderRadius: 8 }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#334155',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.borderColor = '#94a3b8'
                e.currentTarget.style.background = '#f8fafc'
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.borderColor = '#cbd5e1'
                e.currentTarget.style.background = '#ffffff'
              }
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#94a3b8'
              e.currentTarget.style.background = '#f8fafc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1'
              e.currentTarget.style.background = '#ffffff'
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Purchases Table ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Date & Time
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Product
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Supplier (සැපයුම්කරු)
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Inward Qty
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Unit Cost (Rs.)
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Total Cost (වියදම)
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                  Payment Source
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bill / Reference
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Logged By
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((item, idx) => {
                const method = (item.paymentMethod || 'CASH').toUpperCase()
                const isCash = method === 'CASH'
                const isBank = method === 'BANK' || method === 'CARD'

                return (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.1s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Date */}
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>
                        {dayjs(item.createdAt).format('YYYY-MM-DD')}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {dayjs(item.createdAt).format('hh:mm A')}
                      </div>
                    </td>

                    {/* Product */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.productName}</div>
                      {item.itemCode && (
                        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#64748b' }}>
                          SKU: {item.itemCode}
                        </span>
                      )}
                    </td>

                    {/* Supplier */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 6 }}>
                        <Truck size={13} color="#16a34a" />
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#166534' }}>
                          {item.supplierName || 'Direct Purchase'}
                        </span>
                      </div>
                    </td>

                    {/* Qty */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      +{formatStockQty(item.quantity, item.unit)}
                    </td>

                    {/* Unit Cost */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                      {formatCurrency(item.costPerUnit)}
                    </td>

                    {/* Total Cost */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 900, color: '#15803d', fontSize: 14 }}>
                        {formatCurrency(item.totalCost)}
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: isCash ? '#f0fdf4' : isBank ? '#eff6ff' : '#fffbeb',
                          color: isCash ? '#15803d' : isBank ? '#1d4ed8' : '#b45309',
                          border: `1px solid ${isCash ? '#bbf7d0' : isBank ? '#bfdbfe' : '#fde68a'}`
                        }}
                      >
                        {isCash ? 'Cash Drawer' : isBank ? 'Bank / Cheque' : 'Credit / Due'}
                      </span>
                    </td>

                    {/* Bill Ref */}
                    <td style={{ padding: '12px 16px' }}>
                      {item.invoiceNo ? (
                        <span style={{ fontSize: 11.5, fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: 4, color: '#334155' }}>
                          {item.invoiceNo}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                      {item.note && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.note}</div>
                      )}
                    </td>

                    {/* Done By */}
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{item.doneBy || 'Owner'}</span>
                    </td>
                  </tr>
                )
              })}

              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                        color: '#94a3b8'
                      }}
                    >
                      <Receipt size={28} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      No Stock Purchase Records Found
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      {searchQuery
                        ? `No purchases matching "${searchQuery}".`
                        : 'Stock receipts and supplier purchases recorded during inventory updates will appear here.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default StockPurchasesLedger
