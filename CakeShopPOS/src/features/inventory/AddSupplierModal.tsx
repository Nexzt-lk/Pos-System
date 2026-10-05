import React, { useState } from 'react'
import { Modal, Form, Input, message } from 'antd'
import { Truck } from 'lucide-react'
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

  const fieldLabel = (text: string, required?: boolean) => (
    <span style={{ fontWeight: 600, fontSize: 12.5, color: '#334155' }}>
      {text}
      {required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </span>
  )

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
              width: 38,
              height: 38,
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
            <Truck size={19} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Add New Supplier
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginTop: 1 }}>
              Register a new vendor for stock purchases
            </div>
          </div>
        </div>
      }
      okText="Save Supplier"
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
            label={fieldLabel('Supplier / Business Name', true)}
            rules={[
              { required: true, message: 'Please enter supplier name' },
              { whitespace: true, message: 'Name cannot be empty' },
              { min: 2, message: 'Name must be at least 2 characters' }
            ]}
            style={{ marginBottom: 12 }}
          >
            <Input
              placeholder="e.g. Ceylon Biscuits Ltd, Maliban, Prima"
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="contactPerson"
              label={fieldLabel('Contact Person')}
              style={{ marginBottom: 0 }}
            >
              <Input
                placeholder="e.g. Mr. Kamal"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label={fieldLabel('Phone Number')}
              style={{ marginBottom: 0 }}
            >
              <Input
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
            label={fieldLabel('Address / Branch')}
            style={{ marginBottom: 12 }}
          >
            <Input
              placeholder="e.g. Katugastota, Kandy"
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label={fieldLabel('Supplied Goods / Notes')}
            style={{ marginBottom: 0 }}
          >
            <Input
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
