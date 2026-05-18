import { useEffect, useState, useRef } from 'react'
import http from '../api/http'
import styles from './RelatedDatasets.module.css'

export default function RelatedDatasets({ query, onSelect }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setItems([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await http.get('/public-data/related', {
          params: { q: query.trim(), limit: 5 },
        })
        setItems(Array.isArray(data) ? data : [])
      } catch (e) {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  if (!query || query.trim().length < 2) return null

  return (
    <div className={styles.box}>
      <div className={styles.header}>
        <span className={styles.icon}>💡</span>
        <span className={styles.title}>"{query}" 관련 데이터셋</span>
        {loading && <span className={styles.loading}>검색중…</span>}
      </div>
      {!loading && items.length === 0 && (
        <div className={styles.empty}>관련 데이터셋이 없습니다.</div>
      )}
      <div className={styles.grid}>
        {items.map((it) => (
          <button
            key={it.listId}
            className={styles.card}
            onClick={() => onSelect && onSelect(it)}
            title={it.listTitle}
          >
            <div className={styles.cardTitle}>{it.listTitle || it.title}</div>
            <div className={styles.cardMeta}>
              <span>{it.orgNm}</span>
              {it.categoryNm && <span className={styles.dot}>·</span>}
              {it.categoryNm && <span>{it.categoryNm}</span>}
            </div>
            <div className={styles.cardScore}>
              유사도 {(it.score * 100).toFixed(0)}%
              {it.requestCnt != null && (
                <span className={styles.req}> · 신청 {it.requestCnt.toLocaleString()}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
