import React, { useState } from 'react'
import { Receipt, Plus, DollarSign } from 'lucide-react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/formatters'

export const ExpensesPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const [expenses, setExpenses] = useState<any[]>([
    { id: '1', category: 'Ingredients', description: 'Fresh Strawberries from Nuwara Eliya (2kg)', amount: 2400, expense_date: '2026-08-17' },
    { id: '2', category: 'Utilities', description: 'Gas Cylinder Refill (Litro 12.5kg)', amount: 3680, expense_date: '2026-08-17' }
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
      expense_date: new Date().toISOString().split('T')[0]
    }
    setExpenses([newExpense, ...expenses])
    message.success('Expense recorded successfully')
    setIsModalOpen(false)
    form.resetFields()
  }

  return (
    <div className="flex h-full w-full flex-col p-6 overflow-hidden space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt size={22} className="text-brand-400" />
            <span>Petty Cash & Daily Expenses</span>
          </h2>
          <p className="text-xs text-slate-400">
            Track daily operating expenses, ingredients and petty cash for {currentShop?.name}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg glow-pink hover:bg-brand-600 active:scale-95 transition-all"
        >
          <Plus size={16} />
          <span>Record New Expense</span>
        </button>
      </div>

      {/* Total Banner */}
      <div className="rounded-2xl bg-slate-900/60 p-4 border border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400">TOTAL EXPENSES (අද වියදම් එකතුව)</p>
          <p className="text-2xl font-extrabold text-rose-400">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/90 text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Description</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {expenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-bold text-brand-400">{exp.category}</td>
                <td className="p-3.5">{exp.description}</td>
                <td className="p-3.5 text-slate-400">{exp.expense_date}</td>
                <td className="p-3.5 text-right font-extrabold text-rose-400">
                  {formatCurrency(exp.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expense Modal */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        title="Record Daily Expense"
        centered
        className="dark-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddExpense} className="pt-2">
          <Form.Item
            name="category"
            label={<span className="text-slate-300">Category</span>}
            rules={[{ required: true, message: 'Select category' }]}
          >
            <Select placeholder="Select expense category">
              <Select.Option value="Ingredients">Ingredients & Raw Materials</Select.Option>
              <Select.Option value="Utilities">Utilities (Gas, Electricity)</Select.Option>
              <Select.Option value="Packaging">Boxes, Bags & Packaging</Select.Option>
              <Select.Option value="Staff Meals">Staff Meals & Tea</Select.Option>
              <Select.Option value="Maintenance">Maintenance & Repairs</Select.Option>
              <Select.Option value="Other">Other Miscellaneous</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label={<span className="text-slate-300">Description / Item Details</span>}
            rules={[{ required: true, message: 'Enter description' }]}
          >
            <Input placeholder="e.g. 5kg Anchor Butter from wholesale" />
          </Form.Item>

          <Form.Item
            name="amount"
            label={<span className="text-slate-300">Amount (Rs.)</span>}
            rules={[{ required: true, message: 'Enter expense amount' }]}
          >
            <InputNumber min={1} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
