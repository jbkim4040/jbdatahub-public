import http from './http'

export const login = (username, password) =>
  http.post('/auth/login', { username, password })

// C1: refreshToken/logout은 httpOnly cookie로 자동 전송
export const refreshToken = () =>
  http.post('/auth/refresh', {})

export const logout = () =>
  http.post('/auth/logout', {})
