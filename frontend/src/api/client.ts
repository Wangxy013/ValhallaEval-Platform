import axios from 'axios'
import { message } from 'antd'

const defaultApiBaseUrl = import.meta.env.DEV ? '/api/v1' : '/valhalla-eval/api/v1'
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || defaultApiBaseUrl

const client = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Unwrap the { data, success } envelope from the backend
client.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (!response.data.success) {
        const msg = response.data.error || '请求失败'
        message.error(msg)
        return Promise.reject(new Error(msg))
      }
      // Return a synthetic response where .data is the inner data field
      return { ...response, data: response.data.data }
    }
    return response
  },
  (error) => {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      '请求失败'
    message.error(msg)
    return Promise.reject(error)
  }
)

export default client
