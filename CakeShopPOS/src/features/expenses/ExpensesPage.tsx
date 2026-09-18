import React, { useState, useEffect } from 'react'
import { Receipt, Plus, AlertCircle, Trash2 } from 'lucide-react'
import { RefreshButton } from '../../components/RefreshButton'
import { Modal, Form, Input, InputNumber, Select, message, Popconfirm } from 'antd'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'
import { expensesApi, ExpenseDto } from '../../api/expensesApi'
import dayjs from 'dayjs'

const CATEGORIES = [
  { value: 'Ingredients', label: 'Ingredients & Raw Materials' },
  { value: 'Utilities', label: 'Utilities (Gas, Electricity)' },
  { value: 'Packaging', label: 'Boxes, Bags & Packaging' },
  { value: 'Staff Meals', label: 'Staff Meals & Tea' },
  { value: 'Maintenance', label: 'Maintenance & Repairs' },
  { value: 'Other', label: 'Other Miscellaneous' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Ingredients: '#16a34a',
  Utilities: '#3b82f6',
  Packaging: '#8b5cf6',
  'Staff Meals': '#f59e0b',
  Maintenance: '#ef4444',
  Other: '#6b7280'
}

export const ExpensesPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [expenses, setExpenses] = useState<ExpenseDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const loadExpenses = async () => {
    setIsLoading(true)
    try {
      const data = await expensesApi.getAll()
      setExpenses(data || [])
    } catch (err) {
      console.error('Failed to load expenses:', err)
      message.error('Failed to load expenses from server')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadExpenses()
  }, [])

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const handleAddExpense = async (values: any) => {
    try {
      await expensesApi.create({
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        expenseDate: dayjs().format('YYYY-MM-DD')
      })
      message.success('Expense recorded via Backend API!')
      setIsModalOpen(false)
      form.resetFields()
      await loadExpenses()
    } catch (err: any) {
      console.error('Failed to record expense:', err)
      message.error(err.message || 'Failed to record expense')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      await expensesApi.delete(id)
      message.success('Expense entry removed')
      await loadExpenses()
    } catch (err: any) {
      console.error('Failed to delete expense:', err)
      message.error(err.message || 'Failed to delete expense')
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <div className="page-title-icon"><Receipt size={18} /></div>
            Petty Cash & Daily Expenses
          </div>
          <div className="page-subtitle">
            Track daily operating costs and ingredients · {currentShop?.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <RefreshButton onClick={loadExpenses} isLoading={isLoading} />
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> Record Expense
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flexShrink: 0 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Expenses Recorded</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">No. of Entries</div>
          <div className="kpi-value">{expenses.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Largest Expense</div>
          <div className="kpi-value amber">
            {formatCurrency(expenses.length > 0 ? Math.max(...expenses.map(e => Number(e.amount) || 0)) : 0)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Category</th>
              <th>Description</th>
              <th style={{ width: 120 }}>Date</th>
              <th style={{ textAlign: 'right', width: 140 }}>Amount</th>
              <th style={{ width: 60, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
        </table>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                    No expenses recorded in database
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '11px 16px', width: 140 }}>
                      <span className="badge"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[exp.category || 'Other'] || '#475569'}18`,
                          color: CATEGORY_COLORS[exp.category || 'Other'] || '#475569',
                          border: `1px solid ${CATEGORY_COLORS[exp.category || 'Other'] || '#e2e8f0'}40`,
                          fontWeight: 700
                        }}>
                        {exp.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {exp.description}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, width: 120 }}>
                      {exp.expenseDate}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--danger)', fontSize: 14, width: 140 }}>
                      {formatCurrency(exp.amount)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center', width: 60 }}>
                      <Popconfirm
                        title="Delete this expense record?"
                        onConfirm={() => handleDeleteExpense(exp.id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 6
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </Popconfirm>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>
                    TOTAL EXPENSES
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontSize: 16, color: 'var(--danger)' }}>
                    {formatCurrency(totalExpenses)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fca5a5'
              }}
            >
              <Receipt size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                Record Daily Petty Expense
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                Saved directly to SQLite backend
              </div>
            </div>
          </div>
        }
        okText="Record Expense"
        okButtonProps={{
          style: {
            background: 'var(--primary)',
            borderColor: 'var(--primary)',
            fontWeight: 700,
            height: 38,
            borderRadius: 8
          }
        }}
        cancelButtonProps={{
          style: {
            height: 38,
            borderRadius: 8,
            fontWeight: 600
          }
        }}
        centered
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddExpense}
          style={{ paddingTop: 12 }}
          initialValues={{ category: 'Ingredients' }}
        >
          {/* Category Select */}
          <Form.Item
            name="category"
            label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Expense Category</span>}
            rules={[{ required: true, message: 'Select category' }]}
          >
            <Select size="large" style={{ borderRadius: 8 }}>
              {CATEGORIES.map((c) => (
                <Select.Option key={c.value} value={c.value}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: CATEGORY_COLORS[c.value] || '#16a34a'
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Description */}
          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Description / Item Details</span>}
            rules={[{ required: true, message: 'Enter expense description' }]}
          >
            <Input
              placeholder="e.g. 5kg Anchor Butter from wholesale"
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          {/* Quick suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 14 }}>
            {['Gas Refill 12.5kg', 'Anchor Butter 5kg', 'Cake Boxes 100pcs', 'Fresh Milk 10L', 'Sugar 50kg'].map((tag) => (
              <span
                key={tag}
                className="form-quick-chip"
                onClick={() => form.setFieldsValue({ description: tag })}
              >
                + {tag}
              </span>
            ))}
          </div>

          {/* Amount Input with Presets */}
          <div className="form-section" style={{ marginBottom: 4 }}>
            <div className="form-section-header">
              <span className="form-section-title">
                Expense Amount (LKR)
              </span>
            </div>

            <Form.Item
              name="amount"
              rules={[{ required: true, message: 'Enter expense amount' }]}
              style={{ marginBottom: 10 }}
            >
              <InputNumber
                min={1}
                size="large"
                placeholder="e.g. 2500"
                style={{
                  width: '100%',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 16,
                  color: 'var(--danger)'
                }}
                formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
              />
            </Form.Item>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[500, 1000, 1500, 2500, 3500, 5000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="form-quick-chip"
                  onClick={() => form.setFieldsValue({ amount: amt })}
                >
                  Rs. {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default ExpensesPage
