import { apiClient } from './apiClient'

export interface SaleItemRequest {
  productId: string
  quantity: number
  discount: number
}

export interface CreateSaleRequest {
  idempotencyKey?: string
  localId?: string
  cashierId?: string
  terminalId?: string
  items: SaleItemRequest[]
  discountType?: string
  discountAmount?: number
  taxAmount?: number
  note?: string
  paymentMethod: string
  cashGiven?: number
  cardReferenceNo?: string
}

export interface OrderItemDto {
  productName: string
  itemCode?: string
  unitPrice: number
  quantity: number
  discount: number
  subtotal: number
}

export interface PaymentDto {
  method: string
  amount: number
  cashGiven?: number
  changeGiven?: number
}

export interface OrderDto {
  id: string
  localId: string
  orderNo: string
  cashierId?: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  status: string
  createdAt: string
  items: OrderItemDto[]
  payments: PaymentDto[]
}

export const ordersApi = {
  createSale: (data: CreateSaleRequest, idempotencyKey?: string): Promise<OrderDto> => {
    return apiClient.post<OrderDto>('/orders/sale', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    })
  },

  getById: (id: string): Promise<OrderDto> => apiClient.get<OrderDto>(`/orders/${id}`)
}

export default ordersApi
