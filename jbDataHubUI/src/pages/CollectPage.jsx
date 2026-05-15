import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collectAll, collectPage,
  collectDataset, collectFileData, collectStandardData,
  stopCollect, resumeCollect, getCollectStatus, getCollectHistory, generateAllDdl,
} from '../api/publicApi'
import styles from './CollectPage.module.css'

const TYPES = [
  { key: 'openapi',        label: 'OpenAPI 목록',  fn: collectAll },
  { key: 'dataset',        label: '데이터셋',       fn: collectDataset },
  { key: 'file-data',      label: '파일데이터',     fn: collectFileData },
  { key: 'standard-data',  label: '표준데이터',     fn: collectStandardData },
]

const TYPE_LABELS = {
  openapi: 'OpenAPI',
  dataset: '데이터셋',
  'file-data': '파일데이터',
  'standard-data': '표준데이터',
}

const fmt = (n) => n?.toLocaleString() ?? '-'
const fmtDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const fmtEta = (secs) => {
  if (!secs) return null
  if (secs < 60) return `약 ${secs}초 남음`
  const m = Math.floor(secs / 60), s = secs % 60
  return s > 0 ? `약 ${m}분 ${s}초 남음` : `약 ${m}분 남음`
}
const fmtDuration = (secs) => {
  if (!secs) return '-'
  if (secs < 60) return `${secs}초`
  const m = Math.floor(secs / 60), s = secs % 60
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

export default function CollectPage() {
  const [status, setStatus]         = useState(null)
  const [history, setHistory]       = useState([])
  const [pageInput, setPageInput]   = useState('')
  const [pageResult, setPageResult] = useState(null)
  const [pageError, setPageError]   = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [stopping, setStopping]     = useState(false)
  const [startError, setStartError] = useState(null)
  const pollRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    try { const res = await getCollectStatus(); setStatus(res.data); return res.data }
    catch { return null }
  }, [])

  const fetchHistory = useCallback(async () => {
    try { const res = await getCollectHistory(30); setHistory(res.data) }
    catch { /* ignore */ }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus()
      if (s && s.status !== 'RUNNING') { stopPolling(); fetchHistory() }
    }, 2000)
  }, [fetchStatus, fetchHistory])

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => {
    fetchStatus().then((s) => { if (s?.status === 'RUNNING') startPolling() })
    fetchHistory()
    return () => stopPolling()
  }, [fetchStatus, startPolling, fetchHistory])

  const handleCollect = async (fn) => {
    setStartError(null); setStopping(false)
    try {
      await fn(); await fetchStatus(); startPolling()
    } catch (e) {
      const code = e.response?.status
      if (code === 409) setStartError('이미 수집이 진행 중입니다.')
      else if (code === 403) setStartError('관리자 권한이 없습니다.')
      else setStartError(e.response?.data?.message ?? '수집 시작 실패')
    }
  }

  const handleStop = async () => { setStopping(true); try { await stopCollect() } catch { /* ignore */ } }
  const handleResume = async () => { setStartError(null); try { await resumeCollect(); await fetchStatus(); startPolling() } catch(e) { setStartError(e.response?.data?.message ?? "재개 실패") } }
  const handleGenerateDdl = async () => {
    try { await generateAllDdl(); alert('DDL 생성이 백그라운드에서 시작되었습니다. 완료까지 수 분이 소요됩니다.') }
    catch(e) { alert('DDL 생성 시작 실패: ' + (e.response?.data ?? e.message)) }
  }

  const handlePageCollect = async () => {
    const p = parseInt(pageInput)
    if (!p || p < 1) return alert('1 이상의 페이지 번호를 입력하세요.')
    setPageLoading(true); setPageResult(null); setPageError(null)
    try { const res = await collectPage(p); setPageResult(res.data) }
    catch (e) { setPageError(e.response?.data?.message ?? '오류가 발생했습니다.') }
    finally { setPageLoading(false) }
  }

  const isRunning  = status?.status === 'RUNNING'
  const pct        = status?.progressPct ?? 0
  const memHistory = status?.history ?? {}

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>데이터 수집</h1>
        <span className={styles.adminBadge}>🔒 관리자 전용</span>
      </div>
      <p className={styles.desc}>공공데이터포털 외부 API에서 데이터를 수집하여 DB에 저장합니다.</p>

      {/* 수집 타입 카드 */}
      <div className={styles.grid}>
        {TYPES.map(({ key, label, fn }) => {
          const h = memHistory[key]
          const active = isRunning && status?.sourceType === key
          return (
            <div key={key} className={`${styles.card} ${active ? styles.cardActive : ''}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>{label}</span>
                {active && <span className={styles.badge}>수집 중</span>}
              </div>
              {h ? (
                <div className={styles.lastInfo}>
                  <span className={styles.lastDate}>🕐 {fmtDate(h.lastCompletedAt)}</span>
                  <span className={styles.lastCount}>{fmt(h.lastSavedCount)}건 저장</span>
                </div>
              ) : (
                <div className={styles.noHistory}>수집 이력 없음</div>
              )}
              <button className={styles.btnStart} onClick={() => handleCollect(fn)} disabled={isRunning}>
                {active ? '수집 중...' : '수집 시작'}
              </button>
            </div>
          )
        })}
      </div>

      {startError && <div className={styles.errorBox}>❌ {startError}</div>}

      {/* 진행 상황 패널 */}
      {isRunning && (
        <div className={styles.progressPanel}>
          <div className={styles.progressHeader}>
            <span className={styles.spinner} />
            <span className={styles.progressTitle}>
              {TYPES.find(t => t.key === status.sourceType)?.label ?? status.sourceType} 수집 중
            </span>
            <button className={styles.btnStop} onClick={handleStop} disabled={stopping}>
              {stopping ? '중지 요청 중...' : '⏹ 수집 중지'}
            </button>
          </div>
          <div className={styles.progressStats}>
            <div className={styles.stat}><span className={styles.statLabel}>현재 페이지</span><span className={styles.statValue}>{fmt(status.currentPage)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>저장 완료</span><span className={styles.statValue}>{fmt(status.savedCount)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>전체 건수</span><span className={styles.statValue}>{status.totalCount > 0 ? fmt(status.totalCount) : '-'}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>진행률</span><span className={styles.statValue}>{status.totalCount > 0 ? `${pct}%` : '집계 중'}</span></div>
          </div>
          {status.totalCount > 0 && (
            <div className={styles.barWrap}>
              <div className={styles.bar} style={{ width: `${pct}%` }}>
                <span className={styles.progressLabel}>
                  {typeof pct === 'number' ? pct.toFixed(1) : pct}%
                  {pct >= 5 && status.etaSeconds > 0
                    ? ` · ${fmtEta(status.etaSeconds)}`
                    : ' · 계산 중...'}
                </span>
              </div>
              <span className={styles.barLabel}>{fmt(status.savedCount)} / {fmt(status.totalCount)}건</span>
            </div>
          )}
          {status.startedAt && <div className={styles.startedAt}>시작 시각: {fmtDate(status.startedAt)}</div>}
          {status.elapsedSeconds > 0 && (
            <div className={styles.startedAt}>
              경과: {fmtDuration(status.elapsedSeconds)}
            </div>
          )}
        </div>
      )}

      {/* 완료/중단 결과 */}
      {(status?.status === 'DONE' || status?.status === 'STOPPED') && (
        <div className={status.status === 'STOPPED' ? styles.stoppedBox : styles.resultBox}>
          <h3>{status.status === 'STOPPED' ? '⏹ 수집 중단됨' : '✅ 수집 완료'}</h3>
          <ul>
            <li>저장 건수: <strong>{fmt(status.savedCount)}</strong></li>
            {status.totalCount > 0 && <li>전체 건수: <strong>{fmt(status.totalCount)}</strong></li>}
            {status.currentPage > 0 && <li>마지막 페이지: <strong>{status.currentPage}</strong></li>}
          </ul>
          {status.status === 'STOPPED' && (
            <button className={styles.btnResume} onClick={handleResume}>↩ 이어서 수집</button>
          )}
        </div>
      )}

      <div className={styles.divider} />

      {/* 단일 페이지 수집 */}
      <div className={styles.section}>
        <h2>OpenAPI 단일 페이지 수집</h2>
        <p>특정 페이지(100건)만 수집합니다. 테스트 용도로 사용하세요.</p>
        <div className={styles.row}>
          <input className={styles.input} type="number" min="1" placeholder="페이지 번호 (예: 1)"
            value={pageInput} onChange={(e) => setPageInput(e.target.value)} />
          <button className={styles.btnSecondary} onClick={handlePageCollect} disabled={pageLoading}>
            {pageLoading ? '수집 중...' : '수집'}
          </button>
        </div>
        {pageResult && (
          <div className={`${styles.resultBox} ${styles.inlineResult}`}>
            <strong>완료</strong> — {fmt(pageResult.savedCount)}건 저장 (전체 {fmt(pageResult.totalCount)}건)
          </div>
        )}
        {pageError && <div className={styles.errorBox}>{pageError}</div>}
      </div>

      <div className={styles.divider} />

      {/* 수집 이력 (DB) */}
      <div className={styles.section}>
        <div className={styles.historyHeader}>
          <h2>수집 이력</h2>
          <button className={styles.btnRefresh} onClick={fetchHistory}>새로고침</button>
        </div>
        {history.length === 0 ? (
          <p className={styles.noHistoryMsg}>수집 이력이 없습니다.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.historyTable}>
              <thead>
                <tr><th>유형</th><th>상태</th><th>저장 건수</th><th>전체 건수</th><th>소요 시간</th><th>완료 시각</th></tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id}>
                    <td>{TYPE_LABELS[log.sourceType] ?? log.sourceType}</td>
                    <td>
                      <span className={`${styles.statusTag} ${log.status === 'DONE' ? styles.tagDone : styles.tagStopped}`}>
                        {log.status === 'DONE' ? '완료' : '중단'}
                      </span>
                    </td>
                    <td className={styles.num}>{fmt(log.totalSaved)}</td>
                    <td className={styles.num}>{fmt(log.totalCount)}</td>
                    <td>{fmtDuration(log.durationSecs)}</td>
                    <td>{fmtDate(log.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* DDL 전체 생성 */}
      <div className={styles.section}>
        <h2>DDL 전체 생성</h2>
        <p>수집된 모든 오퍼레이션의 응답 파라미터를 분석하여 테이블 DDL을 생성합니다.<br/>
           약 12,000개 오퍼레이션 처리로 수 분이 소요되며 백그라운드에서 실행됩니다.</p>
        <button className={styles.btnCollect} onClick={handleGenerateDdl}>
          DDL 전체 생성
        </button>
      </div>
    </div>
  )
}
