import { Database, NavLink, Outlet } from 'react-router-dom'
import { GitPullRequest, Shield, Rocket, LayoutDashboard, MessageSquarePlus, FileText } 

const nav = [
  { to: '/',        icon: LayoutDashboard,    label: '대시보드' },
  { to: '/prs',     icon: GitPullRequest,     label: 'PR 리뷰' },
  { to: '/security',icon: Shield,             label: '보안 이력' },
  { to: '/deploy',  icon: Rocket,             label: '배포 관리' },
  { to: '/request', icon: MessageSquarePlus,  label: '기능 요청' },
  { to: '/reports', icon: FileText,           label: '리포트' },
  { to: '/subscriptions', icon: Database,    label: '공공API 신청' },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">JB Admin</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
