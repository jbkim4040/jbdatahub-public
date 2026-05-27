import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collectAll, collectPage, collectDataset, collectFileData, collectStandardData,
  stopCollect, getCollectStatus, getCollectHistory, generateAllDdl, resumeCollect,
} from '../api/datahubApi'
import { fmtDate } from '../utils/dateFormatter'

const POLLING_INTERVAL_MS = 2000
const HISTORY_LIMIT = 30
const HTTP_CONFLICT  = 409
const HTTP_FORBIDDEN = 403

const TYPES = [
  { key: 'openapi',       label: 'OpenAPI',    fn: collectAll },
  { key: 'dataset',       label: '데이터셋',    fn: collectDataset },
  { key: 'file-data',     label: '파일데이터',  fn: collectFileData },
  { key: 'standard-data', label: '표준데이터',  fn: collectStandardData },
]

const TYPE_LABELS = Object.fromEntries(TYPES.map(t => [t.key, t.label]))

const fmt = (n) => n?.toLocaleString() ?? '-'

const fmtDuration = (secs) => {
  if (!secs) return '-'
  if (secs < 60) return `${secs}초`
  const m = Math.floor(secs / 60), s = secs % 60
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

export default function DataCollectPage() {
  const [status, setStatus]           = useState(null)
  const [history, setHistory]         = useState([])
  const [pageInput, setPageInput]     = useState('')
  const [pageResult, setPageResult]   = useState(null)
  const [pageError, setPageError]     = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [stopping, setStopping]       = useState(false)
  const [startError, setStartError]   = useState(null)
  const [ddlLoading, setDdlLoading]   = useState(false)
  const [ddlMsg, setDdlMsg]           = useState(null)
  const pollRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    try { const res = await getCollectStatus(); setStatus(res.data); return res.data }
    catch { return null }
  }, [])

  const fetchHistory = useCallback(async () => {
    try { const res = await getCollectHistory(HISTORY_LIMIT); setHistory(res.data) }
    catch { /* ignore */ }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus()
      if (s && s.status !== 'RUNNING') {
        clearInterval(pollRef.current); pollRef.current = null
        fetchHistory()
      }
    }, POLLING_INTERVAL_MS)
  }, [fetchStatus, fetchHistory])

  useEffect(() => {
    fetchStatus().then((s) => { if (s?.status === 'RUNNING') startPolling() })
    fetchHistory()
    return () => stopPolling()
  }, [fetchStatus, startPolling, fetchHistory, stopPolling])

  const handleCollect = async (fn) => {
    setStartError(null); setStopping(false)
    try {
      await fn(); await fetchStatus(); startPolling()
    } catch (e) {
      const code = e.response?.status
      if (code === HTTP_CONFLICT)  setStartError('이미 수집이 진행 중입니다.')
      else if (code === HTTP_FORBIDDEN) setStartError('권한이 없습니다.')
      else setStartError(e.response?.data?.message ?? '수집 시작에 실패했습니다.')
    }
  }

  const handleStop = async () => { setStopping(true); try { await stopCollect() } catch { /* ignore */ } }

  const handleResume = async () => {
    setStartError(null)
    try {
      await resumeCollect(); await fetchStatus(); startPolling()
    } catch (e) {
      const code = e.response?.status
      if (code === HTTP_CONFLICT) setStartError('이미 수집이 진행 중입니다.')
      else setStartError(e.response?.data?.message ?? '수집 재개에 실패했습니다.')
    }
  }

  const handlePageCollect = async () => {
    const p = parseInt(pageInput)
    if (!p || p < 1) return alert('올바른 페이지 번호를 입력하세요.')
    setPageLoading(true); setPageResult(null); setPageError(null)
    try { const res = await collectPage(p); setPageResult(res.data) }
    catch (e) { setPageError(e.response?.data?.message ?? '수집 중 오류가 발생했습니다.') }
    finally { setPageLoading(false) }
  }

  const handleGenerateDdl = async () => {
    setDdlLoading(true); setDdlMsg(null)
    try {
      await generateAllDdl()
      setDdlMsg({ ok: true, text: 'DDL 생성 요청이 완료되었습니다.' })
    } catch (e) {
      setDdlMsg({ ok: false, text: e.response?.data?.message ?? 'DDL 생성에 실패했습니다.' })
    } finally {
      setDdlLoading(false)
    }
  }

  const isRunning = status?.status === 'RUNNING'
  const pct       = status?.progressPct ?? 0
  const memHistory = status?.history ?? {}

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">데이터 수집</h1>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">관리자 전용</span>
        </div>
        <p className="text-sm text-gray-500">공공 API에서 데이터를 수집합니다. 수집 중 중단 후 재개가 가능합니다.</p>
      </div>

      {/* 수집 타입 카드 */}
      <div className="grid grid-cols-2 gap-4">
        {TYPES.map(({ key, label, fn }) => {
          const h = memHistory[key]
          const active = isRunning && status?.sourceType === key
          return (
            <div key={key} className={`bg-white rounded-xl border p-4 flex flex-col gap-3 shadow-sm ${active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 text-sm">{label}</span>
                {active && <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />}
              </div>

              {active ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="font-bold text-blue-600">{fmt(status.savedCount)}건 저장됨</span>
                    {status.totalCount > 0
                      ? <span>{pct}%</span>
                      : <span>p.{status.currentPage}</span>
                    }
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: status.totalCount > 0 ? `${pct}%` : '100%', opacity: status.totalCount > 0 ? 1 : 0.4 }}
                    />
                  </div>
                  {status.totalCount > 0 && (
                    <div className="text-xs text-gray-400">{fmt(status.savedCount)} / {fmt(status.totalCount)}건</div>
                  )}
                  <button
                    className="w-full text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg py-1 hover:bg-red-100 transition-colors disabled:opacity-50"
                    onClick={handleStop} disabled={stopping}
                  >
                    {stopping ? '중지 요청 중...' : '중지'}
                  </button>
                </div>
              ) : h ? (
                <div className="space-y-0.5">
                  <div className="text-xs text-gray-400">🕐 {fmtDate(h.lastCompletedAt)}</div>
                  <div className="text-xs text-gray-600 font-medium">{fmt(h.lastSavedCount)}건 저장됨</div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">수집 이력 없음</div>
              )}

              <button
                className="mt-auto w-full text-sm bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 transition-colors disabled:opacity-40"
                onClick={() => handleCollect(fn)} disabled={isRunning}
              >
                {active ? '수집 중...' : '수집 시작'}
              </button>
            </div>
          )
        })}
      </div>

      {startError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">❌ {startError}</div>
      )}

      {/* 진행 상황 패널 */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-semibold text-blue-800 text-sm">
                {TYPE_LABELS[status.sourceType] ?? status.sourceType} 수집 중
              </span>
            </div>
            <button
              className="text-xs bg-white border border-red-300 text-red-600 px-3 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
              onClick={handleStop} disabled={stopping}
            >
              {stopping ? '중지 요청 중...' : '수집 중단'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['현재 페이지', fmt(status.currentPage)],
              ['저장 완료', fmt(status.savedCount)],
              ['전체 건수', status.totalCount > 0 ? fmt(status.totalCount) : '-'],
              ['진행률', status.totalCount > 0 ? `${pct}%` : '집계 중'],
              status.elapsedSeconds != null && ['경과 시간', fmtDuration(status.elapsedSeconds)],
              status.etaSeconds != null && ['남은 시간', fmtDuration(status.etaSeconds)],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-sm font-bold text-gray-800 mt-0.5">{value}</div>
              </div>
            ))}
          </div>
          {status.totalCount > 0 && (
            <div className="relative w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              <span className="absolute right-0 top-3 text-xs text-gray-500">{fmt(status.savedCount)} / {fmt(status.totalCount)}건</span>
            </div>
          )}
          {status.startedAt && (
            <div className="text-xs text-blue-600">시작: {fmtDate(status.startedAt)}</div>
          )}
        </div>
      )}

      {/* 완료/중단 결과 */}
      {(status?.status === 'DONE' || status?.status === 'STOPPED') && (
        <div className={`rounded-xl border p-5 space-y-3 ${status.status === 'STOPPED' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className="font-semibold text-sm text-gray-800">
            {status.status === 'STOPPED' ? '⏹ 수집이 중단되었습니다' : '✅ 수집이 완료되었습니다'}
          </h3>
          <ul className="text-sm text-gray-600 space-y-1 list-none">
            <li>저장 건수: <strong>{fmt(status.savedCount)}</strong></li>
            {status.totalCount > 0 && <li>전체 건수: <strong>{fmt(status.totalCount)}</strong></li>}
            {status.currentPage > 0 && <li>마지막 페이지: <strong>{status.currentPage}</strong></li>}
          </ul>
          {status.status === 'STOPPED' && (
            <button
              className="text-sm bg-yellow-600 text-white px-4 py-1.5 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              onClick={handleResume} disabled={isRunning}
            >
              이어서 수집
            </button>
          )}
        </div>
      )}

      <hr className="border-gray-200" />

      {/* 단일 페이지 수집 */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-800">단일 페이지 수집</h2>
        <p className="text-sm text-gray-500">특정 페이지 번호의 OpenAPI 목록만 수집합니다.</p>
        <div className="flex gap-2">
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="number" min="1" placeholder="페이지 번호"
            value={pageInput} onChange={(e) => setPageInput(e.target.value)}
          />
          <button
            className="text-sm bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            onClick={handlePageCollect} disabled={pageLoading}
          >
            {pageLoading ? '수집 중...' : '조회'}
          </button>
        </div>
        {pageResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
            완료 — {fmt(pageResult.savedCount)}건 저장 (전체 {fmt(pageResult.totalCount)}건)
          </div>
        )}
        {pageError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">{pageError}</div>}
      </div>

      <hr className="border-gray-200" />

      {/* DDL 전체 생성 */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-800">전체 DDL 생성</h2>
        <p className="text-sm text-gray-500">수집된 OpenAPI 목록 전체의 DDL을 생성합니다. 오래 걸릴 수 있습니다.</p>
        <button
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          onClick={handleGenerateDdl} disabled={ddlLoading || isRunning}
        >
          {ddlLoading ? '생성 요청 중...' : 'DDL 전체 생성'}
        </button>
        {ddlMsg && (
          <div className={`border rounded-lg px-4 py-2 text-sm ${ddlMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
            {ddlMsg.text}
          </div>
        )}
      </div>

      <hr className="border-gray-200" />

      {/* 수집 이력 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">수집 이력</h2>
          <button className="text-xs text-blue-600 hover:underline" onClick={fetchHistory}>새로고침</button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">수집 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs">
                  <th className="text-left px-3 py-2 border-b border-gray-200">유형</th>
                  <th className="text-left px-3 py-2 border-b border-gray-200">상태</th>
                  <th className="text-right px-3 py-2 border-b border-gray-200">저장</th>
                  <th className="text-right px-3 py-2 border-b border-gray-200">전체</th>
                  <th className="text-right px-3 py-2 border-b border-gray-200">소요시간</th>
                  <th className="text-left px-3 py-2 border-b border-gray-200">완료일시</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{TYPE_LABELS[log.sourceType] ?? log.sourceType}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${log.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {log.status === 'DONE' ? '완료' : '중단'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(log.totalSaved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(log.totalCount)}</td>
                    <td className="px-3 py-2 text-right">{fmtDuration(log.durationSecs)}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDate(log.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
