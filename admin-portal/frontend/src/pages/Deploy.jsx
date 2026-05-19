import { useEffect, useState, useCallback } from 'react'
import { Rocket, Shield, RefreshCw, X } from 'lucide-react'
import { deployApi } from '../api'
import BuildStatus from '../components/BuildStatus'

const TOAST_DURATION_MS = 5000

function Toast({ msg, onClose }) {
  return msg ? (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
      <span>{msg}</span>
      <button onClick={onClose}><X size={14} /></button>
    </div>
  ) : null
}

function LogModal({ buildNumber, onClose }) {
  const [log, setLog] = useState('')
  useEffect(() => {
    if (!buildNumber) return
    deployApi.build(buildNumber).then(r => setLog(r.data.console_tail ?? '')).catch(() => setLog('로그를 불러오지 못했습니다.'))
  }, [buildNumber])
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <span className="font-semibold">Build #{buildNumber} 콘솔 로그</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <pre className="flex-1 overflow-auto text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-b-xl whitespace-pre-wrap">
          {log || '로딩 중...'}
        </pre>
      </div>
    </div>
  )
}

export default function Deploy() {
  const [status, setStatus]       = useState(null)
  const [builds, setBuilds]       = useState([])
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [toast, setToast]         = useState('')
  const [logBuild, setLogBuild]   = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), TOAST_DURATION_MS) }

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const [s, b] = await Promise.all([deployApi.status(), deployApi.builds(p)])
      setStatus(s.data)
      setBuilds(b.data.items ?? [])
    } catch { showToast('데이터 로드 실패') }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleDeploy = async () => {
    if (!window.confirm('배포를 실행하시겠습니까?')) return
    setDeploying(true)
    try { await deployApi.trigger(); showToast('배포가 시작됐습니다!') }
    catch { showToast('배포 트리거 실패') }
    finally { setDeploying(false) }
  }

  const handleScan = async () => {
    setScanning(true)
    try { await deployApi.scan(); showToast('보안 스캔이 시작됐습니다. (~15분)') }
    catch { showToast('스캔 트리거 실패') }
    finally { setScanning(false) }
  }

  const slotColor = status?.active_slot === 'green' ? 'text-green-600' : 'text-blue-600'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Rocket size={20} className="text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">배포 관리</h1>
      </div>

      <Toast msg={toast} onClose={() => setToast('')} />

      {/* 현재 상태 */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">현재 배포 상태</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-400">활성 슬롯</p>
            <p className={`text-xl font-bold uppercase ${slotColor}`}>{status?.active_slot ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">마지막 빌드</p>
            <p className="text-xl font-bold text-gray-900">#{status?.last_build_number ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">결과</p>
            <p className={`text-sm font-medium ${status?.last_build_result === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
              {status?.last_build_building ? '실행 중...' : (status?.last_build_result ?? '—')}
            </p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={handleDeploy} disabled={deploying}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              <Rocket size={14} className={deploying ? 'animate-bounce' : ''} />
              {deploying ? '배포 중...' : '배포 실행'}
            </button>
            <button onClick={handleScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
              <Shield size={14} className={scanning ? 'animate-spin' : ''} />
              {scanning ? '스캔 중...' : '보안 스캔'}
            </button>
            <button onClick={() => load()} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 빌드 이력 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">빌드 이력</h2>
        {loading ? (
          <p className="text-center text-gray-400 py-8">로딩 중...</p>
        ) : builds.length === 0 ? (
          <p className="text-center text-gray-400 py-8">빌드 이력이 없습니다.</p>
        ) : (
          builds.map(b => <BuildStatus key={b.number} build={b} onClick={setLogBuild} />)
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">이전</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">페이지 {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={builds.length < 10}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">다음</button>
        </div>
      </div>

      {logBuild && <LogModal buildNumber={logBuild} onClose={() => setLogBuild(null)} />}
    </div>
  )
}
