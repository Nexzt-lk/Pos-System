export interface Tenant {
  id: string
  name: string
  plan: 'basic' | 'pro' | 'enterprise'
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface Shop {
  id: string
  tenant_id: string
  name: string
  branch_code: string // e.g. "B1", "B2"
  address?: string
  phone?: string
  email?: string
  logo_url?: string
  currency: string // Default 'LKR'
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  tenant_id: string
  shop_id: string
  shopId?: string
  name: string
  email?: string
  pin_hash?: string
  role: 'owner' | 'admin' | 'manager' | 'cashier'
  is_active: boolean
  last_login?: string
}
