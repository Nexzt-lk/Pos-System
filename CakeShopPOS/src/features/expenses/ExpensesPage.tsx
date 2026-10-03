import React, { useState, useEffect, useMemo } from 'react'
import {
  Receipt,
  Plus,
  Trash2,
  Pencil,
  TrendingDown,
  CalendarDays,
  Printer,
  Download,
  Search,
  User,
  Banknote,
  DollarSign,
  Coffee,
  Package,
  Flame,
  Truck,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building,
  HardHat,
  HelpCircle
} from 'lucide-react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Popconfirm,
  Tooltip
} from 'antd'
import { RefreshButton } from '../../components/RefreshButton'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'
import { expensesApi, ExpenseDto } from '../../api/expensesApi'
import dayjs, { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

// ─── Categories Definition (English Only) ───────────────────────────────────

export interface ExpenseCategoryDef {
  value: string
  label: string
  icon: any
  color: string
  bgColor: string
  borderColor: string
}

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  {
    value: 'Ingredients',
    label: 'Ingredients & Raw Materials',
    icon: Coffee,
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
  {
    value: 'Utilities',
    label: 'Utilities (Gas, Electricity, Water)',
    icon: Flame,
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  {
    value: 'Packaging',
    label: 'Cake Boxes, Boards & Packaging',
    icon: Package,
    color: '#7c3aed',
    bgColor: '#faf5ff',
    borderColor: '#e9d5ff'
  },
  {
    value: 'Staff Meals',
    label: 'Staff Meals & Daily Tea',
    icon: Coffee,
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a'
  },
  {
    value: 'Transport',
    label: 'Transport & Delivery Fuel',
    icon: Truck,
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd'
  },
  {
    value: 'Maintenance',
    label: 'Maintenance & Store Cleaning',
    icon: Wrench,
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  {
    value: 'Daily Labour',
    label: 'Casual Labour & Wages',
    icon: HardHat,
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa'
  },
  {
    value: 'Shop Rent',
    label: 'Shop Rent & Property Rates',
    icon: Building,
    color: '#4f46e5',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe'
  },
  {
    value: 'Other',
    label: 'Other Miscellaneous',
    icon: HelpCircle,
    color: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1'
  }
]

export const QUICK_PRESETS = [
  { category: 'Utilities', description: 'Litro Gas Refill 12.5kg', amount: 3690 },
  { category: 'Ingredients', description: 'Fresh Cow Milk 10 Litres', amount: 3200 },
  { category: 'Ingredients', description: 'Anchor Butter 5kg Slab', amount: 12500 },
  { category: 'Ingredients', description: 'White Sugar 50kg Sack', amount: 14000 },
  { category: 'Ingredients', description: 'Fresh Farm Eggs (100 pcs)', amount: 3800 },
  { category: 'Packaging', description: 'Cake Boxes & Golden Boards (100 pcs)', amount: 4500 },
  { category: 'Transport', description: 'Delivery Van Diesel Fuel', amount: 3000 },
  { category: 'Staff Meals', description: 'Morning / Evening Staff Tea & Snacks', amount: 1200 },
  { category: 'Maintenance', description: 'Store Cleaning & Sanitizer Supplies', amount: 850 }
]

type DateFilterMode = 'day' | 'range' | 'all'

// ─── Component ────────────────────────────────────────────────────────────────

export const ExpensesPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  const [expenses, setExpenses] = useState<ExpenseDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseDto | null>(null)
  const [isPrintingVoucher, setIsPrintingVoucher] = useState<string | null>(null)

  // Forms
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()

  // Filter States
  const [dateMode, setDateMode] = useState<DateFilterMode>('day')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [selectedRange, setSelectedRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadExpenses = async () => {
    setIsLoading(true)
    try {
      let data: ExpenseDto[] = []

      if (dateMode === 'day') {
        const dStr = selectedDate.format('YYYY-MM-DD')
        data = await expensesApi.getByDateRange(dStr, dStr)
      } else if (dateMode === 'range' && selectedRange && selectedRange[0] && selectedRange[1]) {
        const fromStr = selectedRange[0].format('YYYY-MM-DD')
        const toStr = selectedRange[1].format('YYYY-MM-DD')
        data = await expensesApi.getByDateRange(fromStr, toStr)
      } else {
        data = await expensesApi.getAll()
      }

      setExpenses(data || [])
    } catch (err) {
      console.error('Failed to load expenses:', err)
      message.error('Failed to load expenses from database')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadExpenses()
  }, [dateMode, selectedDate, selectedRange])

  // ─── Category counts ────────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    expenses.forEach((e) => {
      const cat = e.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [expenses])

  // ─── Filtered Data ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = expenses

    if (selectedCategory !== 'ALL') {
      result = result.filter(
        (e) => (e.category || 'Other').toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.addedBy?.toLowerCase().includes(q) ||
          e.localId?.toLowerCase().includes(q)
      )
    }

    return result
  }, [expenses, selectedCategory, searchQuery])

  // ─── Metrics Calculation ────────────────────────────────────────────────────

  const totalPeriodAmount = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  }, [filtered])

  const todayDrawerAmount = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD')
    return expenses
      .filter((e) => e.expenseDate === todayStr)
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  }, [expenses])

  const avgExpense = useMemo(() => {
    return filtered.length > 0 ? Math.round(totalPeriodAmount / filtered.length) : 0
  }, [filtered, totalPeriodAmount])

  const topCategory = useMemo(() => {
    if (filtered.length === 0) return { category: 'None', amount: 0 }
    const catMap: Record<string, number> = {}
    filtered.forEach((e) => {
      const c = e.category || 'Other'
      catMap[c] = (catMap[c] || 0) + (Number(e.amount) || 0)
    })
    let highestCat = 'None'
    let highestAmt = 0
    Object.entries(catMap).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt
        highestCat = cat
      }
    })
    return { category: highestCat, amount: highestAmt }
  }, [filtered])

  // Category appearance helper
  const getCategoryDef = (catName?: string): ExpenseCategoryDef => {
    const found = EXPENSE_CATEGORIES.find(
      (c) => c.value.toLowerCase() === (catName || '').toLowerCase()
    )
    return (
      found || {
        value: catName || 'Other',
        label: catName || 'Other',
        icon: HelpCircle,
        color: '#475569',
        bgColor: '#f8fafc',
        borderColor: '#cbd5e1'
      }
    )
  }

  // ─── Actions & Handlers ─────────────────────────────────────────────────────

  const handlePrevDay = () => setSelectedDate((d) => d.subtract(1, 'day'))
  const handleNextDay = () => setSelectedDate((d) => d.add(1, 'day'))
  const handleSetToday = () => {
    setDateMode('day')
    setSelectedDate(dayjs())
  }
  const handleSetYesterday = () => {
    setDateMode('day')
    setSelectedDate(dayjs().subtract(1, 'day'))
  }
  const handleSetThisMonth = () => {
    setDateMode('range')
    setSelectedRange([dayjs().startOf('month'), dayjs().endOf('month')])
  }
  const handleSetAllTime = () => {
    setDateMode('all')
  }

  const handlePrintVoucher = async (exp: ExpenseDto) => {
    setIsPrintingVoucher(exp.id)
    try {
      const voucherData = {
        shopName: currentShop?.name || 'Wasana Cake - Katugastota',
        branchName: `Branch: ${currentShop?.branch_code || 'B1'} · Petty Cash Register`,
        address: currentShop?.address || 'Horana Wasana Bakers Galagedara Road Katugastota',
        phone: currentShop?.phone || '071-1172201',
        voucherNo: exp.localId
          ? exp.localId.replace('exp-', 'EXP-')
          : `EXP-${exp.id.slice(0, 8).toUpperCase()}`,
        dateTime: `${exp.expenseDate} ${dayjs(exp.createdAt).format('hh:mm A')}`,
        category: exp.category || 'Other',
        description: exp.description,
        amount: exp.amount,
        addedBy: exp.addedBy || currentUser?.name || 'Cashier',
        footerNote: 'Wasana Cake Katugastota · Cash Drawer Outflow Slip'
      }

      const res = await expensesApi.printVoucher(voucherData)
      if (res.success) {
        message.success('Petty cash voucher sent to receipt printer')
      } else {
        message.warning(res.message || 'Thermal printer not detected. Check printer connection.')
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to print voucher')
    } finally {
      setIsPrintingVoucher(null)
    }
  }

  const handleAdd = async (values: any) => {
    try {
      await expensesApi.create({
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        expenseDate: (values.expenseDate || dayjs()).format('YYYY-MM-DD'),
        addedBy: values.addedBy || currentUser?.name || 'Cashier'
      })

      message.success('Expense recorded successfully')

      setIsAddModalOpen(false)
      addForm.resetFields()
      await loadExpenses()
    } catch (err: any) {
      message.error(err.message || 'Failed to record expense')
    }
  }

  const handleEdit = async (values: any) => {
    if (!editingExpense) return
    try {
      await expensesApi.update(editingExpense.id, {
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        expenseDate: (values.expenseDate || dayjs()).format('YYYY-MM-DD'),
        addedBy: values.addedBy || editingExpense.addedBy || currentUser?.name
      })

      message.success('Expense record updated successfully')
      setEditingExpense(null)
      editForm.resetFields()
      await loadExpenses()
    } catch (err: any) {
      message.error(err.message || 'Failed to update expense')
    }
  }

  const openEditModal = (exp: ExpenseDto) => {
    setEditingExpense(exp)
    editForm.setFieldsValue({
      category: exp.category || 'Other',
      description: exp.description,
      amount: exp.amount,
      expenseDate: dayjs(exp.expenseDate),
      addedBy: exp.addedBy || currentUser?.name || 'Cashier'
    })
  }

  const handleDelete = async (id: string) => {
    try {
      await expensesApi.delete(id)
      message.success('Expense record removed')
      await loadExpenses()
    } catch (err: any) {
      message.error(err.message || 'Failed to delete expense')
    }
  }



  const handleExportCSV = () => {
    if (filtered.length === 0) {
      message.warning('No expenses to export for the selected filter')
      return
    }

    const headers = [
      'Voucher ID',
      'Date',
      'Category',
      'Description',
      'Amount (LKR)',
      'Recorded By',
      'Status'
    ]
    const rows = filtered.map((e) => [
      `"${e.localId || e.id}"`,
      `"${e.expenseDate}"`,
      `"${e.category || 'Other'}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.amount,
      `"${e.addedBy || 'Cashier'}"`,
      `"${e.syncStatus || 'synced'}"`
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Expenses_${dayjs().format('YYYY-MM-DD')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('Expenses CSV exported successfully')
  }

  // ─── Modal Form Markup ──────────────────────────────────────────────────────

  const renderFormFields = (_isEdit: boolean = false) => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <Form.Item
          name="category"
          label={
            <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
              Expense Category
            </span>
          }
          rules={[{ required: true, message: 'Please select a category' }]}
        >
          <Select size="large" style={{ borderRadius: 8 }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <Select.Option key={c.value} value={c.value}>
                <span style={{ fontWeight: 600 }}>{c.label}</span>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="expenseDate"
          label={
            <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
              Expense Date
            </span>
          }
          rules={[{ required: true, message: 'Select date' }]}
        >
          <DatePicker
            size="large"
            style={{ width: '100%', borderRadius: 8 }}
            format="YYYY-MM-DD"
            disabledDate={(d) => d.isAfter(dayjs())}
          />
        </Form.Item>
      </div>

      <Form.Item
        name="description"
        label={
          <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
            Description & Purpose
          </span>
        }
        rules={[{ required: true, message: 'Please enter a description' }]}
      >
        <Input
          placeholder="e.g. 5kg Anchor Butter from wholesaler / Litro Gas 12.5kg"
          size="large"
          style={{ borderRadius: 8 }}
        />
      </Form.Item>



      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <Form.Item
          name="amount"
          label={
            <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
              Amount (LKR)
            </span>
          }
          rules={[{ required: true, message: 'Enter expense amount' }]}
        >
          <InputNumber
            min={1}
            size="large"
            placeholder="e.g. 3500"
            style={{
              width: '100%',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 16,
              color: '#dc2626'
            }}
            formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
          />
        </Form.Item>

        <Form.Item
          name="addedBy"
          label={
            <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
              Recorded By (Staff)
            </span>
          }
        >
          <Input placeholder="Cashier Name" size="large" style={{ borderRadius: 8 }} />
        </Form.Item>
      </div>



    </>
  )

  // ─── Render View ────────────────────────────────────────────────────────────

  return (
    <div
      className="page-container"
      style={{
        padding: '18px 24px',
        gap: 14,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* ── 1. Page Header ── */}
      <div className="page-header" style={{ alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div className="page-title" style={{ fontSize: 20 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.12)',
                border: '1px solid #86efac'
              }}
            >
              <Receipt size={20} />
            </div>
            <span>Petty Cash & Store Expenses</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--primary-dark)',
                background: 'var(--primary-bg)',
                border: '1px solid var(--primary-muted)',
                padding: '2px 8px',
                borderRadius: 99,
                marginLeft: 4
              }}
            >
              {filtered.length} Entries
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            Track store cash drawer outflows, raw material purchases, and operational costs ·{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {currentShop?.name || 'Wasana Cake - Katugastota'}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={handleExportCSV}
            title="Download CSV spreadsheet"
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <RefreshButton onClick={loadExpenses} isLoading={isLoading} />

          <button
            className="btn-primary"
            onClick={() => {
              addForm.setFieldsValue({
                category: 'Ingredients',
                expenseDate: dayjs(),
                addedBy: currentUser?.name || 'Cashier',
                printVoucher: true
              })
              setIsAddModalOpen(true)
            }}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          flexShrink: 0
        }}
      >
        {/* Card 1: Total Period Outflow */}
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
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Total Period Outflow
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 2 }}>
              {formatCurrency(totalPeriodAmount)}
            </div>
            <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600, marginTop: 1 }}>
              {filtered.length} entries recorded
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626'
            }}
          >
            <TrendingDown size={22} />
          </div>
        </div>

        {/* Card 2: Today's Drawer Outflow */}
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
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#ea580c',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Today's Drawer Outflow
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ea580c', marginTop: 2 }}>
              {formatCurrency(todayDrawerAmount)}
            </div>
            <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600, marginTop: 1 }}>
              Deducted from cash drawer today
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ea580c'
            }}
          >
            <Banknote size={22} />
          </div>
        </div>

        {/* Card 3: Average Ticket */}
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
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#166534',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Average Ticket
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 2 }}>
              {formatCurrency(avgExpense)}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>
              Average per expense slip
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
            <DollarSign size={22} />
          </div>
        </div>

        {/* Card 4: Top Category */}
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
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6b21a8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Top Outflow Category
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#7e22ce',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 180
              }}
              title={topCategory.category}
            >
              {topCategory.category}
            </div>
            <div style={{ fontSize: 11, color: '#9333ea', fontWeight: 600, marginTop: 1 }}>
              {formatCurrency(topCategory.amount)} spent
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#faf5ff',
              border: '1px solid #e9d5ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9333ea'
            }}
          >
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Date Controls Bar ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {/* Left: Date selector controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {dateMode === 'day' ? (
            <Space.Compact>
              <Button
                icon={<ChevronLeft size={16} />}
                onClick={handlePrevDay}
                title="Previous Day"
                style={{ borderRadius: '8px 0 0 8px' }}
              />
              <DatePicker
                value={selectedDate}
                onChange={(d) => d && setSelectedDate(d)}
                format="YYYY-MM-DD (dddd)"
                allowClear={false}
                disabledDate={(c) => c && c > dayjs().endOf('day')}
                style={{ width: 190, textAlign: 'center', fontWeight: 600 }}
              />
              <Button
                icon={<ChevronRight size={16} />}
                onClick={handleNextDay}
                disabled={selectedDate.isSame(dayjs(), 'day')}
                title="Next Day"
                style={{ borderRadius: '0 8px 8px 0' }}
              />
            </Space.Compact>
          ) : dateMode === 'range' ? (
            <RangePicker
              value={selectedRange}
              onChange={(dates) => setSelectedRange(dates as any)}
              format="YYYY-MM-DD"
              style={{ borderRadius: 8 }}
            />
          ) : null}

          {/* Quick Filter Buttons */}
          <Button
            type={dateMode === 'day' && selectedDate.isSame(dayjs(), 'day') ? 'primary' : 'default'}
            onClick={handleSetToday}
            style={{
              fontWeight: 600,
              borderRadius: 8,
              backgroundColor:
                dateMode === 'day' && selectedDate.isSame(dayjs(), 'day') ? '#16a34a' : undefined,
              borderColor:
                dateMode === 'day' && selectedDate.isSame(dayjs(), 'day') ? '#16a34a' : undefined
            }}
          >
            Today
          </Button>

          <Button
            type={
              dateMode === 'day' && selectedDate.isSame(dayjs().subtract(1, 'day'), 'day')
                ? 'primary'
                : 'default'
            }
            onClick={handleSetYesterday}
            style={{
              fontWeight: 600,
              borderRadius: 8,
              backgroundColor:
                dateMode === 'day' && selectedDate.isSame(dayjs().subtract(1, 'day'), 'day')
                  ? '#16a34a'
                  : undefined,
              borderColor:
                dateMode === 'day' && selectedDate.isSame(dayjs().subtract(1, 'day'), 'day')
                  ? '#16a34a'
                  : undefined
            }}
          >
            Yesterday
          </Button>

          <Button
            type={dateMode === 'range' ? 'primary' : 'default'}
            onClick={handleSetThisMonth}
            style={{
              fontWeight: 600,
              borderRadius: 8,
              backgroundColor: dateMode === 'range' ? '#16a34a' : undefined,
              borderColor: dateMode === 'range' ? '#16a34a' : undefined
            }}
          >
            This Month
          </Button>

          <Button
            type={dateMode === 'all' ? 'primary' : 'default'}
            onClick={handleSetAllTime}
            style={{
              fontWeight: 600,
              borderRadius: 8,
              backgroundColor: dateMode === 'all' ? '#16a34a' : undefined,
              borderColor: dateMode === 'all' ? '#16a34a' : undefined
            }}
          >
            All Time
          </Button>
        </div>

        {/* Right: Search Input */}
        <div style={{ width: 280 }}>
          <Input
            prefix={<Search size={15} style={{ color: 'var(--text-muted)', marginRight: 6 }} />}
            placeholder="Search expenses, cashier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="middle"
            style={{ borderRadius: 8 }}
          />
        </div>
      </div>

      {/* ── 4. Category Filter Tabs ── */}
      <div className="category-tabs" style={{ paddingBottom: 4, flexShrink: 0 }}>
        <button
          className={`cat-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('ALL')}
          type="button"
        >
          <span>All Categories</span>
          <span
            style={{
              background: selectedCategory === 'ALL' ? 'rgba(255,255,255,0.3)' : 'var(--surface-2)',
              padding: '1px 7px',
              borderRadius: 99,
              fontSize: 10.5,
              fontWeight: 700
            }}
          >
            {expenses.length}
          </span>
        </button>

        {EXPENSE_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.value] || 0
          const isActive = selectedCategory.toLowerCase() === cat.value.toLowerCase()
          return (
            <button
              key={cat.value}
              className={`cat-pill ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.value)}
              type="button"
              style={
                isActive
                  ? { backgroundColor: cat.color, borderColor: cat.color, color: '#fff' }
                  : undefined
              }
            >

              <span>{cat.label}</span>
              {count > 0 && (
                <span
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.3)' : cat.bgColor,
                    color: isActive ? '#fff' : cat.color,
                    padding: '1px 7px',
                    borderRadius: 99,
                    fontSize: 10.5,
                    fontWeight: 700
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>


      {/* ── 6. Main Expenses Table ── */}
      <div
        className="data-table"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          background: '#ffffff',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13
              }}
            >
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th
                    style={{
                      padding: '13px 18px',
                      width: 140,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Voucher #
                  </th>
                  <th
                    style={{
                      padding: '13px 16px',
                      width: 170,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Category
                  </th>
                  <th
                    style={{
                      padding: '13px 16px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Description & Purpose
                  </th>
                  <th
                    style={{
                      padding: '13px 16px',
                      width: 170,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Date & Time
                  </th>
                  <th
                    style={{
                      padding: '13px 16px',
                      width: 150,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Recorded By
                  </th>
                  <th
                    style={{
                      padding: '13px 16px',
                      textAlign: 'right',
                      width: 160,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      padding: '13px 18px',
                      textAlign: 'center',
                      width: 130,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      <Receipt
                        size={36}
                        style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }}
                      />
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        No expense records found
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                        {searchQuery || selectedCategory !== 'ALL'
                          ? 'Try adjusting your category filter or search keywords'
                          : 'Click "Record Expense" to record a petty cash payment'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((exp) => {
                    const def = getCategoryDef(exp.category)
                    const isPrinting = isPrintingVoucher === exp.id

                    return (
                      <tr
                        key={exp.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.12s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        {/* Voucher ID */}
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              padding: '2px 7px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#475569'
                            }}
                          >
                            {exp.localId ? exp.localId.slice(-8) : exp.id.slice(0, 8)}
                          </span>
                        </td>

                        {/* Category Badge */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              backgroundColor: def.bgColor,
                              color: def.color,
                              border: `1px solid ${def.borderColor}`,
                              fontWeight: 700,
                              fontSize: 11.5,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 9px',
                              borderRadius: 6
                            }}
                          >
                            <span>{exp.category || 'Other'}</span>
                          </span>
                        </td>

                        {/* Description */}
                        <td
                          style={{
                            padding: '12px 16px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontSize: 13
                          }}
                        >
                          {exp.description}
                        </td>

                        {/* Date & Time */}
                        <td
                          style={{
                            padding: '12px 16px',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CalendarDays size={13} style={{ color: '#94a3b8' }} />
                            <span>{exp.expenseDate}</span>
                            {exp.createdAt && (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                ({dayjs(exp.createdAt).format('hh:mm A')})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Recorded By */}
                        <td
                          style={{
                            padding: '12px 16px',
                            color: 'var(--text-secondary)',
                            fontSize: 12,
                            fontWeight: 500
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User size={13} style={{ color: '#94a3b8' }} />
                            <span>{exp.addedBy || 'Cashier'}</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontWeight: 900,
                            color: '#dc2626',
                            fontSize: 15
                          }}
                        >
                          {formatCurrency(exp.amount)}
                        </td>

                        {/* Quick Actions */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                          >
                            <Tooltip title="Print Petty Cash Voucher">
                              <button
                                type="button"
                                onClick={() => handlePrintVoucher(exp)}
                                disabled={isPrinting}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  opacity: isPrinting ? 0.6 : 1,
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = '#16a34a'
                                  e.currentTarget.style.color = '#16a34a'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#cbd5e1'
                                  e.currentTarget.style.color = '#334155'
                                }}
                              >
                                <Printer size={13} />
                              </button>
                            </Tooltip>

                            <Tooltip title="Edit Expense">
                              <button
                                type="button"
                                onClick={() => openEditModal(exp)}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = '#2563eb'
                                  e.currentTarget.style.color = '#2563eb'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#cbd5e1'
                                  e.currentTarget.style.color = '#334155'
                                }}
                              >
                                <Pencil size={13} />
                              </button>
                            </Tooltip>

                            <Popconfirm
                              title="Delete this expense?"
                              description="This will restore cash drawer calculations."
                              onConfirm={() => handleDelete(exp.id)}
                              okText="Delete"
                              okButtonProps={{ danger: true }}
                              cancelText="Cancel"
                            >
                              <Tooltip title="Delete">
                                <button
                                  type="button"
                                  style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#dc2626'
                                    e.currentTarget.style.color = '#ffffff'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#fef2f2'
                                    e.currentTarget.style.color = '#dc2626'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </Tooltip>
                            </Popconfirm>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Sticky Total Footer */}
          {filtered.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                borderTop: '2px solid #e2e8f0',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                TOTAL OUTFLOW ({filtered.length} entries for current view)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>
                {formatCurrency(totalPeriodAmount)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 7. Record Expense Modal ── */}
      <Modal
        open={isAddModalOpen}
        onCancel={() => {
          setIsAddModalOpen(false)
          addForm.resetFields()
        }}
        onOk={() => addForm.submit()}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #86efac'
              }}
            >
              <Receipt size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                Record Petty Cash Expense
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                Store Cash Drawer Outflow · Wasana Cake Katugastota
              </div>
            </div>
          </div>
        }
        okText="Record & Deduct from Register"
        okButtonProps={{
          style: {
            background: 'var(--primary, #16a34a)',
            borderColor: 'var(--primary, #16a34a)',
            fontWeight: 700,
            height: 40,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
          }
        }}
        cancelButtonProps={{ style: { height: 40, borderRadius: 8, fontWeight: 600 } }}
        centered
        width={540}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAdd}
          style={{ paddingTop: 12 }}
          initialValues={{
            category: 'Ingredients',
            expenseDate: dayjs(),
            addedBy: currentUser?.name || 'Cashier',
            printVoucher: true
          }}
        >
          {renderFormFields(false)}
        </Form>
      </Modal>

      {/* ── 8. Edit Expense Modal ── */}
      <Modal
        open={!!editingExpense}
        onCancel={() => {
          setEditingExpense(null)
          editForm.resetFields()
        }}
        onOk={() => editForm.submit()}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bfdbfe'
              }}
            >
              <Pencil size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                Edit Expense Record
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                Update details or correct amount
              </div>
            </div>
          </div>
        }
        okText="Save Changes"
        okButtonProps={{
          style: {
            background: '#2563eb',
            borderColor: '#2563eb',
            fontWeight: 700,
            height: 40,
            borderRadius: 8
          }
        }}
        cancelButtonProps={{ style: { height: 40, borderRadius: 8, fontWeight: 600 } }}
        centered
        width={540}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ paddingTop: 12 }}>
          {renderFormFields(true)}
        </Form>
      </Modal>
    </div>
  )
}

export default ExpensesPage
