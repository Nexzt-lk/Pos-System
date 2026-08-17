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
                      <span className="badge badge-cat"
                        style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#6b7280' }}>
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
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title="Record Daily Expense"
        okText="Save Expense"
        okButtonProps={{ style: { background: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 700 } }}
        centered
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleAddExpense} style={{ paddingTop: 8 }}>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Select category' }]}>
            <Select placeholder="Select expense category">
              {CATEGORIES.map(c => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description / Item Details" rules={[{ required: true, message: 'Enter description' }]}>
            <Input placeholder="e.g. 5kg Anchor Butter from wholesale" />
          </Form.Item>
          <Form.Item name="amount" label="Amount (Rs.)" rules={[{ required: true, message: 'Enter amount' }]}>
            <InputNumber min={1} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
