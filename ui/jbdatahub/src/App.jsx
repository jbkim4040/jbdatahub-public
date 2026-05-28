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
        {/* 포털 홈 — datahub 서브도메인이면 /list로 자동 이동 */}
        <Route index element={<DatahubRedirect />} />

        {/* 그 외 페이지 — 기존 Layout (네비 + 푸터) */}
        <Route path="/" element={<Layout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="list" element={<ListPage />} />
        </Route>
      </Routes>
    </AuthProvider>
    </ToastProvider>
  )
}
