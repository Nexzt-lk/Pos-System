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
  getCurrent: (): Promise<ShopDto> => apiClient.get('/shops/current'),
  updateCurrent: (data: UpdateShopRequest): Promise<ShopDto> => apiClient.put('/shops/current', data)
}
