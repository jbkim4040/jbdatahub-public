import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { GitPullRequest, Shield, Rocket, LayoutDashboard, MessageSquarePlus, FileText, Database, Sparkles, Users, Calendar, LogOut } from 'lucide-react'
import { useAuth } from './context/AuthContext'

const nav = [
  { to: '/',              icon: LayoutDashboard,   label: '대시보드' },
  { to: '/prs',           icon: GitPullRequest,    label: 'PR 리뷰' },
  { to: '/security',      icon: Shield,            label: '보안 이력' },
  { to: '/deploy',        icon: Rocket,            label: '배포 관리' },
  { to: '/request',       icon: MessageSquarePlus, label: '기능 요청' },
  { to: '/reports',       icon: FileText,          label: '리포트' },
  { to: '/subscriptions', icon: Database,          label: '공공API 신청' },
  { to: '/gemini',        icon: Sparkles,          label: 'Gemini 사용량' },
]

const datahubNav = [
  { to: '/collect',   icon: Database,  label: '데이터 수집' },
  { to: '/scheduler', icon: Calendar,  label: '수집 스케줄' },
  { to: '/users',     icon: Users,     label: '사용자 관리' },
]

export default function Layout() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">관리소</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
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
          <div className="pt-3 pb-1 px-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">데이터허브</span>
          </div>
          {datahubNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
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
        {auth && (
          <div className="px-4 py-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-2 truncate">{auth.username}</div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <LogOut size={14} />
              로그아웃
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
