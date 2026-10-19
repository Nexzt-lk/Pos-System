import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Cake,
  Plus,
  Search,
  Calendar,
  Clock,
  Phone,
  User,
  Printer,
  CheckCircle2,
  AlertCircle,
  Banknote,
  DollarSign,
  Download,
  Trash2,
  Eye,
  CreditCard,
  ChefHat,
  RefreshCw
} from 'lucide-react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  TimePicker,
  Button,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Radio
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { cakeOrdersApi, CakeOrderDto, CreateCakeOrderRequest } from '../../api/cakeOrdersApi'
import { productsApi, ProductDto } from '../../api/productsApi'
import { useAppStore } from '../../store/appStore'
import { downloadCsv, money, CsvRow } from '../../lib/csvExport'

const FLAVOR_OPTIONS = [
  'Chocolate Fudge',
  'Ribbon Cake',
  'Butter Cake',
  'Vanilla Cake',
  'Coffee Mocha',
  'Red Velvet',
  'Black Forest',
  'Fruit Cake',
  'Cheesecake',
  'Custom Flavor'
]

const SHAPE_OPTIONS = ['Round', 'Square', 'Heart', 'Rectangle', 'Custom Shape']

export const CakeOrdersPage: React.FC = () => {
  const currentShop = useAppStore((s) => s.currentShop)
  const currentUser = useAppStore((s) => s.currentUser)

  const [orders, setOrders] = useState<CakeOrderDto[]>([])
  const [products, setProducts] = useState<ProductDto[]>([])
  const [loading, setLoading] = useState(false)
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all')
  const [selectedBranch, setSelectedBranch] = useState<string>(currentShop?.id || 'all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)

  // Item selection & Weight modes in New Order modal
  const [itemMode, setItemMode] = useState<'catalog' | 'custom'>('catalog')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg')
  const [weightVal, setWeightVal] = useState<number>(1)

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<CakeOrderDto | null>(null)

  const [form] = Form.useForm()
  const [collectForm] = Form.useForm()

  // Dynamic price calculation in form
  const totalAmountWatch = Form.useWatch('totalAmount', form) || 0
  const advanceAmountWatch = Form.useWatch('advanceAmount', form) || 0
  const balanceDuePreview = Math.max(0, Number(totalAmountWatch) - Number(advanceAmountWatch))

  // Fetch store products for catalog selection
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const prods = await productsApi.getAll(false, currentShop?.id)
        setProducts(prods || [])
      } catch (err) {
        console.warn('Could not load products catalog for cake order modal', err)
      }
    }
    fetchCatalog()
  }, [currentShop?.id])

  // Fetch orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const data = await cakeOrdersApi.getAll({
        shopId: selectedBranch,
        status: activeStatusFilter === 'due_today' ? undefined : activeStatusFilter,
        dueTodayOnly: activeStatusFilter === 'due_today',
        search: searchQuery || undefined,
        startDate: selectedDate ? selectedDate.format('YYYY-MM-DD') : undefined,
        endDate: selectedDate ? selectedDate.format('YYYY-MM-DD') : undefined
      })
      setOrders(data)
    } catch (err: any) {
      message.error('Failed to load cake orders: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch, activeStatusFilter, searchQuery, selectedDate])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Summary Metrics
  const todayStr = dayjs().format('YYYY-MM-DD')

  const metrics = useMemo(() => {
    let dueToday = 0
    let active = 0
    let ready = 0
    let totalAdvance = 0
    let totalBalance = 0

    orders.forEach((o) => {
      const isToday = o.pickupDate === todayStr
      const isActive = o.status !== 'completed' && o.status !== 'cancelled'

      if (isToday && isActive) dueToday++
      if (isActive) {
        active++
        totalAdvance += o.advanceAmount
        totalBalance += o.balanceAmount
      }
      if (o.status === 'ready') ready++
    })

    return { dueToday, active, ready, totalAdvance, totalBalance }
  }, [orders, todayStr])

  // Weight Formatter Helper
  const formatWeight = (kg: number) => {
    if (!kg && kg !== 0) return '1 kg'
    if (kg < 1) {
      return `${Math.round(kg * 1000)} g`
    }
    if (kg % 1 !== 0) {
      return `${kg} kg (${Math.round(kg * 1000)} g)`
    }
    return `${kg} kg`
  }

  // Weight unit toggle handler
  const handleWeightUnitChange = (newUnit: 'kg' | 'g') => {
    if (newUnit === weightUnit) return
    setWeightUnit(newUnit)
    if (newUnit === 'g') {
      const inG = Math.round(weightVal * 1000)
      setWeightVal(inG)
      form.setFieldsValue({ weightInput: inG })
    } else {
      const inKg = Math.round((weightVal / 1000) * 100) / 100
      setWeightVal(inKg)
      form.setFieldsValue({ weightInput: inKg })
    }
  }

  // Handle Catalog Product Selection
  const handleProductSelect = (productId: string) => {
    const prod = products.find((p) => p.id === productId)
    if (prod) {
      form.setFieldsValue({
        cakeName: prod.name,
        totalAmount: prod.price
      })
      const matchedFlavor = FLAVOR_OPTIONS.find((f) =>
        prod.name.toLowerCase().includes(f.toLowerCase().split(' ')[0])
      )
      if (matchedFlavor) {
        form.setFieldsValue({ flavor: matchedFlavor })
      }
    }
  }

  // Form Submit: Create New Cake Order
  const handleCreateSubmit = async (values: any) => {
    try {
      const pickupDateStr = values.pickupDate
        ? values.pickupDate.format('YYYY-MM-DD')
        : dayjs().add(2, 'day').format('YYYY-MM-DD')
      const pickupTimeStr = values.pickupTime
        ? values.pickupTime.format('hh:mm A')
        : values.pickupTimeSlot || ''

      // Calculate weight in KG for persistent storage
      const rawWeight = Number(values.weightInput) || (weightUnit === 'g' ? 1000 : 1)
      const weightInKg = weightUnit === 'g' ? rawWeight / 1000 : rawWeight

      const payload: CreateCakeOrderRequest = {
        shopId: values.shopId || currentShop?.id || 'b0000000-0000-0000-0000-000000000001',
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        customerEmail: values.customerEmail?.trim() || undefined,
        cakeName: values.cakeName.trim(),
        flavor: values.flavor || undefined,
        weightKg: Number(weightInKg.toFixed(3)),
        shape: values.shape || 'Round',
        tierCount: Number(values.tierCount) || 1,
        wording: values.wording?.trim() || undefined,
        specialInstructions: values.specialInstructions?.trim() || undefined,
        pickupDate: pickupDateStr,
        pickupTime: pickupTimeStr,
        totalAmount: Number(values.totalAmount) || 0,
        advanceAmount: Number(values.advanceAmount) || 0,
        advancePaymentMethod: values.advancePaymentMethod || 'CASH',
        takenBy: currentUser?.name || 'Cashier'
      }

      const newOrder = await cakeOrdersApi.create(payload)
      message.success(`Cake Order #${newOrder.orderNo} created successfully.`)
      setIsCreateModalOpen(false)
      form.resetFields()

      window.dispatchEvent(new CustomEvent('cake-order:changed'))
      loadOrders()

      Modal.confirm({
        title: 'Print Advance Order Receipt?',
        content: `Would you like to print the 80mm advance slip for Order #${newOrder.orderNo}?`,
        okText: 'Print Receipt',
        cancelText: 'Done',
        okButtonProps: { style: { background: '#16a34a', borderColor: '#16a34a' } },
        onOk: () => handlePrintSlip(newOrder)
      })
    } catch (err: any) {
      message.error('Failed to create order: ' + err.message)
    }
  }

  // Print Slip
  const handlePrintSlip = async (order: CakeOrderDto, isBalanceReceipt: boolean = false) => {
    try {
      message.loading({ content: 'Sending to thermal printer...', key: 'print' })
      const printData = {
        shopName: currentShop?.name || 'Wasana Cake - Katugastota',
        branchName: currentShop?.branch_code ? `Branch: ${currentShop.branch_code}` : undefined,
        address: currentShop?.address,
        phone: currentShop?.phone || '071-1172201',
        orderNo: order.orderNo,
        dateTime: dayjs(order.createdAt).format('YYYY-MM-DD hh:mm A'),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        cakeName: order.cakeName,
        flavor: order.flavor,
        weightKg: order.weightKg,
        shape: order.shape,
        tierCount: order.tierCount,
        wording: order.wording,
        specialInstructions: order.specialInstructions,
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        totalAmount: order.totalAmount,
        advanceAmount: order.advanceAmount,
        balanceAmount: order.balanceAmount,
        advancePaymentMethod: order.advancePaymentMethod,
        balancePaymentMethod: order.balancePaymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        takenBy: order.takenBy,
        isBalanceReceipt
      }

      const res = await cakeOrdersApi.printSlip(printData)
      if (res.success) {
        message.success({ content: 'Slip printed successfully.', key: 'print' })
      } else {
        message.info({ content: 'Print command sent: ' + (res.message || 'default printer'), key: 'print' })
      }
    } catch (e: any) {
      message.error({ content: 'Print failed: ' + e.message, key: 'print' })
    }
  }

  // Update Status
  const handleStatusChange = async (orderId: string, newStatus: any) => {
    try {
      await cakeOrdersApi.updateStatus(orderId, newStatus)
      message.success(`Order status updated to "${newStatus.toUpperCase()}"`)
      window.dispatchEvent(new CustomEvent('cake-order:changed'))
      loadOrders()
    } catch (e: any) {
      message.error('Failed to update status: ' + e.message)
    }
  }

  // Collect Balance
  const handleCollectBalanceSubmit = async (values: any) => {
    if (!selectedOrder) return
    try {
      const updated = await cakeOrdersApi.collectBalance(selectedOrder.id, values.paymentMethod || 'CASH')
      message.success(`Balance collected for Order #${selectedOrder.orderNo}. Order completed.`)
      setIsCollectModalOpen(false)
      collectForm.resetFields()
      window.dispatchEvent(new CustomEvent('cake-order:changed'))
      loadOrders()

      if (updated) {
        Modal.confirm({
          title: 'Print Final Receipt?',
          content: `Would you like to print the Final Payment Receipt for Order #${updated.orderNo}?`,
          okText: 'Print Final Receipt',
          cancelText: 'Skip',
          okButtonProps: { style: { background: '#16a34a', borderColor: '#16a34a' } },
          onOk: () => handlePrintSlip(updated, true)
        })
      }
    } catch (e: any) {
      message.error('Failed to collect balance: ' + e.message)
    }
  }

  // Delete Order
  const handleDeleteOrder = async (orderId: string) => {
    try {
      await cakeOrdersApi.delete(orderId)
      message.success('Cake order deleted.')
      window.dispatchEvent(new CustomEvent('cake-order:changed'))
      loadOrders()
    } catch (e: any) {
      message.error('Failed to delete order: ' + e.message)
    }
  }

  // Export CSV
  const handleExportCsv = () => {
    if (orders.length === 0) {
      message.info('No cake orders to export.')
      return
    }
    const rows: CsvRow[] = [
      [
        'Order No',
        'Customer Name',
        'Customer Phone',
        'Cake Name',
        'Flavor',
        'Weight (kg)',
        'Weight Display',
        'Shape',
        'Wording',
        'Pickup Date',
        'Pickup Time',
        'Total Amount',
        'Advance Paid',
        'Balance Due',
        'Advance Method',
        'Payment Status',
        'Order Status',
        'Taken By',
        'Booked On'
      ],
      ...orders.map((o) => [
        o.orderNo,
        o.customerName,
        o.customerPhone,
        o.cakeName,
        o.flavor || '',
        o.weightKg,
        formatWeight(o.weightKg),
        o.shape || 'Round',
        o.wording || '',
        o.pickupDate,
        o.pickupTime || '',
        money(o.totalAmount),
        money(o.advanceAmount),
        money(o.balanceAmount),
        o.advancePaymentMethod,
        o.paymentStatus,
        o.status,
        o.takenBy || '',
        o.createdAt || ''
      ])
    ]
    downloadCsv(`cake_orders_${dayjs().format('YYYY-MM-DD')}.csv`, rows)
  }

  return (
    <div style={{ padding: 20, height: '100%', overflowY: 'auto', background: '#f8fafc' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: '#0f172a',
              color: '#ffffff',
              padding: '6px 10px',
              borderRadius: 8,
              display: 'inline-flex'
            }}>
              <Cake size={19} />
            </span>
            Custom Cake Orders
          </h1>
          <p style={{ margin: '3px 0 0 0', color: '#64748b', fontSize: 13 }}>
            Advance cake bookings, catalog item selection, custom specs, pickup schedules, and balance tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<Download size={14} />} onClick={handleExportCsv} style={{ fontWeight: 600, borderColor: '#cbd5e1', color: '#0f172a' }}>
            Export CSV
          </Button>
          <Button icon={<RefreshCw size={14} />} onClick={loadOrders} loading={loading} style={{ fontWeight: 600, borderColor: '#cbd5e1', color: '#0f172a' }}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              form.resetFields()
              setItemMode('catalog')
              setWeightUnit('kg')
              setWeightVal(1)
              form.setFieldsValue({
                shopId: currentShop?.id || 'b0000000-0000-0000-0000-000000000001',
                pickupDate: dayjs().add(2, 'day'),
                weightInput: 1,
                shape: 'Round',
                tierCount: 1,
                flavor: 'Chocolate Fudge',
                advancePaymentMethod: 'CASH'
              })
              setIsCreateModalOpen(true)
            }}
            style={{
              background: '#16a34a',
              borderColor: '#16a34a',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
            }}
          >
            New Cake Order
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards (Black, Green, Ash) ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
        {/* Due Today Card */}
        <Col xs={24} sm={12} md={6}>
          <div
            onClick={() => setActiveStatusFilter(activeStatusFilter === 'due_today' ? 'all' : 'due_today')}
            style={{
              background: metrics.dueToday > 0 ? '#f0fdf4' : '#ffffff',
              border: metrics.dueToday > 0 ? '2px solid #16a34a' : '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '14px 16px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                Pickups Due Today
              </span>
              <AlertCircle size={17} color={metrics.dueToday > 0 ? '#16a34a' : '#94a3b8'} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 3 }}>
              {metrics.dueToday}
            </div>
            <div style={{ fontSize: 11, color: metrics.dueToday > 0 ? '#16a34a' : '#64748b', marginTop: 2, fontWeight: 600 }}>
              {metrics.dueToday > 0 ? 'Orders to deliver today' : 'No pickups due today'}
            </div>
          </div>
        </Col>

        {/* Active Orders Card */}
        <Col xs={24} sm={12} md={6}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Active Orders
              </span>
              <ChefHat size={17} color="#475569" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 3 }}>
              {metrics.active}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {metrics.ready} ready for pickup
            </div>
          </div>
        </Col>

        {/* Advance Collected Card */}
        <Col xs={24} sm={12} md={6}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>
                Advance Collected
              </span>
              <Banknote size={17} color="#16a34a" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', marginTop: 3 }}>
              Rs. {metrics.totalAdvance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Received at booking
            </div>
          </div>
        </Col>

        {/* Balance Due Card */}
        <Col xs={24} sm={12} md={6}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                Balance To Collect
              </span>
              <DollarSign size={17} color="#0f172a" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 3 }}>
              Rs. {metrics.totalBalance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Due upon customer pickup
            </div>
          </div>
        </Col>
      </Row>

      {/* ── Filters Bar ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10
      }}>
        {/* Status Pill Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {[
            { key: 'all', label: 'All Orders' },
            { key: 'due_today', label: `Due Today (${metrics.dueToday})` },
            { key: 'pending', label: 'Pending' },
            { key: 'baking', label: 'In Kitchen' },
            { key: 'ready', label: 'Ready' },
            { key: 'completed', label: 'Completed' }
          ].map((tab) => {
            const isSelected = activeStatusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveStatusFilter(tab.key)}
                style={{
                  background: isSelected ? '#0f172a' : '#f1f5f9',
                  color: isSelected ? '#ffffff' : '#475569',
                  border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right Search & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select
            value={selectedBranch}
            onChange={(val) => setSelectedBranch(val)}
            style={{ width: 190 }}
            options={[
              { value: 'all', label: 'All Branches' },
              { value: 'b0000000-0000-0000-0000-000000000001', label: 'Katugastota (B1)' },
              { value: 'b0000000-0000-0000-0000-000000000002', label: 'Poojapitiya (B2)' }
            ]}
          />

          <DatePicker
            placeholder="Filter by Pickup Date"
            value={selectedDate}
            onChange={(d) => setSelectedDate(d)}
            allowClear
            style={{ width: 160 }}
          />

          <Input
            placeholder="Search Order #, Name, Phone..."
            prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
        </div>
      </div>

      {/* ── Orders Table ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
      }}>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
            <Cake size={40} color="#94a3b8" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>No Cake Orders Found</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 14px 0' }}>
              {activeStatusFilter !== 'all'
                ? `No orders matching filter "${activeStatusFilter}".`
                : 'Click "New Cake Order" above to take a custom cake advance booking.'}
            </p>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setIsCreateModalOpen(true)}
              style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
            >
              Add Cake Order
            </Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Order No</th>
                  <th style={{ padding: '10px 14px' }}>Customer</th>
                  <th style={{ padding: '10px 14px' }}>Cake Specifications</th>
                  <th style={{ padding: '10px 14px' }}>Pickup Schedule</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Advance</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Balance Due</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isDueToday = order.pickupDate === todayStr && order.status !== 'completed' && order.status !== 'cancelled'

                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isDueToday ? '#f0fdf4' : undefined,
                        transition: 'background 0.1s ease'
                      }}
                    >
                      {/* Order No */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                          #{order.orderNo}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {dayjs(order.createdAt).format('MMM DD, hh:mm A')}
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: 4,
                          display: 'inline-block',
                          marginTop: 3
                        }}>
                          {order.shopId === 'b0000000-0000-0000-0000-000000000002' ? 'Poojapitiya' : 'Katugastota'}
                        </span>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{order.customerName}</div>
                        <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontWeight: 600 }}>
                          <Phone size={12} style={{ color: '#16a34a' }} />
                          {order.customerPhone}
                        </div>
                      </td>

                      {/* Cake Specifications */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {order.cakeName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                          {formatWeight(order.weightKg)} &bull; {order.shape || 'Round'} &bull; {order.flavor || 'Standard'}
                        </div>
                        {order.wording && (
                          <div style={{
                            fontSize: 11.5,
                            fontStyle: 'italic',
                            color: '#0f172a',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginTop: 3,
                            display: 'inline-block',
                            maxWidth: 240
                          }}>
                            &ldquo;{order.wording}&rdquo;
                          </div>
                        )}
                      </td>

                      {/* Pickup Schedule */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{
                          fontWeight: isDueToday ? 900 : 700,
                          color: isDueToday ? '#15803d' : '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          <Calendar size={13} color={isDueToday ? '#16a34a' : '#64748b'} />
                          {order.pickupDate}
                          {isDueToday && (
                            <span style={{
                              background: '#16a34a',
                              color: '#ffffff',
                              fontSize: 9.5,
                              fontWeight: 900,
                              padding: '1px 5px',
                              borderRadius: 4,
                              textTransform: 'uppercase'
                            }}>
                              Today
                            </span>
                          )}
                        </div>
                        {order.pickupTime && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} /> {order.pickupTime}
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        Rs. {order.totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Advance */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#16a34a' }}>
                          Rs. {order.advanceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                          via {order.advancePaymentMethod}
                        </div>
                      </td>

                      {/* Balance Due */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{
                          fontWeight: 900,
                          fontSize: 14,
                          color: order.balanceAmount > 0 ? '#0f172a' : '#16a34a'
                        }}>
                          Rs. {order.balanceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {order.balanceAmount <= 0 ? (
                          <Tag style={{ margin: '2px 0 0 0', fontSize: 10, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                            Paid in Full
                          </Tag>
                        ) : (
                          <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>Due on Delivery</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'center' }}>
                        <Select
                          size="small"
                          value={order.status}
                          onChange={(newSt) => handleStatusChange(order.id, newSt)}
                          style={{ width: 115 }}
                          options={[
                            { value: 'pending', label: 'Pending' },
                            { value: 'baking', label: 'In Kitchen' },
                            { value: 'ready', label: 'Ready' },
                            { value: 'completed', label: 'Completed' },
                            { value: 'cancelled', label: 'Cancelled' }
                          ]}
                        />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
                          <Tooltip title="Print 80mm Slip">
                            <Button
                              size="small"
                              icon={<Printer size={13} />}
                              onClick={() => handlePrintSlip(order)}
                            />
                          </Tooltip>

                          {order.balanceAmount > 0 && order.status !== 'cancelled' && (
                            <Tooltip title="Settle Balance Payment">
                              <Button
                                size="small"
                                type="primary"
                                icon={<CreditCard size={13} />}
                                onClick={() => {
                                  setSelectedOrder(order)
                                  collectForm.setFieldsValue({
                                    paymentMethod: 'CASH'
                                  })
                                  setIsCollectModalOpen(true)
                                }}
                                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
                              >
                                Settle
                              </Button>
                            </Tooltip>
                          )}

                          <Tooltip title="View Details">
                            <Button
                              size="small"
                              icon={<Eye size={13} />}
                              onClick={() => {
                                setSelectedOrder(order)
                                setIsViewModalOpen(true)
                              }}
                            />
                          </Tooltip>

                          <Popconfirm
                            title="Delete cake order?"
                            description="Are you sure you want to delete this cake order?"
                            onConfirm={() => handleDeleteOrder(order.id)}
                            okText="Yes, Delete"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                          >
                            <Button size="small" icon={<Trash2 size={13} />} />
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: NEW CAKE ORDER (Fitted, Clean, Catalog + Custom, KG + G)
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            <Cake size={18} style={{ color: '#16a34a' }} />
            Add New Custom Cake Order
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={740}
        centered
        destroyOnClose
        styles={{
          body: {
            maxHeight: 'calc(85vh - 75px)',
            overflowY: 'auto',
            paddingRight: 6
          }
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit} style={{ marginTop: 10 }}>
          {/* Branch & Staff Info */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="shopId" label="Fulfillment Branch" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                <Select
                  options={[
                    { value: 'b0000000-0000-0000-0000-000000000001', label: 'Wasana Cake - Katugastota (B1)' },
                    { value: 'b0000000-0000-0000-0000-000000000002', label: 'Wasana Cake - Poojapitiya (B2)' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cashier / Taken By" style={{ marginBottom: 12 }}>
                <Input value={currentUser?.name || 'Cashier'} disabled prefix={<User size={14} />} />
              </Form.Item>
            </Col>
          </Row>

          {/* Customer Details */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
              Customer Details
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="customerName"
                  label="Customer Name"
                  rules={[{ required: true, message: 'Please enter customer name' }]}
                  style={{ marginBottom: 8 }}
                >
                  <Input placeholder="e.g. Kasun Perera" prefix={<User size={14} style={{ color: '#94a3b8' }} />} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="customerPhone"
                  label="Phone Number"
                  rules={[{ required: true, message: 'Please enter customer phone' }]}
                  style={{ marginBottom: 8 }}
                >
                  <Input placeholder="e.g. 071-2345678" prefix={<Phone size={14} style={{ color: '#94a3b8' }} />} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={24}>
                <Form.Item name="customerEmail" label="Alternate Contact (Optional)" style={{ marginBottom: 0 }}>
                  <Input placeholder="Optional secondary phone or remarks" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Cake Item Selection: Catalog vs Custom */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Cake Item & Specifications
              </span>
              <Radio.Group
                size="small"
                value={itemMode}
                onChange={(e) => setItemMode(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="catalog">From Product List</Radio.Button>
                <Radio.Button value="custom">Custom Entry</Radio.Button>
              </Radio.Group>
            </div>

            {/* Catalog Selector Dropdown */}
            {itemMode === 'catalog' && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Select from Store Product Catalog:
                </div>
                <Select
                  showSearch
                  placeholder="Type to search product name or barcode..."
                  style={{ width: '100%' }}
                  onChange={handleProductSelect}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={products.map((p) => ({
                    value: p.id,
                    label: `${p.name} - Rs. ${Number(p.price).toFixed(2)} (${p.itemCode || 'ITEM'})`
                  }))}
                />
              </div>
            )}

            <Row gutter={12}>
              <Col span={14}>
                <Form.Item
                  name="cakeName"
                  label="Cake Title / Type"
                  rules={[{ required: true, message: 'Please enter or select cake name' }]}
                  style={{ marginBottom: 10 }}
                >
                  <Input placeholder='e.g. Birthday Theme Cake / Ribbon Cake' />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="flavor" label="Flavor" style={{ marginBottom: 10 }}>
                  <Select
                    options={FLAVOR_OPTIONS.map((f) => ({ value: f, label: f }))}
                    placeholder="Select Flavor"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Weight Input (KG and Grams G Selector) */}
            <Row gutter={12}>
              <Col span={10}>
                <Form.Item
                  label={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>Weight</span>
                      <Radio.Group
                        size="small"
                        value={weightUnit}
                        onChange={(e) => handleWeightUnitChange(e.target.value)}
                        style={{ marginLeft: 8 }}
                      >
                        <Radio.Button value="kg">kg</Radio.Button>
                        <Radio.Button value="g">g (grams)</Radio.Button>
                      </Radio.Group>
                    </div>
                  }
                  name="weightInput"
                  rules={[{ required: true, message: 'Enter cake weight' }]}
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber
                    min={weightUnit === 'g' ? 50 : 0.1}
                    step={weightUnit === 'g' ? 50 : 0.25}
                    style={{ width: '100%' }}
                    addonAfter={weightUnit}
                    value={weightVal}
                    onChange={(val) => setWeightVal(Number(val) || 1)}
                  />
                </Form.Item>

                {/* Quick Weight Chips */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {weightUnit === 'kg' ? (
                    [0.5, 1, 1.5, 2, 3].map((w) => (
                      <button
                        type="button"
                        key={w}
                        onClick={() => {
                          setWeightVal(w)
                          form.setFieldsValue({ weightInput: w })
                        }}
                        style={{
                          background: weightVal === w ? '#0f172a' : '#ffffff',
                          color: weightVal === w ? '#ffffff' : '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {w} kg
                      </button>
                    ))
                  ) : (
                    [250, 500, 750, 1000, 1500, 2000].map((w) => (
                      <button
                        type="button"
                        key={w}
                        onClick={() => {
                          setWeightVal(w)
                          form.setFieldsValue({ weightInput: w })
                        }}
                        style={{
                          background: weightVal === w ? '#0f172a' : '#ffffff',
                          color: weightVal === w ? '#ffffff' : '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {w} g
                      </button>
                    ))
                  )}
                </div>
              </Col>

              <Col span={7}>
                <Form.Item name="shape" label="Shape" style={{ marginBottom: 10 }}>
                  <Select options={SHAPE_OPTIONS.map((s) => ({ value: s, label: s }))} />
                </Form.Item>
              </Col>

              <Col span={7}>
                <Form.Item name="tierCount" label="Tiers" style={{ marginBottom: 10 }}>
                  <InputNumber min={1} max={5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* Wording on Cake */}
            <Form.Item name="wording" label="Wording on Cake (Text to write on cake)" style={{ marginBottom: 8 }}>
              <Input placeholder='e.g. "Happy 5th Birthday Kaveesha"' />
            </Form.Item>

            {/* Special Instructions */}
            <Form.Item name="specialInstructions" label="Kitchen Instructions" style={{ marginBottom: 0 }}>
              <Input.TextArea
                rows={2}
                placeholder="Specific decoration, color requests, or notes for the chef..."
              />
            </Form.Item>
          </div>

          {/* Pickup Schedule */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #0f172a',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 8 }}>
              Pickup Schedule
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="pickupDate"
                  label="Pickup Date"
                  rules={[{ required: true, message: 'Select pickup date' }]}
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="pickupTime" label="Pickup Time" style={{ marginBottom: 0 }}>
                  <TimePicker use12Hours format="hh:mm A" style={{ width: '100%' }} placeholder="Select time" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Pricing & Advance Payment */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>
              Pricing & Advance Payment
            </div>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item
                  name="totalAmount"
                  label="Total Price (Rs.)"
                  rules={[{ required: true, message: 'Enter total price' }]}
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber
                    min={0}
                    step={100}
                    style={{ width: '100%', fontSize: 14, fontWeight: 700 }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="advanceAmount"
                  label="Advance Paid (Rs.)"
                  rules={[{ required: true, message: 'Enter advance amount' }]}
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber
                    min={0}
                    step={100}
                    style={{ width: '100%', fontSize: 14, fontWeight: 700, color: '#16a34a' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="advancePaymentMethod" label="Payment Method" style={{ marginBottom: 8 }}>
                  <Select
                    options={[
                      { value: 'CASH', label: 'Cash' },
                      { value: 'CARD', label: 'Credit / Debit Card' },
                      { value: 'BANK', label: 'Bank Transfer' },
                      { value: 'ONLINE', label: 'Online' }
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Calculated Remaining Balance Highlight Box */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #0f172a',
              borderRadius: 6,
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
                  {balanceDuePreview > 0 ? 'Remaining Balance Due on Pickup:' : 'Status: Fully Paid in Advance'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Settled upon cake delivery to customer.
                </div>
              </div>
              <div style={{
                fontSize: 17,
                fontWeight: 900,
                color: balanceDuePreview > 0 ? '#0f172a' : '#16a34a'
              }}>
                Rs. {balanceDuePreview.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Sticky/Bottom Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 8,
            borderTop: '1px solid #e2e8f0'
          }}>
            <Button onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<Printer size={14} />}
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 700,
                padding: '0 22px'
              }}
            >
              Save Order & Print Slip
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── MODAL: COLLECT BALANCE PAYMENT ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            <CreditCard size={18} color="#16a34a" />
            Settle Balance Payment (Order #{selectedOrder?.orderNo})
          </div>
        }
        open={isCollectModalOpen}
        onCancel={() => setIsCollectModalOpen(false)}
        footer={null}
        width={440}
        centered
        destroyOnClose
      >
        {selectedOrder && (
          <Form form={collectForm} layout="vertical" onFinish={handleCollectBalanceSubmit} style={{ marginTop: 12 }}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 12,
              marginBottom: 14
            }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Customer:</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                {selectedOrder.customerName} ({selectedOrder.customerPhone})
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Cake:</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                {selectedOrder.cakeName} ({formatWeight(selectedOrder.weightKg)})
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '2px solid #0f172a',
              borderRadius: 8,
              padding: 12,
              textAlign: 'center',
              marginBottom: 14
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Amount to Collect Now:
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                Rs. {selectedOrder.balanceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <Form.Item name="paymentMethod" label="Balance Payment Method" rules={[{ required: true }]} style={{ marginBottom: 14 }}>
              <Select
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'CARD', label: 'Credit / Debit Card' },
                  { value: 'BANK', label: 'Bank Transfer' }
                ]}
              />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button onClick={() => setIsCollectModalOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<CheckCircle2 size={14} />}
                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
              >
                Confirm Payment & Complete Order
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* ── MODAL: VIEW ORDER DETAILS ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            <Cake size={18} color="#16a34a" />
            Cake Order Details: #{selectedOrder?.orderNo}
          </div>
        }
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsViewModalOpen(false)}>Close</Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={14} />}
            onClick={() => selectedOrder && handlePrintSlip(selectedOrder)}
            style={{ background: '#0f172a', borderColor: '#0f172a' }}
          >
            Print Slip
          </Button>
        ]}
        width={500}
        centered
      >
        {selectedOrder && (
          <div style={{ fontSize: 13, lineHeight: 1.6, padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Order Status:</span>
              <Tag style={{ textTransform: 'uppercase', fontWeight: 800, background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                {selectedOrder.status}
              </Tag>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Customer:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedOrder.customerName} ({selectedOrder.customerPhone})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Pickup Date & Time:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>
                {selectedOrder.pickupDate} {selectedOrder.pickupTime ? `at ${selectedOrder.pickupTime}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Cake Item & Flavor:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedOrder.cakeName} - {selectedOrder.flavor || 'Standard'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Weight & Shape:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatWeight(selectedOrder.weightKg)}, {selectedOrder.shape} ({selectedOrder.tierCount} Tier)</span>
            </div>

            {selectedOrder.wording && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6, margin: '8px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>Wording on Cake:</span>
                <div style={{ fontWeight: 700, fontStyle: 'italic', color: '#0f172a' }}>&ldquo;{selectedOrder.wording}&rdquo;</div>
              </div>
            )}

            {selectedOrder.specialInstructions && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6, margin: '8px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>Kitchen Instructions:</span>
                <div style={{ color: '#0f172a' }}>{selectedOrder.specialInstructions}</div>
              </div>
            )}

            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '2px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Total Amount:</span>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>Rs. {selectedOrder.totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#16a34a' }}>
                <span>Advance Paid ({selectedOrder.advancePaymentMethod}):</span>
                <span style={{ fontWeight: 800 }}>Rs. {selectedOrder.advanceAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                <span>Balance Due:</span>
                <span>Rs. {selectedOrder.balanceAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
