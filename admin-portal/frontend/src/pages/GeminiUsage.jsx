import { useEffect, useState } from 'react'
import { Sparkles, Zap, Gauge, DollarSign, AlertCircle, TrendingUp } from 'lucide-react'
import { geminiUsageApi } from '../api'

// ─── 작은 컴포넌트들 ───
function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
    red:    'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
    gray:   'bg-gray-50 text-gray-700',
  }
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function QuotaGauge({ label, used, limit, pct }) {
  const bar = Math.min(100, pct ?? 0)
  const color = bar >= 90 ? 'bg-red-500' : bar >= 70 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{used?.toLocaleString()} / {limit?.toLocaleString()}</p>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${bar}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        잔여 <span className="font-semibold text-gray-700">{(limit - used).toLocaleString()}</span>
        <span className="ml-1">({(100 - bar).toFixed(1)}%)</span>
      </p>
    </div>
  )
}

// 작은 SVG sparkline. 의존성 추가 X.
function Sparkline({ data, valueKey = 'calls', height = 100 }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">데이터 없음</p>
  }
  const vals = data.map(d => d[valueKey] || 0)
  const max = Math.max(...vals, 1)
  const W = 600, H = height, pad = 24
  const stepX = (W - pad * 2) / Math.max(1, data.length - 1)
  const points = vals.map((v, i) => `${pad + i * stepX},${H - pad - (v / max) * (H - pad * 2)}`)
  const path = `M ${points.join(' L ')}`
  const area = `${path} L ${W - pad},${H - pad} L ${pad},${H - pad} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="rgb(59 130 246)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0"   />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#e5e7eb" strokeWidth="1" />
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} stroke="rgb(59 130 246)" strokeWidth="2" fill="none" />
      {vals.map((v, i) => {
        const x = pad + i * stepX
        const y = H - pad - (v / max) * (H - pad * 2)
        return <circle key={i} cx={x} cy={y} r="2" fill="rgb(59 130 246)" />
      })}
      {/* 시작·끝 라벨 */}
      <text x={pad}     y={H - 4} fontSize="10" fill="#9ca3af">{data[0].day?.slice(5)}</text>
      <text x={W - pad} y={H - 4} fontSize="10" fill="#9ca3af" textAnchor="end">{data[data.length - 1].day?.slice(5)}</text>
      <text x={W - pad} y={14}    fontSize="10" fill="#6b7280" textAnchor="end">max {max.toLocaleString()}</text>
    </svg>
  )
}

function FailureRow({ row }) {
  const date = new Date(row.ts).toLocaleString('ko-KR', { hour12: false })
  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{date}</td>
      <td className="px-3 py-2 text-xs">
        <span className="inline-flex px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">{row.status}</span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-700 max-w-md truncate" title={row.error}>{row.error || '—'}</td>
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{row.latency_ms ? `${row.latency_ms}ms` : '—'}</td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate" title={row.url}>{row.url || '—'}</td>
    </tr>
  )
}

export default function GeminiUsage() {
  const [summary,  setSummary]  = useState(null)
  const [series,   setSeries]   = useState(null)
  const [failures, setFailures] = useState(null)
  const [err,      setErr]      = useState(null)

  async function load() {
    try {
      const [s, t, f] = await Promise.all([
        geminiUsageApi.summary(),
        geminiUsageApi.timeseries(30),
        geminiUsageApi.recentFailures(20),
      ])
      setSummary(s.data); setSeries(t.data); setFailures(f.data); setErr(null)
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || '데이터를 불러오지 못했습니다')
    }
  }
  useEffect(() => {
    load()
    const id = setInterval(load, 30 * 1000)  // 30초마다 갱신
    return () => clearInterval(id)
  }, [])

  if (err) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Gemini 사용량</h1>
        <p className="text-sm text-red-600">{err}</p>
      </div>
    )
  }
  if (!summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Gemini 사용량</h1>
        <p className="text-sm text-gray-500">불러오는 중…</p>
      </div>
    )
  }

  const t  = summary.today
  const m  = summary.month
  const ft = summary.free_tier
  const pr = summary.pricing
  const KRW = 1400  // USD → KRW 환산 (대략)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={24} className="text-purple-600" />
            Gemini 사용량
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            모델 {pr.model} · 단가 ${pr.input_per_mtok_usd}/MTok in · ${pr.output_per_mtok_usd}/MTok out · 30초마다 자동 갱신
          </p>
        </div>
      </div>

      {/* ─── 오늘 카드 4종 ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Zap}
          label="오늘 호출"
          value={t.calls.toLocaleString()}
          sub={`성공 ${t.ok_calls} · 실패 ${t.failed_calls}`}
          color={t.failed_calls > 0 ? 'amber' : 'blue'}
        />
        <StatCard
          icon={TrendingUp}
          label="오늘 토큰"
          value={t.total_tokens.toLocaleString()}
          sub={`in ${t.input_tokens.toLocaleString()} · out ${t.output_tokens.toLocaleString()}`}
          color="purple"
        />
        <StatCard
          icon={Gauge}
          label="평균 응답"
          value={t.avg_latency_ms ? `${t.avg_latency_ms} ms` : '—'}
          sub="오늘 평균"
          color="green"
        />
        <StatCard
          icon={DollarSign}
          label="이번달 비용"
          value={`$${m.cost_usd.toFixed(4)}`}
          sub={`예상 $${m.projected_cost_usd.toFixed(2)} (~₩${Math.round(m.projected_cost_usd * KRW).toLocaleString()})`}
          color={m.projected_cost_usd > 5 ? 'amber' : 'gray'}
        />
      </div>

      {/* ─── 무료 티어 잔여량 게이지 ─── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">무료 티어 일일 잔여량</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <QuotaGauge
            label="요청 수 (RPD)"
            used={ft.rpd_used}
            limit={ft.rpd_limit}
            pct={ft.rpd_pct_used}
          />
          <QuotaGauge
            label="토큰 수 (TPD)"
            used={ft.tpd_used}
            limit={ft.tpd_limit}
            pct={ft.tpd_pct_used}
          />
        </div>
      </div>

      {/* ─── 30일 트렌드 ─── */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">최근 30일 호출 수</h2>
          <p className="text-xs text-gray-400">
            합계 {series?.reduce((s, d) => s + d.calls, 0).toLocaleString() ?? 0}
          </p>
        </div>
        <Sparkline data={series} valueKey="calls" height={120} />
      </div>

      {/* ─── 최근 실패 ─── */}
      <div className="bg-white rounded-xl border">
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <AlertCircle size={16} className="text-red-500" />
          <h2 className="text-sm font-semibold text-gray-700">최근 실패</h2>
          <span className="text-xs text-gray-400">({failures?.length ?? 0})</span>
        </div>
        {(!failures || failures.length === 0) ? (
          <p className="text-sm text-gray-400 text-center py-8">
            실패한 호출이 없습니다 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">시각</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">상태</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">에러</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">응답</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">URL</th>
                </tr>
              </thead>
              <tbody>
                {failures.map(r => <FailureRow key={r.id} row={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
