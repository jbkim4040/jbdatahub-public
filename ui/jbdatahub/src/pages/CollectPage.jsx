import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collectAll, collectPage,
  collectDataset, collectFileData, collectStandardData,
  stopCollect, getCollectStatus, getCollectHistory,
  generateAllDdl, resumeCollect,
} from '../api/publicApi'
import { useI18n } from '../context/I18nContext'
import styles from './CollectPage.module.css'

const TYPES = [
  { key: 'openapi',        labelKey: 'collect.type.openapi',      fn: collectAll },
  { key: 'dataset',        labelKey: 'collect.type.dataset',      fn: collectDataset },
  { key: 'file-data',      labelKey: 'collect.type.fileData',     fn: collectFileData },
  { key: 'standard-data',  labelKey: 'collect.type.standardData', fn: collectStandardData },
]

const TYPE_LABEL_KEYS = {
  openapi: 'collect.type.openapi',
  dataset: 'collect.type.dataset',
  'file-data': 'collect.type.fileData',
  'standard-data': 'collect.type.standardData',
}

const fmt = (n) => n?.toLocaleString() ?? '-'
const fmtDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const fmtDuration = (secs, t) => {
  if (!secs) return '-'
  if (secs < 60) return `${secs}${t('unit.sec')}`
  const m = Math.floor(secs / 60), s = secs % 60
  return s > 0 ? `${m}${t('unit.min')} ${s}${t('unit.sec')}` : `${m}${t('unit.min')}`
}

export default function CollectPage() {
  const { t } = useI18n()
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
      if (code === 409) setStartError(t('collect.err.running'))
      else if (code === 403) setStartError(t('collect.err.noPermission'))
      else setStartError(e.response?.data?.message ?? t('collect.err.startFail'))
    }
  }

  const handleStop = async () => { setStopping(true); try { await stopCollect() } catch { /* ignore */ } }

  const handleResume = async () => {
    setStartError(null)
    try {
      await resumeCollect(); await fetchStatus(); startPolling()
    } catch (e) {
      const code = e.response?.status
      if (code === 409) setStartError(t('collect.err.running'))
      else setStartError(e.response?.data?.message ?? t('collect.err.resumeFail'))
    }
  }

  const handlePageCollect = async () => {
    const p = parseInt(pageInput)
    if (!p || p < 1) return alert(t('collect.pageInvalidAlert'))
    setPageLoading(true); setPageResult(null); setPageError(null)
    try { const res = await collectPage(p); setPageResult(res.data) }
    catch (e) { setPageError(e.response?.data?.message ?? t('collect.error.generic')) }
    finally { setPageLoading(false) }
  }

  const handleGenerateDdl = async () => {
    setDdlLoading(true); setDdlMsg(null)
    try {
      await generateAllDdl()
      setDdlMsg({ type: 'ok', text: t('collect.ddl.ok') })
    } catch (e) {
      setDdlMsg({ type: 'err', text: e.response?.data?.message ?? t('collect.ddl.fail') })
    } finally {
      setDdlLoading(false)
    }
  }

  const isRunning  = status?.status === 'RUNNING'
  const pct        = status?.progressPct ?? 0
  const memHistory = status?.history ?? {}

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('collect.title')}</h1>
        <span className={styles.adminBadge}>{t('collect.adminOnly')}</span>
      </div>
      <p className={styles.desc}>{t('collect.desc')}</p>

      {/* 수집 타입 카드 */}
      <div className={styles.grid}>
        {TYPES.map(({ key, labelKey, fn }) => {
          const h = memHistory[key]
          const active = isRunning && status?.sourceType === key
          return (
            <div key={key} className={`${styles.card} ${active ? styles.cardActive : ''}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>{t(labelKey)}</span>
                {active && <span className={styles.spinner} />}
              </div>

              {active ? (
                <div className={styles.cardProgress}>
                  <div className={styles.cardProgressStats}>
                    <span className={styles.cardSaved}>{fmt(status.savedCount)}{t('collect.savedSuffix')}</span>
                    {status.totalCount > 0
                      ? <span className={styles.cardPct}>{pct}%</span>
                      : <span className={styles.cardPage}>p.{status.currentPage}</span>
                    }
                  </div>
                  <div className={styles.cardBarWrap}>
                    <div
                      className={styles.cardBar}
                      style={{ width: status.totalCount > 0 ? `${pct}%` : '100%', opacity: status.totalCount > 0 ? 1 : 0.4 }}
                    />
                  </div>
                  {status.totalCount > 0 && (
                    <div className={styles.cardTotal}>{fmt(status.savedCount)} / {fmt(status.totalCount)}{t('collect.countSuffix')}</div>
                  )}
                  <button className={styles.btnStopInline} onClick={handleStop} disabled={stopping}>
                    {stopping ? t('collect.stopping') : t('collect.stop')}
                  </button>
                </div>
              ) : h ? (
                <div className={styles.lastInfo}>
                  <span className={styles.lastDate}>🕐 {fmtDate(h.lastCompletedAt)}</span>
                  <span className={styles.lastCount}>{fmt(h.lastSavedCount)}{t('collect.savedSuffix')}</span>
                </div>
              ) : (
                <div className={styles.noHistory}>{t('collect.noHistory')}</div>
              )}

              <button className={styles.btnStart} onClick={() => handleCollect(fn)} disabled={isRunning}>
                {active ? t('collect.collecting') : t('collect.start')}
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
              {(TYPES.find(ty => ty.key === status.sourceType)
                ? t(TYPES.find(ty => ty.key === status.sourceType).labelKey)
                : status.sourceType)} {t('collect.progress.collecting')}
            </span>
            <button className={styles.btnStop} onClick={handleStop} disabled={stopping}>
              {stopping ? t('collect.stopRequesting') : t('collect.stopCollect')}
            </button>
          </div>
          <div className={styles.progressStats}>
            <div className={styles.stat}><span className={styles.statLabel}>{t('collect.currentPage')}</span><span className={styles.statValue}>{fmt(status.currentPage)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>{t('collect.savedDone')}</span><span className={styles.statValue}>{fmt(status.savedCount)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>{t('collect.totalCount')}</span><span className={styles.statValue}>{status.totalCount > 0 ? fmt(status.totalCount) : '-'}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>{t('collect.progressPct')}</span><span className={styles.statValue}>{status.totalCount > 0 ? `${pct}%` : t('collect.aggregating')}</span></div>
            {status.elapsedSeconds != null && (
              <div className={styles.stat}><span className={styles.statLabel}>{t('collect.elapsed')}</span><span className={styles.statValue}>{fmtDuration(status.elapsedSeconds, t)}</span></div>
            )}
            {status.etaSeconds != null && (
              <div className={styles.stat}><span className={styles.statLabel}>{t('collect.eta')}</span><span className={styles.statValue}>{fmtDuration(status.etaSeconds, t)}</span></div>
            )}
          </div>
          {status.totalCount > 0 && (
            <div className={styles.barWrap}>
              <div className={styles.bar} style={{ width: `${pct}%` }} />
              <span className={styles.barLabel}>{fmt(status.savedCount)} / {fmt(status.totalCount)}{t('collect.countSuffix')}</span>
            </div>
          )}
          {status.startedAt && <div className={styles.startedAt}>{t('collect.startedAt')}{fmtDate(status.startedAt)}</div>}
        </div>
      )}

      {/* 완료/중단 결과 */}
      {(status?.status === 'DONE' || status?.status === 'STOPPED') && (
        <div className={status.status === 'STOPPED' ? styles.stoppedBox : styles.resultBox}>
          <h3>{status.status === 'STOPPED' ? t('collect.stopped') : t('collect.done')}</h3>
          <ul>
            <li>{t('collect.savedCount')}<strong>{fmt(status.savedCount)}</strong></li>
            {status.totalCount > 0 && <li>{t('collect.totalCount')}: <strong>{fmt(status.totalCount)}</strong></li>}
            {status.currentPage > 0 && <li>{t('collect.lastPage')}<strong>{status.currentPage}</strong></li>}
          </ul>
          {status.status === 'STOPPED' && (
            <button className={styles.btnResume} onClick={handleResume} disabled={isRunning}>
              {t('collect.resume')}
            </button>
          )}
        </div>
      )}

      <div className={styles.divider} />

      {/* 단일 페이지 수집 */}
      <div className={styles.section}>
        <h2>{t('collect.singlePage.title')}</h2>
        <p>{t('collect.singlePage.desc')}</p>
        <div className={styles.row}>
          <input className={styles.input} type="number" min="1" placeholder={t('collect.pagePlaceholder')}
            value={pageInput} onChange={(e) => setPageInput(e.target.value)} />
          <button className={styles.btnSecondary} onClick={handlePageCollect} disabled={pageLoading}>
            {pageLoading ? t('collect.collecting') : t('common.search')}
          </button>
        </div>
        {pageResult && (
          <div className={`${styles.resultBox} ${styles.inlineResult}`}>
            <strong>{t('collect.doneShort')}</strong> — {fmt(pageResult.savedCount)}{t('collect.savedSuffix')} ({t('collect.totalCount')} {fmt(pageResult.totalCount)}{t('collect.countSuffix')})
          </div>
        )}
        {pageError && <div className={styles.errorBox}>{pageError}</div>}
      </div>

      <div className={styles.divider} />

      {/* DDL 전체 생성 */}
      <div className={styles.section}>
        <h2>{t('collect.ddl.title')}</h2>
        <p>{t('collect.ddl.desc')}</p>
        <button className={styles.btnDdl} onClick={handleGenerateDdl} disabled={ddlLoading || isRunning}>
          {ddlLoading ? t('collect.ddl.requesting') : t('collect.ddl.btn')}
        </button>
        {ddlMsg && (
          <div className={`${styles.inlineResult} ${ddlMsg.type === 'ok' ? styles.resultBox : styles.errorBox}`}>
            {ddlMsg.text}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* 수집 이력 (DB) */}
      <div className={styles.section}>
        <div className={styles.historyHeader}>
          <h2>{t('collect.history.title')}</h2>
          <button className={styles.btnRefresh} onClick={fetchHistory}>{t('collect.refresh')}</button>
        </div>
        {history.length === 0 ? (
          <p className={styles.noHistoryMsg}>{t('collect.history.empty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.historyTable}>
              <thead>
                <tr><th>{t('collect.col.type')}</th><th>{t('collect.col.status')}</th><th>{t('collect.col.saved')}</th><th>{t('collect.col.total')}</th><th>{t('collect.col.duration')}</th><th>{t('collect.col.completedAt')}</th></tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id}>
                    <td>{TYPE_LABEL_KEYS[log.sourceType] ? t(TYPE_LABEL_KEYS[log.sourceType]) : log.sourceType}</td>
                    <td>
                      <span className={`${styles.statusTag} ${log.status === 'DONE' ? styles.tagDone : styles.tagStopped}`}>
                        {log.status === 'DONE' ? t('collect.status.done') : t('collect.status.stopped')}
                      </span>
                    </td>
                    <td className={styles.num}>{fmt(log.totalSaved)}</td>
                    <td className={styles.num}>{fmt(log.totalCount)}</td>
                    <td>{fmtDuration(log.durationSecs, t)}</td>
                    <td>{fmtDate(log.completedAt)}</td>
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
