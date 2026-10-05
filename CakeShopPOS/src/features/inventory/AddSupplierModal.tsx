import React, { useState } from 'react'
import { Modal, Form, Input, message } from 'antd'
import { Truck, Building, User, Phone, MapPin, FileText } from 'lucide-react'
import { suppliersApi, SupplierDto } from '../../api/suppliersApi'

interface AddSupplierModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (newSupplier: SupplierDto) => void
}

export const AddSupplierModal: React.FC<AddSupplierModalProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (values: any) => {
    setIsSubmitting(true)
    try {
      const created = await suppliersApi.create({
        name: values.name.trim(),
        phone: values.phone?.trim() || undefined,
        contactPerson: values.contactPerson?.trim() || undefined,
        email: values.email?.trim() || undefined,
        address: values.address?.trim() || undefined,
        notes: values.notes?.trim() || undefined
      })
      message.success(`Supplier "${created.name}" added successfully!`)
      form.resetFields()
      onSuccess(created)
      onClose()
    } catch (err: any) {
      console.error('Failed to create supplier:', err)
      message.error(err.message || 'Failed to add supplier')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#ecfdf5',
              border: '1.5px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0
            }}
          >
            <Truck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Add New Supplier (නව සැපයුම්කරු)
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginTop: 1 }}>
              Register a new vendor for stock purchases and owner expense audit
            </div>
          </div>
        </div>
      }
      okText="Save Supplier (සැපයුම්කරු සුරකින්න)"
      okButtonProps={{
        style: {
          background: 'var(--primary)',
          borderColor: 'var(--primary)',
          fontWeight: 700,
          borderRadius: 8,
          height: 38,
          padding: '0 20px'
        }
      }}
      cancelButtonProps={{
        style: {
          borderRadius: 8,
          height: 38,
          fontWeight: 600
        }
      }}
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ paddingTop: 14 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
          <Form.Item
            name="name"
            label={
              <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b' }}>
                Supplier / Business Name <span style={{ color: '#ef4444' }}>*</span>
              </span>
            }
            rules={[
              { required: true, message: 'Please enter supplier name' },
              { whitespace: true, message: 'Name cannot be empty' },
              { min: 2, message: 'Name must be at least 2 characters' }
            ]}
            style={{ marginBottom: 12 }}
          >
            <Input
              prefix={<Building size={16} color="#94a3b8" style={{ marginRight: 4 }} />}
              placeholder="e.g. Ceylon Biscuits Ltd, Maliban, Prima"
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="contactPerson"
              label={<span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>Contact Person</span>}
              style={{ marginBottom: 0 }}
            >
              <Input
                prefix={<User size={15} color="#94a3b8" style={{ marginRight: 4 }} />}
                placeholder="e.g. Mr. Kamal"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label={<span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>Phone Number</span>}
              style={{ marginBottom: 0 }}
            >
              <Input
                prefix={<Phone size={15} color="#94a3b8" style={{ marginRight: 4 }} />}
                placeholder="e.g. 077-1234567"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
          <Form.Item
            name="address"
            label={<span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>Address / Branch</span>}
            style={{ marginBottom: 12 }}
          >
            <Input
              prefix={<MapPin size={15} color="#94a3b8" style={{ marginRight: 4 }} />}
              placeholder="e.g. Katugastota, Kandy"
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label={<span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>Supplied Goods / Notes</span>}
            style={{ marginBottom: 0 }}
          >
            <Input
              prefix={<FileText size={15} color="#94a3b8" style={{ marginRight: 4 }} />}
              placeholder="e.g. Flour, Sugar, Cake Boxes, Dairy Supplies"
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default AddSupplierModal
