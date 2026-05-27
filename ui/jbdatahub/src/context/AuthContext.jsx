import { createContext, useContext, useState, useCallback } from 'react'
import { logout as logoutApi } from '../api/authApi'

const STORAGE_KEY = 'jb_user'

const defaultValue = { auth: null, isAdmin: false, isSuperAdmin: false, isGuest: false, login: () => {}, logout: () => {} }
const AuthContext = createContext(defaultValue)

function readSavedUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

export function AuthProvider({ children }) {
  // C1: token은 httpOnly cookie. username/role만 sessionStorage에 보관 (탭 닫으면 사라짐)
  const [auth, setAuth] = useState(readSavedUser)

  const login = useCallback((_token, _refreshToken, username, role) => {
    const userInfo = { username, role }
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo)) } catch (_) {}
    setAuth(userInfo)
  }, [])

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY) } catch (_) {}
    setAuth(null)
    logoutApi().catch(() => {})
  }, [])

  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'SUPER_ADMIN'
  const isSuperAdmin = auth?.role === 'SUPER_ADMIN'
  const isGuest = auth?.role === 'GUEST'

  return (
    <AuthContext.Provider value={{ auth, isAdmin, isSuperAdmin, isGuest, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
