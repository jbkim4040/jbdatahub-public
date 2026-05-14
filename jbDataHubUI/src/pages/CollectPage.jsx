import { useState } from 'react'
import {
  collectAll, collectPage,
  collectDataset, collectFileData, collectStandardData,
  stopCollect,
} from '../api/publicApi'
import styles from './CollectPage.module.css'

const COLLECT_TYPES = [
  {
    key: 'openapi',
    label: 'OpenAPI 목록',
    desc: '공공데이터포털 오픈API 서비스 목록 전체를 수집합니다.',
    fn: collectAll,
  },
  {
    key: 'dataset',
    label: '데이터셋',
    desc: '공공데이터포털 데이터셋 목록 전체를 수집합니다.',
    fn: collectDataset,
  },
  {
    key: 'file-data',
    label: '파일데이터',
    desc: '공공데이터포털 파일데이터 목록 전체를 수집합니다.',
    fn: collectFileData,
  },
  {
    key: 'standard-data',
    label: '표준데이터',
    desc: '공공데이터포털 표준데이터 목록 전체를 수집합니다.',
    fn: collectStandardData,
  },
]

export default function CollectPage() {
  const [pageInput, setPageInput]   = useState('')
  const [activeKey, setActiveKey]   = useState(null)  // 현재 수집 중인 타입 키
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [stopping, setStopping]     = useState(false)

  const loading = activeKey !== null

  const execute = async (key, fn) => {
    setActiveKey(key)
    setResult(null)
    setError(null)
    setStopping(false)
    try {
      const res = await fn()
      setResult({ ...res.data, key })
    } catch (e) {
      const msg = e.response?.status === 403
        ? '관리자 권한이 없습니다.'
        : (e.response?.data?.message ?? e.message ?? '오류가 발생했습니다.')
      setError(msg)
    } finally {
      setActiveKey(null)
      setStopping(false)
    }
  }

  const handleStop = async () => {
    setStopping(true)
    try {
      await stopCollect()
    } catch {
      // 중지 요청 자체가 실패해도 UI는 그대로 유지
    }
  }

  const statusLabel = (key) => {
    if (activeKey === key) return stopping ? '중지 요청 중...' : '수집 중...'
    return '전체 수집 시작'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>데이터 수집</h1>
        <span className={styles.adminBadge}>🔒 관리자 전용</span>
      </div>
      <p className={styles.desc}>
        공공데이터포털 외부 API에서 데이터를 수집하여 DB에 저장합니다.
      </p>

      {/* 수집 타입 카드 */}
      <div className={styles.grid}>
        {COLLECT_TYPES.map(({ key, label, desc, fn }) => (
          <div key={key} className={styles.card}>
            <div className={styles.cardLabel}>{label}</div>
            <p className={styles.cardDesc}>{desc}</p>
            <button
              className={styles.btnPrimary}
              onClick={() => execute(key, fn)}
              disabled={loading}
            >
              {statusLabel(key)}
            </button>
          </div>
        ))}
      </div>

      <div className={styles.divider} />

      {/* 단일 페이지 수집 */}
      <div className={styles.section}>
        <h2>OpenAPI 단일 페이지 수집</h2>
        <p>특정 페이지(100건)만 수집합니다. 테스트 용도로 사용하세요.</p>
        <div className={styles.row}>
          <input
            className={styles.input}
            type="number" min="1"
            placeholder="페이지 번호 (예: 1)"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
          />
          <button
            className={styles.btnSecondary}
            onClick={() => {
              const p = parseInt(pageInput)
              if (!p || p < 1) return alert('1 이상의 페이지 번호를 입력하세요.')
              execute('page', () => collectPage(p))
            }}
            disabled={loading}
          >
            {activeKey === 'page' ? '수집 중...' : '수집'}
          </button>
        </div>
      </div>

      {/* 수집 중 상태 */}
      {loading && (
        <div className={styles.status}>
          <span className={styles.spinner} />
          <span>수집 중입니다. 잠시 기다려주세요...</span>
          <button
            className={styles.btnStop}
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? '중지 요청 중...' : '⏹ 수집 중지'}
          </button>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className={result.status === 'stopped' ? styles.stoppedBox : styles.resultBox}>
          <h3>
            {result.status === 'stopped' ? '⏹ 수집 중단됨' : '✅ 수집 완료'}
          </h3>
          <ul>
            {result.page > 0 && <li>마지막 페이지: <strong>{result.page}</strong></li>}
            {result.totalCount > 0 && <li>전체 건수: <strong>{result.totalCount.toLocaleString()}</strong></li>}
            <li>저장 건수: <strong>{result.savedCount?.toLocaleString()}</strong></li>
            {result.message && <li>메시지: {result.message}</li>}
          </ul>
        </div>
      )}

      {error && <div className={styles.errorBox}>❌ {error}</div>}
    </div>
  )
}
