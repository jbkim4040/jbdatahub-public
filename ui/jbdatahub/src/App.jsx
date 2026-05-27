import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ListPage from './pages/ListPage'
import CollectPage from './pages/CollectPage'
import UsersPage from './pages/UsersPage'
import SchedulerPage from './pages/SchedulerPage'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
      <Routes>
        {/* 포털 홈 — 자체 헤더 + 다크 테마 (Layout 미적용) */}
        <Route index element={<HomePage />} />

        {/* 그 외 페이지 — 기존 Layout (네비 + 푸터) */}
        <Route path="/" element={<Layout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="list" element={<ListPage />} />
          <Route
            path="collect"
            element={
              <ProtectedRoute adminOnly>
                <CollectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute adminOnly>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/scheduler"
            element={
              <ProtectedRoute adminOnly>
                <SchedulerPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
    </ToastProvider>
  )
}
