import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, login as apiLogin, logout as apiLogout } from '../api/datahubApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(undefined) // undefined = loading, null = not logged in

  useEffect(() => {
    getMe()
      .then(res => setAuth(res.data))
      .catch(() => setAuth(null))
  }, [])

  const login = async (username, password) => {
    const res = await apiLogin(username, password)
    setAuth(res.data) // LoginResponseDto: { username, role }
  }

  const logout = async () => {
    try { await apiLogout() } catch { /* ignore */ }
    setAuth(null)
  }

  const isSuperAdmin = auth?.role === 'SUPER_ADMIN'
  const isAdmin = auth?.role === 'ADMIN' || isSuperAdmin

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
