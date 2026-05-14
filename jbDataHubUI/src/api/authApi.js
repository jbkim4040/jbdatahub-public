import http from './http'

export const login = (username, password) =>
  http.post('/auth/login', { username, password })
