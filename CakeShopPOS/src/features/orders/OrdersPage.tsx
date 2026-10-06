import React, { useState, useEffect, useMemo } from 'react'
import {
  DatePicker,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Modal,
  Space,
  Empty,
  Tooltip,
  Dropdown,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCw,
  Printer,
  Eye,
  Banknote,
  CreditCard,
  Clock,
  TrendingUp,
  ShieldCheck,
  Download
} from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { ordersApi, OrderDto, OrderItemDto } from '../../api/ordersApi'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatDateTime } from '../../lib/formatters'
import { ReceiptModal } from '../pos/ReceiptModal'
import { downloadCsv, money, qty, csvDate, csvTime, CsvRow } from '../../lib/csvExport'

export const OrdersPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  // Date selection state - defaults to today
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [orders, setOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  // Modal / Receipt preview state
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false)

  // Fetch orders for the chosen date
  const loadOrdersForDate = async (targetDate: Dayjs, branchId: string = selectedBranchId) => {
    setLoading(true)
    try {
      const fromStr = targetDate.startOf('day').toISOString()
      const toStr = targetDate.endOf('day').toISOString()
      const dateKey = targetDate.format('YYYY-MM-DD')

      // Fetch from local SQLite DB first if running in Electron, or fallback to API
      let fetchedOrders: OrderDto[] = []
      if (window.electronAPI) {
        try {
          const res = await window.electronAPI.dbQuery('db:get-orders', {
            shopId: branchId !== 'all' ? branchId : undefined,
            dateStr: dateKey,
            limit: 500
          })
          if (Array.isArray(res) && res.length > 0) {
            fetchedOrders = res
          }
        } catch (e) {
          console.warn('Failed to load orders from local db, falling back to API:', e)
        }
      }

      if (fetchedOrders.length === 0) {
        try {
          fetchedOrders = await ordersApi.getByDateRange(fromStr, toStr)
        } catch {
          // Fallback: fetch latest orders and filter client-side
          const all = await ordersApi.getAll(500)
          fetchedOrders = all.filter((o) => {
            if (!o.createdAt) return false
            return dayjs(o.createdAt).format('YYYY-MM-DD') === dateKey
          })
        }
      }

      // Sort descending (latest first)
      fetchedOrders.sort((a, b) => {
        return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
      })

      setOrders(fetchedOrders)
    } catch (err) {
      console.error('Failed to load daily orders:', err)
      message.error('Failed to load orders for the selected date.')
    } finally {
      setLoading(false)
    }
  }

  // Load when selectedDate or selectedBranchId changes
  useEffect(() => {
    loadOrdersForDate(selectedDate, selectedBranchId)
  }, [selectedDate, selectedBranchId])

  // Listen to POS order completion events to automatically update in real-time
  useEffect(() => {
    const handleNewOrder = () => {
      // If currently viewing today, reload list
      if (selectedDate.isSame(dayjs(), 'day')) {
        loadOrdersForDate(selectedDate)
      }
    }

    window.addEventListener('pos:order-completed', handleNewOrder)
    return () => {
      window.removeEventListener('pos:order-completed', handleNewOrder)
    }
  }, [selectedDate])

  // Quick Date Navigation Handlers
  const handlePrevDay = () => setSelectedDate((prev) => prev.subtract(1, 'day'))
  const handleNextDay = () => {
    if (selectedDate.isSame(dayjs(), 'day')) return
    setSelectedDate((prev) => prev.add(1, 'day'))
  }
  const handleSetToday = () => setSelectedDate(dayjs())
  const handleSetYesterday = () => setSelectedDate(dayjs().subtract(1, 'day'))

  // Filtered orders list based on search and payment method
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Branch filter
      if (selectedBranchId !== 'all') {
        const orderShopId = (order as any).shopId || (order as any).shop_id || 'b0000000-0000-0000-0000-000000000001'
        if (orderShopId !== selectedBranchId) return false
      }

      // Payment filter
      if (paymentFilter !== 'all') {
        const primaryPayment = order.payments?.[0]?.method?.toUpperCase() || 'CASH'
        if (primaryPayment !== paymentFilter.toUpperCase()) return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesOrderNo = order.orderNo?.toLowerCase().includes(q)
        const matchesItem = order.items?.some((item) =>
          item.productName?.toLowerCase().includes(q) || item.itemCode?.toLowerCase().includes(q)
        )
        const matchesCashier = order.cashierId?.toLowerCase().includes(q)
        if (!matchesOrderNo && !matchesItem && !matchesCashier) {
          return false
        }
      }

      return true
    })
  }, [orders, paymentFilter, searchQuery])

  // Calculate day metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0
    let totalCash = 0
    let totalCard = 0
    let totalDiscounts = 0
    let totalItemsSold = 0

    orders.forEach((o) => {
      totalRevenue += Number(o.totalAmount || 0)
      totalDiscounts += Number(o.discountAmount || 0)

      o.items?.forEach((item) => {
        totalItemsSold += Number(item.quantity || 0)
      })

      const method = o.payments?.[0]?.method?.toUpperCase()
      const amt = Number(o.payments?.[0]?.amount ?? o.totalAmount ?? 0)
      if (method === 'CARD') {
        totalCard += amt
      } else {
        totalCash += amt
      }
    })

    return {
      orderCount: orders.length,
      totalRevenue,
      totalCash,
      totalCard,
      totalDiscounts,
      totalItemsSold,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
    }
  }, [orders])

  // Helper to determine single or mixed payment method
  const getOrderPaymentMethod = (o: OrderDto): string => {
    const methods = Array.from(new Set((o.payments || []).map((p) => (p.method || '').toUpperCase()).filter(Boolean)))
    if (methods.length > 1) return 'MIXED'
    return methods[0] || 'CASH'
  }

  // 1. Export Clean Orders Summary Table (1 row per order, uniform 14 columns)
  const handleExportOrdersSummaryCSV = () => {
    if (filteredOrders.length === 0) {
      message.warning('No orders to export for the selected date / filter.')
      return
    }

    const dateKey = selectedDate.format('YYYY-MM-DD')
    const headers = [
      'Order No',
      'Date',
      'Time',
      'Cashier',
      'Items Count',
      'Items Summary',
      'Subtotal (LKR)',
      'Discount (LKR)',
      'Tax (LKR)',
      'Total Amount (LKR)',
      'Payment Method',
      'Cash Tendered (LKR)',
      'Change Returned (LKR)',
      'Status'
    ]

    let totalItemsCount = 0
    let totalSubtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let totalRevenue = 0
    let totalCashGiven = 0
    let totalChangeGiven = 0

    const rows: CsvRow[] = [headers]

    for (const o of filteredOrders) {
      const orderItems = o.items || []
      const orderQty = orderItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
      const subtotal = Number(o.subtotal ?? o.totalAmount) || 0
      const discount = Number(o.discountAmount) || 0
      const tax = Number(o.taxAmount) || 0
      const total = Number(o.totalAmount) || 0
      const cashGiven = (o.payments || []).reduce((s, p) => s + (Number(p.cashGiven) || 0), 0)
      const changeGiven = (o.payments || []).reduce((s, p) => s + (Number(p.changeGiven) || 0), 0)

      totalItemsCount += orderQty
      totalSubtotal += subtotal
      totalDiscount += discount
      totalTax += tax
      totalRevenue += total
      totalCashGiven += cashGiven
      totalChangeGiven += changeGiven

      const itemsSummary = orderItems.map((i) => `${i.productName} (${i.quantity})`).join('; ')

      rows.push([
        o.orderNo,
        csvDate(o.createdAt),
        csvTime(o.createdAt),
        o.cashierId || 'Cashier',
        orderQty,
        itemsSummary,
        money(subtotal),
        money(discount),
        money(tax),
        money(total),
        getOrderPaymentMethod(o),
        cashGiven > 0 ? money(cashGiven) : '0.00',
        changeGiven > 0 ? money(changeGiven) : '0.00',
        (o.status || 'completed').toUpperCase()
      ])
    }

    // Uniform Summary Row (Exact 14 columns matching headers)
    rows.push([
      `TOTAL (${filteredOrders.length} Orders)`,
      '',
      '',
      '',
      qty(totalItemsCount),
      '',
      money(totalSubtotal),
      money(totalDiscount),
      money(totalTax),
      money(totalRevenue),
      '',
      money(totalCashGiven),
      money(totalChangeGiven),
      ''
    ])

    const suffix = paymentFilter !== 'all' ? `_${paymentFilter}` : ''
    downloadCsv(`Daily_Orders_Summary_${dateKey}${suffix}.csv`, rows)
    message.success(`Orders summary exported successfully (${filteredOrders.length} orders)`)
  }

  // 2. Export Detailed Item-by-Item Sales Table (1 row per item sold, uniform 12 columns)
  const handleExportOrderItemsDetailCSV = () => {
    if (filteredOrders.length === 0) {
      message.warning('No items to export for the selected date / filter.')
      return
    }

    const dateKey = selectedDate.format('YYYY-MM-DD')
    const headers = [
      'Order No',
      'Date',
      'Time',
      'Cashier',
      'Item Code',
      'Product Name',
      'Unit Price (LKR)',
      'Quantity',
      'Discount (LKR)',
      'Line Total (LKR)',
      'Payment Method',
      'Status'
    ]

    let totalQty = 0
    let totalDiscount = 0
    let totalLineAmount = 0

    const rows: CsvRow[] = [headers]

    for (const o of filteredOrders) {
      const method = getOrderPaymentMethod(o)
      const date = csvDate(o.createdAt)
      const time = csvTime(o.createdAt)
      const cashier = o.cashierId || 'Cashier'
      const status = (o.status || 'completed').toUpperCase()

      for (const item of o.items || []) {
        const itemQty = Number(item.quantity) || 0
        const itemDiscount = Number(item.discount) || 0
        const itemSubtotal = Number(item.subtotal) || 0

        totalQty += itemQty
        totalDiscount += itemDiscount
        totalLineAmount += itemSubtotal

        rows.push([
          o.orderNo,
          date,
          time,
          cashier,
          item.itemCode || '-',
          item.productName,
          money(item.unitPrice),
          qty(itemQty),
          money(itemDiscount),
          money(itemSubtotal),
          method,
          status
        ])
      }
    }

    // Uniform Summary Row (Exact 12 columns matching headers)
    rows.push([
      `TOTAL (${rows.length - 1} Items Sold)`,
      '',
      '',
      '',
      '',
      '',
      '',
      qty(totalQty),
      money(totalDiscount),
      money(totalLineAmount),
      '',
      ''
    ])

    const suffix = paymentFilter !== 'all' ? `_${paymentFilter}` : ''
    downloadCsv(`Daily_Order_Items_Detail_${dateKey}${suffix}.csv`, rows)
    message.success(`Item-wise sales detail exported successfully`)
  }

  // Action: Open Details Modal
  const handleViewOrder = (order: OrderDto) => {
    setSelectedOrder(order)
    setIsDetailsModalOpen(true)
  }

  // Action: Open Receipt Modal (for reprinting)
  const handlePrintOrder = (order: OrderDto) => {
    setSelectedOrder(order)
    setIsReceiptModalOpen(true)
  }

  // Quick Direct Print
  const handleDirectPrint = async (order: OrderDto) => {
    if (!window.electronAPI) {
      handlePrintOrder(order)
      return
    }

    try {
      const preferredPrinter = localStorage.getItem('selected_printer') || undefined
      await window.electronAPI.printReceipt(
        {
          shopName: currentShop?.name || 'Wasana Cake - Katugastota',
          address: currentShop?.address || 'Horana Wasana Bakers Galagedara Road Katugastota',
          phone: currentShop?.phone || '071-1172201',
          orderNo: order.orderNo,
          cashierName: order.cashierId || currentUser?.name || 'Staff',
          dateTime: formatDateTime(order.createdAt),
          items: order.items.map((i) => ({
            name: i.productName,
            quantity: `${i.quantity} pcs`,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal
          })),
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          taxAmount: order.taxAmount,
          totalAmount: order.totalAmount,
          paymentMethod: order.payments?.[0]?.method || 'CASH',
          cashGiven: order.payments?.[0]?.cashGiven,
          changeGiven: order.payments?.[0]?.changeGiven
        },
        preferredPrinter
      )
      message.success(`Receipt printed for ${order.orderNo}`)
    } catch (err) {
      console.error('Print failed:', err)
      handlePrintOrder(order)
    }
  }

  // Table Columns Definition
  const columns: ColumnsType<OrderDto> = [
    {
      title: 'Time & Order #',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 220,
      render: (_, record) => {
        const timeFormatted = dayjs(record.createdAt).format('hh:mm A')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.3px'
                }}
              >
                {record.orderNo}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
              <Clock size={12} color="#94a3b8" />
              <span>{timeFormatted}</span>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Items Breakdown',
      dataIndex: 'items',
      key: 'items',
      render: (items: OrderItemDto[]) => {
        if (!items || items.length === 0) return <span style={{ color: '#94a3b8' }}>-</span>

        const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Tag
                style={{
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 11,
                  padding: '1px 8px',
                  margin: 0,
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0'
                }}
              >
                {totalQty} {totalQty === 1 ? 'item' : 'items'}
              </Tag>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 340
                }}
                title={items.map((i) => `${i.productName} (${i.quantity})`).join(', ')}
              >
                {items
                  .map((i) => `${i.productName} × ${i.quantity}`)
                  .slice(0, 3)
                  .join(', ')}
                {items.length > 3 ? ` +${items.length - 3} more` : ''}
              </span>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Payment Method',
      dataIndex: 'payments',
      key: 'payments',
      width: 140,
      render: (payments) => {
        const method = (payments?.[0]?.method || 'CASH').toUpperCase()
        const isCash = method === 'CASH'
        return (
          <Tag
            color={isCash ? 'success' : 'processing'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 8px'
            }}
          >
            {isCash ? <Banknote size={13} /> : <CreditCard size={13} />}
            {method}
          </Tag>
        )
      }
    },
    {
      title: 'Discount',
      dataIndex: 'discountAmount',
      key: 'discountAmount',
      width: 110,
      align: 'right',
      render: (discount) => {
        if (!discount || discount <= 0) return <span style={{ color: '#cbd5e1' }}>—</span>
        return (
          <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>
            -{formatCurrency(discount)}
          </span>
        )
      }
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount) => (
        <span
          style={{
            fontWeight: 800,
            fontSize: 14,
            color: '#16a34a',
            letterSpacing: '-0.3px'
          }}
        >
          {formatCurrency(amount)}
        </span>
      )
    },
    {
      title: 'Audit / Print',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="View Read-Only Details">
            <Button
              type="text"
              size="small"
              icon={<Eye size={15} color="#0f172a" />}
              onClick={() => handleViewOrder(record)}
              style={{
                borderRadius: 6,
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0'
              }}
            />
          </Tooltip>
          <Tooltip title="Reprint Thermal Receipt">
            <Button
              type="text"
              size="small"
              icon={<Printer size={15} color="#16a34a" />}
              onClick={() => handleDirectPrint(record)}
              style={{
                borderRadius: 6,
                backgroundColor: '#f0fdf4'
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  // Receipt Modal Data Adapter
  const receiptOrderData = useMemo(() => {
    if (!selectedOrder) return null
    return {
      order_no: selectedOrder.orderNo,
      cashier_name: selectedOrder.cashierId || currentUser?.name || 'Cashier',
      created_at: selectedOrder.createdAt,
      items: selectedOrder.items?.map((i) => ({
        product_name: i.productName,
        quantity: i.quantity,
        unit: 'pcs',
        unit_price: i.unitPrice,
        subtotal: i.subtotal
      })) || [],
      subtotal: selectedOrder.subtotal,
      discount_amount: selectedOrder.discountAmount,
      tax_amount: selectedOrder.taxAmount,
      total_amount: selectedOrder.totalAmount,
      payments: selectedOrder.payments?.map((p) => ({
        method: p.method,
        cash_given: p.cashGiven,
        change_given: p.changeGiven,
        amount: p.amount
      })) || []
    }
  }, [selectedOrder, currentUser])

  return (
    <div className="page-container" style={{ padding: '18px 24px', gap: 16 }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ minWidth: 260, flex: '1 1 auto' }}>
          <div className="page-title" style={{ fontSize: 20 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(21, 128, 61, 0.12)',
                border: '1px solid #bbf7d0'
              }}
            >
              <ReceiptText size={20} />
            </div>
            <span>Daily Orders & Sales History</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#15803d',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '2px 8px',
                borderRadius: 99,
                marginLeft: 4
              }}
            >
              {filteredOrders.length} Orders
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            Inspect, verify, and reprint completed customer orders for {selectedDate.format('dddd, DD MMMM YYYY')} ·{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{currentShop?.name || 'Main Branch'}</span>
          </div>
        </div>

        {/* Date Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'nowrap' }}>
          <Space.Compact>
            <Button
              icon={<ChevronLeft size={16} />}
              onClick={handlePrevDay}
              title="Previous Day"
              style={{ borderRadius: '8px 0 0 8px', height: 38 }}
            />
            <DatePicker
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              format="YYYY-MM-DD"
              allowClear={false}
              disabledDate={(current) => current && current > dayjs().endOf('day')}
              style={{ width: 140, textAlign: 'center', fontWeight: 700, height: 38 }}
            />
            <Button
              icon={<ChevronRight size={16} />}
              onClick={handleNextDay}
              disabled={selectedDate.isSame(dayjs(), 'day')}
              title="Next Day"
              style={{ borderRadius: '0 8px 8px 0', height: 38 }}
            />
          </Space.Compact>

          <Button
            type={selectedDate.isSame(dayjs(), 'day') ? 'primary' : 'default'}
            onClick={handleSetToday}
            style={{
              fontWeight: 700,
              borderRadius: 8,
              height: 38,
              backgroundColor: selectedDate.isSame(dayjs(), 'day') ? '#16a34a' : '#ffffff',
              borderColor: selectedDate.isSame(dayjs(), 'day') ? '#16a34a' : '#cbd5e1',
              color: selectedDate.isSame(dayjs(), 'day') ? '#ffffff' : '#334155'
            }}
          >
            Today
          </Button>

          <Button
            type={selectedDate.isSame(dayjs().subtract(1, 'day'), 'day') ? 'primary' : 'default'}
            onClick={handleSetYesterday}
            style={{
              fontWeight: 700,
              borderRadius: 8,
              height: 38,
              backgroundColor: selectedDate.isSame(dayjs().subtract(1, 'day'), 'day') ? '#16a34a' : '#ffffff',
              borderColor: selectedDate.isSame(dayjs().subtract(1, 'day'), 'day') ? '#16a34a' : '#cbd5e1',
              color: selectedDate.isSame(dayjs().subtract(1, 'day'), 'day') ? '#ffffff' : '#334155'
            }}
          >
            Yesterday
          </Button>

          <Button
            icon={<RotateCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={() => loadOrdersForDate(selectedDate)}
            loading={loading}
            style={{
              borderRadius: 10,
              height: 38,
              fontWeight: 600,
              border: '1.5px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text-secondary)'
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ───── Daily KPI Metrics Summary (Unified 4-Card Strip) ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flexShrink: 0 }}>
        {/* Total Orders Card */}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Orders
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {metrics.orderCount}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 1 }}>
              {metrics.totalItemsSold} items sold today
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a'
            }}
          >
            <ReceiptText size={22} />
          </div>
        </div>

        {/* Total Net Revenue Card */}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Net Sales Revenue
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 2 }}>
              {formatCurrency(metrics.totalRevenue)}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>
              Avg. Ticket: {formatCurrency(metrics.avgOrderValue)}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a'
            }}
          >
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Cash Collected Card */}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cash In Drawer
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#d97706', marginTop: 2 }}>
              {formatCurrency(metrics.totalCash)}
            </div>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 1 }}>
              Physical currency collected
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

        {/* Card / Digital Payments */}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Card / Digital Sales
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {formatCurrency(metrics.totalCard)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 1 }}>
              Discounts given: {formatCurrency(metrics.totalDiscounts)}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a'
            }}
          >
            <CreditCard size={22} />
          </div>
        </div>
      </div>

      {/* ───── Table Toolbar: Search & Filters ───── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Input
            prefix={<Search size={16} color="#94a3b8" />}
            placeholder="Search by Order # or Product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="large"
            style={{ borderRadius: 8, maxWidth: 360, fontSize: 13 }}
          />

          <Select
            value={paymentFilter}
            onChange={setPaymentFilter}
            size="large"
            style={{ width: 140 }}
            options={[
              { value: 'all', label: 'All Payments' },
              { value: 'cash', label: 'Cash Only' },
              { value: 'card', label: 'Card Only' }
            ]}
          />

          <Select
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            size="large"
            style={{ width: 210 }}
            options={[
              { value: 'all', label: 'All Branches' },
              { value: 'b0000000-0000-0000-0000-000000000001', label: 'Katugastota (B1)' },
              { value: 'b0000000-0000-0000-0000-000000000002', label: 'Poojapitiya (B2)' }
            ]}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b' }}>
            Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders
          </span>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'summary',
                  label: 'Orders Summary',
                  onClick: handleExportOrdersSummaryCSV
                },
                {
                  key: 'items',
                  label: 'Order Items Detail',
                  onClick: handleExportOrderItemsDetailCSV
                }
              ]
            }}
            placement="bottomRight"
          >
            <Button
              id="orders-export-csv"
              icon={<Download size={14} />}
              onClick={handleExportOrdersSummaryCSV}
              disabled={loading || filteredOrders.length === 0}
              size="large"
              style={{
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 12.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              Export CSV
            </Button>
          </Dropdown>
        </div>
      </div>

      {/* ───── Orders Table ───── */}
      <div
        className="data-table"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          flex: 1
        }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} orders`
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ padding: '16px 0' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>
                      No orders found for {selectedDate.format('DD MMMM YYYY')}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                      Orders placed on this day through the Counter POS will appear here.
                    </p>
                  </div>
                }
              />
            )
          }}
        />
      </div>

      {/* ───── Order Breakdown Details Modal ───── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ReceiptText size={20} color="#16a34a" />
            <div>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Order Details: {selectedOrder?.orderNo}</span>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>
                {selectedOrder?.createdAt && formatDateTime(selectedOrder.createdAt)}
              </div>
            </div>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailsModalOpen(false)} style={{ borderRadius: 8 }}>
            Close
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={15} />}
            onClick={() => {
              setIsDetailsModalOpen(false)
              if (selectedOrder) handlePrintOrder(selectedOrder)
            }}
            style={{ borderRadius: 8, backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            Reprint Receipt
          </Button>
        ]}
        width={650}
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 10 }}>
            {/* Security Audit Read-Only Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#f8fafc',
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                color: '#475569',
                fontSize: 12
              }}
            >
              <ShieldCheck size={18} color="#16a34a" style={{ flexShrink: 0 }} />
              <div>
                <strong>Protected Audit Record (Strictly Read-Only):</strong> All details of this transaction are permanent and cannot be modified.
              </div>
            </div>

            {/* Header Info */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                backgroundColor: '#f8fafc',
                padding: '12px 14px',
                borderRadius: 8,
                fontSize: 12
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Order #</span>
                <strong>{selectedOrder.orderNo}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Payment</span>
                <strong style={{ color: '#0f172a' }}>
                  {selectedOrder.payments?.[0]?.method || 'CASH'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Cashier</span>
                <strong>{selectedOrder.cashierId || currentUser?.name || 'Staff'}</strong>
              </div>
            </div>

            {/* Line items table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Item</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: idx === selectedOrder.items.length - 1 ? 'none' : '1px solid #f1f5f9'
                      }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.productName}</div>
                        {item.itemCode && (
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Code: {item.itemCode}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                backgroundColor: '#f8fafc',
                padding: '14px 16px',
                borderRadius: 8,
                fontSize: 13
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Subtotal</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48' }}>
                  <span>Discount</span>
                  <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                </div>
              )}
              {selectedOrder.taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Tax</span>
                  <span>+{formatCurrency(selectedOrder.taxAmount)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#16a34a',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 8,
                  marginTop: 2
                }}
              >
                <span>Grand Total</span>
                <span>{formatCurrency(selectedOrder.totalAmount)}</span>
              </div>

              {selectedOrder.payments?.[0]?.cashGiven && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#64748b',
                      paddingTop: 4
                    }}
                  >
                    <span>Cash Tendered</span>
                    <span>{formatCurrency(selectedOrder.payments[0].cashGiven)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span>Change Returned</span>
                    <span>{formatCurrency(selectedOrder.payments[0].changeGiven)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ───── Full Thermal Receipt Preview Modal ───── */}
      {receiptOrderData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          orderData={receiptOrderData}
        />
      )}
    </div>
  )
}

export default OrdersPage
