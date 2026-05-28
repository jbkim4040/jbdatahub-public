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
          {/* 서비스 포털 홈 — 자체 레이아웃 (nav bar 없음) */}
          <Route index element={<DatahubRedirect />} />

          {/* 내부 페이지 — Layout nav bar 사용 */}
          <Route path="/" element={<Layout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="list"  element={<ListPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
