import React, { useState } from 'react'
import { Receipt, Plus, AlertCircle } from 'lucide-react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'
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
  Ingredients: '#16a34a', Utilities: '#3b82f6', Packaging: '#8b5cf6',
  'Staff Meals': '#f59e0b', Maintenance: '#ef4444', Other: '#6b7280'
}

export const ExpensesPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [expenses, setExpenses] = useState<any[]>([
    { id: '1', category: 'Ingredients', description: 'Fresh Strawberries from Nuwara Eliya (2kg)', amount: 2400, expense_date: dayjs().format('YYYY-MM-DD') },
    { id: '2', category: 'Utilities', description: 'Gas Cylinder Refill (Litro 12.5kg)', amount: 3680, expense_date: dayjs().format('YYYY-MM-DD') }
  ])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const handleAddExpense = (values: any) => {
    const newExpense = {
      id: Date.now().toString(),
      category: values.category,
      description: values.description,
      amount: values.amount,
      expense_date: dayjs().format('YYYY-MM-DD')
    }
    setExpenses([newExpense, ...expenses])
    message.success('Expense recorded!')
    setIsModalOpen(false)
    form.resetFields()
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
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> Record Expense
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flexShrink: 0 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="kpi-label">Total Expenses Today</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">No. of Entries</div>
          <div className="kpi-value">{expenses.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Largest Expense</div>
          <div className="kpi-value amber">
            {formatCurrency(Math.max(...expenses.map(e => e.amount), 0))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Description</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
        </table>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                    No expenses recorded today
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '11px 16px' }}>
                      <span className="badge"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[exp.category] || '#475569'}18`,
                          color: CATEGORY_COLORS[exp.category] || '#475569',
                          border: `1px solid ${CATEGORY_COLORS[exp.category] || '#e2e8f0'}40`,
                          fontWeight: 700
                        }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {exp.description}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>
                      {exp.expense_date}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--danger)', fontSize: 14 }}>
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>
                    TOTAL TODAY
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontSize: 16, color: 'var(--danger)' }}>
                    {formatCurrency(totalExpenses)}
                  </td>
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
                දෛනික වියදම් සටහන් කිරීම · Deducted from daily cash balance
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
                Expense Amount (රුපියල්)
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
