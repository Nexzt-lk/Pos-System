import { apiClient } from '../api/apiClient'

export interface ShopDto {
  id: string
  name: string
  branchCode: string
  address?: string
  phone?: string
  email?: string
  currency: string
  receiptFooter: string
}

export interface UpdateShopRequest {
  name: string
  branchCode: string
  address?: string
  phone?: string
  email?: string
  currency: string
  receiptFooter: string
}

export const shopsApi = {
  getCurrent: async (): Promise<ShopDto> => {
    try {
      return await apiClient.get<ShopDto>('/shops/current')
    } catch (_) {
      const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
      if (api?.dbQuery) {
        try {
          const local = await api.dbQuery('db:get-shop-current')
          if (local && local.id) return local
        } catch (_) {}
      }
      return {
        id: 'b0000000-0000-0000-0000-000000000001',
        name: 'Wasana Cake - Katugastota',
        branchCode: 'B1',
        address: 'Horana Wasana Bakers Galagedara Road Katugastota',
        phone: '071-1172201',
        email: 'wasana@cakes.lk',
        currency: 'LKR',
        receiptFooter: 'Thank you for visiting Wasana Cake - Katugastota! 🎂'
      }
    }
  },
  updateCurrent: (data: UpdateShopRequest): Promise<ShopDto> => apiClient.put('/shops/current', data)
}
