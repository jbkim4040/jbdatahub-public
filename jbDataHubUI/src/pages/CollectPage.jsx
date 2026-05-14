import { useState } from 'react'
import { collectAll, collectPage } from '../api/publicApi'
import styles from './CollectPage.module.css'

export default function CollectPage() {
  const [pageInput, setPageInput] = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)

  const execute = async (fn) => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fn()
      setResult(res.data)
    } catch (e) {
      const msg = e.response?.status === 403
        ? '관리자 권한이 없습니다.'
        : (e.response?.data?.message ?? e.message ?? '오류가 발생했습니다.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>데이터 수집</h1>
        <span className={styles.adminBadge}>🔒 관리자 전용</span>
      </div>
      <p className={styles.desc}>외부 API(공공데이터포털)에서 OpenAPI 목록을 수집하여 DB에 저장합니다.</p>

      <div className={styles.section}>
        <h2>전체 수집</h2>
        <p>모든 페이지를 순회하며 전체 데이터를 수집합니다. 시간이 오래 걸릴 수 있습니다.</p>
        <button className={styles.btnPrimary} onClick={() => execute(collectAll)} disabled={loading}>
          {loading ? '수집 중...' : '전체 수집 시작'}
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h2>단일 페이지 수집</h2>
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
              execute(() => collectPage(p))
            }}
            disabled={loading}
          >
            {loading ? '수집 중...' : '수집'}
          </button>
        </div>
      </div>

      {loading && (
        <div className={styles.status}>
          <span className={styles.spinner} /> 수집 중입니다. 잠시 기다려주세요...
        </div>
      )}

      {result && (
        <div className={styles.resultBox}>
          <h3>✅ 수집 완료</h3>
          <ul>
            <li>상태: <strong>{result.status}</strong></li>
            {result.page > 0 && <li>최종 페이지: <strong>{result.page}</strong></li>}
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
