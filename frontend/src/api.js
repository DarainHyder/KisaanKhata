import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

// The backend serves /api/*, /analytics/*, /docs etc. from the same host.
export const API_ROOT = baseURL.replace(/\/api\/?$/, '')

const api = axios.create({
  baseURL,
  timeout: 30000,
})

export const rootApi = axios.create({
  baseURL: API_ROOT || '/',
  timeout: 30000,
})

export default api
