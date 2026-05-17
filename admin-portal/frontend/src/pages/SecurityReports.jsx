import { useEffect, useState, useCallback } from 'react'
import { Shield, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { securityApi, deployApi } from '../api'
import ReportCard from '../components/ReportCard'

function SummaryBanner({ summary }) {
  if (!summary) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: '7일 스캔 횟수', value: summary.total },
        { label: 'PASS',         value: summary.pass_count, color: 'text-green-600' },
        { label: 'FAIL',         value: summary.fail_count, color: 'text-red-600' },
        { label: 'PASS율',        value: `${summary.pass_rate}%`, color: summary.pass_rate >= 80 ? 'text-green-600' : 'text-yellow-600' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

export default function SecurityReports() {
  const [reports, setReports]   = useState([])
  const [summary, setSummary]   = useState(null)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast]       = useState('')
  const LIMIT = 10

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const [rep, sum] = await Promise.all([securityApi.reports(p), securityApi.summary()])
      setReports(rep.data.items ?? [])
      setSummary(sum.data)
    } catch {
      setToast('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleScan = async () => {
    setScanning(true)
    try {
      await deployApi.scan()
      setToast('보안 스캔이 시작됐습니다. 완료까지 약 15분 소요됩니다.')
    } catch {
      setToast('스캔 트리거 실패')
    } finally {
      setScanning(false)
      setTimeout(() => setToast(''), 4000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900">보안 보고서 이력</h1>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          {scanning ? '스캔 시작 중...' : '지금 스캔 실행'}
        </button>
      </div>

      {toast && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">{toast}</div>
      )}

      <SummaryBanner summary={summary} />

      {loading ? (
        <div className="text-center text-gray-400 py-12">로딩 중...</div>
      ) : reports.length === 0 ? (
        <div className="text-center text-gray-400 py-12">보고서가 없습니다. 보안 스캔을 실행해 주세요.</div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}

      <div className="flex justify-center gap-2">
        <button onClick={() => { setPage(p => Math.max(1, p - 1)); load(page - 1) }}
          disabled={page === 1}
          className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
          <ChevronLeft size={14} /> 이전
        </button>
        <span className="px-3 py-2 text-sm text-gray-500">페이지 {page}</span>
        <button onClick={() => { setPage(p => p + 1); load(page + 1) }}
          disabled={reports.length < LIMIT}
          className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
          다음 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
