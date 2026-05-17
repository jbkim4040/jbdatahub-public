import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import PRList from './pages/PRList'
import SecurityReports from './pages/SecurityReports'
import Deploy from './pages/Deploy'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index         element={<Dashboard />} />
        <Route path="prs/*"      element={<PRList />} />
        <Route path="security/*" element={<SecurityReports />} />
        <Route path="deploy/*"   element={<Deploy />} />
      </Route>
    </Routes>
  )
}
