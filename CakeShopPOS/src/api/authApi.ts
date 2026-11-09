import { apiClient } from '../api/apiClient'

export interface UserDto {
  id: string
  shopId?: string
  name: string
  email?: string
  role: 'owner' | 'admin' | 'manager' | 'cashier'
  isActive: boolean
  lastLogin?: string
}

export interface VerifyPinRequest {
  pin: string
  userId?: string
}

export interface LoginRequest {
  email?: string
  password?: string
  pin?: string
}

export interface AuthResponseDto {
  success: boolean
  user?: UserDto
  message?: string
  token?: string
}

export interface CreateUserRequest {
  name: string
  email?: string
  pin: string
  role: 'owner' | 'admin' | 'manager' | 'cashier'
  shopId?: string
}

export const authApi = {
  getUsers: (): Promise<UserDto[]> => apiClient.get('/auth/users'),
  verifyPin: (data: VerifyPinRequest): Promise<AuthResponseDto> => apiClient.post('/auth/verify-pin', data),
  login: (data: LoginRequest): Promise<AuthResponseDto> => apiClient.post('/auth/login', data),
  createUser: (data: CreateUserRequest): Promise<UserDto> => apiClient.post('/auth/users', data)
}
