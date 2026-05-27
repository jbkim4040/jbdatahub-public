import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import PRList from './pages/PRList'
import SecurityReports from './pages/SecurityReports'
import Deploy from './pages/Deploy'
import RequestPage from './pages/RequestPage'
import ReportsPage from './pages/ReportsPage'
import SubscriptionPage from './pages/SubscriptionPage'
import GeminiUsage from './pages/GeminiUsage'
import LoginPage from './pages/LoginPage'
import DataCollectPage from './pages/DataCollectPage'
import DataSchedulerPage from './pages/DataSchedulerPage'
import DataUsersPage from './pages/DataUsersPage'

function ProtectedRoute({ children }) {
  const { auth } = useAuth()
  if (auth === undefined) return null // loading
  if (auth === null) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { auth, isAdmin } = useAuth()
  if (auth === undefined) return null // loading
  if (auth === null) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index         element={<Dashboard />} />
        <Route path="prs/*"      element={<PRList />} />
        <Route path="security/*" element={<SecurityReports />} />
        <Route path="deploy/*"   element={<Deploy />} />
        <Route path="request/*"  element={<RequestPage />} />
        <Route path="reports/*"  element={<ReportsPage />} />
        <Route path="subscriptions/*" element={<SubscriptionPage />} />
        <Route path="gemini/*"   element={<GeminiUsage />} />
        <Route path="collect"    element={<AdminRoute><DataCollectPage /></AdminRoute>} />
        <Route path="scheduler"  element={<AdminRoute><DataSchedulerPage /></AdminRoute>} />
        <Route path="users"      element={<AdminRoute><DataUsersPage /></AdminRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
