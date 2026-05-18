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
    // FR #6 GUEST: 게스트 mutation 403 → toast 안내 + 가짜 성공 반환
    if (err.response?.status === 403 && err.response?.data?.error === 'guest_readonly') {
      try {
        window.toast?.warn('게스트 모드 — 변경 사항은 저장되지 않습니다 (테스트만 가능)')
      } catch {}
      return Promise.resolve({
        data: { _guestMode: true, ok: true, message: '게스트 모드 — 저장 안 됨' },
        status: 200, statusText: 'OK (guest mock)', headers: {}, config: original,
      })
    }
    if ([401, 403].includes(err.response?.status) && !original._retry) {
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

