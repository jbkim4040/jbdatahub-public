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
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
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
