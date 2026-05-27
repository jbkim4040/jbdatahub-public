import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

http.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default http
