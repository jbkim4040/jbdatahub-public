import { useEffect, useState } from 'react'
import { GitPullRequest, Shield, Rocket, CheckCircle, XCircle, Clock } from 'lucide-react'
import { prsApi, securityApi, deployApi } from '../api'

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red:   'bg-red-50 text-red-700',
    gray:  'bg-gray-50 text-gray-700',
  }
  return (
    <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState({ prs: null, security: null, deploy: null })

  useEffect(() => {
    Promise.allSettled([
      prsApi.list(),
      securityApi.summary(),
      deployApi.status(),
    ]).then(([prs, sec, dep]) => {
      setData({
        prs:      prs.status === 'fulfilled' ? prs.value.data : null,
        security: sec.status === 'fulfilled' ? sec.value.data : null,
        deploy:   dep.status === 'fulfilled' ? dep.value.data : null,
      })
    })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GitPullRequest} label="열린 PR" value={data.prs?.length} color="blue" />
        <StatCard icon={Shield}        label="최근 보안 판정"
                  value={data.security?.overall_status}
                  color={data.security?.overall_status === 'PASS' ? 'green' : 'red'} />
        <StatCard icon={Rocket}        label="현재 활성 슬롯"
                  value={data.deploy?.active_slot?.toUpperCase()} color="gray" />
        <StatCard icon={CheckCircle}   label="마지막 빌드"
                  value={data.deploy?.last_build_result} color="gray" />
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-700 mb-3">빠른 작업</h2>
        <div className="flex gap-3">
          <a href="/prs"      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">PR 목록 보기</a>
          <a href="/security" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">보안 이력 보기</a>
          <a href="/deploy"   className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">배포 관리</a>
        </div>
      </div>
    </div>
  )
}
