import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,   // C1: httpOnly cookie 자동 전송
})

let isRefreshing = false
let failedQueue = []
const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()))
  failedQueue = []
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(() => http(original))
          .catch((e) => Promise.reject(e))
      }
      original._retry = true
      isRefreshing = true
      try {
        // 쿠키로 자동 전송, body 불필요
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        processQueue(null)
        return http(original)
      } catch (e) {
        processQueue(e)
        // 인증 만료 → 로그인 페이지로
        try { sessionStorage.removeItem('user') } catch (_) {}
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export default http
