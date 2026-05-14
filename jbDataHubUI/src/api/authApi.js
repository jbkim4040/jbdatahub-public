import http from './http'
import axios from 'axios'

export const login = (username, password) =>
  http.post('/auth/login', { username, password })

export const refreshToken = (token) =>
  axios.post('/api/auth/refresh', { refreshToken: token })

export const logout = (token) =>
  http.post('/auth/logout', { refreshToken: token })
