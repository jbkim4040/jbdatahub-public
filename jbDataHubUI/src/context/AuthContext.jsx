import { createContext, useContext, useState, useCallback } from 'react'
import { logout as logoutApi } from '../api/authApi'

const defaultValue = { auth: null, isAdmin: false, login: () => {}, logout: () => {} }
const AuthContext = createContext(defaultValue)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token    = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    const role     = localStorage.getItem('role')
    return token ? { token, username, role } : null
  })

  const login = useCallback((token, refreshToken, username, role) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('username', username)
    localStorage.setItem('role', role)
    setAuth({ token, username, role })
  }, [])

  const logout = useCallback(() => {
    const rt = localStorage.getItem('refreshToken')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    setAuth(null)
    if (rt) logoutApi(rt).catch(() => {})
  }, [])

  const isAdmin = auth?.role === 'ADMIN'

  return (
    <AuthContext.Provider value={{ auth, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
