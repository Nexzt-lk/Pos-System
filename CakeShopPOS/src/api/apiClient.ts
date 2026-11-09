import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

let apiStatus: 'online' | 'offline' | 'unknown' = 'unknown'
let nextCheckTime = 0

// Get API base URL from environment variable or default to local CakeShop API server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5292/api'

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
})

// Request interceptor to attach auth token if available and handle fail-fast
axiosInstance.interceptors.request.use(
  (config) => {
    // If the API is known to be offline, reduce timeout significantly to fail fast
    if (apiStatus === 'offline') {
      if (Date.now() < nextCheckTime) {
        // Instantly reject to prevent ANY network delay (drops load time to 0s)
        return Promise.reject(new Error('API is currently offline, using local database fallback'))
      } else {
        // Try once every 10 seconds with a very short timeout to see if it's back
        config.timeout = 500
      }
    }

    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle errors cleanly
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    apiStatus = 'online' // API is working
    return response
  },
  (error) => {
    if (apiStatus !== 'offline') {
      console.warn('[API Client] Backend server unreachable, switching to offline mode.')
    }
    apiStatus = 'offline' // Mark as offline so subsequent requests fail instantly
    nextCheckTime = Date.now() + 10000 // Wait 10 seconds before checking again

    const errorData = error.response?.data
    let message = ''
    if (typeof errorData === 'string') {
      message = errorData
    } else if (errorData && typeof errorData === 'object') {
      message = errorData.error || errorData.message || errorData.title || JSON.stringify(errorData)
    }
    if (!message) {
      message = error.message || 'API request failed'
    }
    return Promise.reject(new Error(message))
  }
)

const triggerAutoSync = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.triggerSync) {
    (window as any).electronAPI.triggerSync().catch(() => { })
  }
}

// Typed API client wrapper extracting response.data
export const apiClient = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.get<T>(url, config)
    return response.data
  },
  post: async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.post<T>(url, data, config)
    triggerAutoSync()
    return response.data
  },
  put: async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.put<T>(url, data, config)
    triggerAutoSync()
    return response.data
  },
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.delete<T>(url, config)
    triggerAutoSync()
    return response.data
  },
  patch: async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.patch<T>(url, data, config)
    triggerAutoSync()
    return response.data
  },
  instance: axiosInstance
}

export default apiClient
