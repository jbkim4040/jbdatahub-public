import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import PRList from './pages/PRList'
import SecurityReports from './pages/SecurityReports'
import Deploy from './pages/Deploy'
import RequestPage from './pages/RequestPage'
import ReportsPage from './pages/ReportsPage'
import SubscriptionPage from './pages/SubscriptionPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index         element={<Dashboard />} />
        <Route path="prs/*"      element={<PRList />} />
        <Route path="security/*" element={<SecurityReports />} />
        <Route path="deploy/*"   element={<Deploy />} />
        <Route path="request/*"  element={<RequestPage />} />
        <Route path="reports/*"  element={<ReportsPage />} />
        <Route path="subscriptions/*" element={<SubscriptionPage />} />
      </Route>
    </Routes>
  )
}
