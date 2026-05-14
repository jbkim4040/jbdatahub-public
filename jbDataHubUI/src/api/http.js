import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

// 요청마다 토큰 자동 첨부
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 응답 시 로컬스토리지 정리
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
    }
    return Promise.reject(err)
  }
)

export default http
