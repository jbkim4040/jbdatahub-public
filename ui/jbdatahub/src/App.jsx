import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ListPage from './pages/ListPage'

function DatahubRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.location.hostname === 'datahub.jbdatahub.com') {
      navigate('/list', { replace: true })
    }
  }, [navigate])
  return <HomePage />
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DatahubRedirect />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="list" element={<ListPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
