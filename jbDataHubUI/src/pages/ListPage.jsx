import { useEffect, useState, useCallback } from 'react'
import { getList, getStats } from '../api/publicApi'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import styles from './ListPage.module.css'

const COLORS = ['#1e3a5f', '#3b7dd8', '#e67e22', '#27ae60', '#8e44ad',
                 '#2980b9', '#e74c3c', '#16a085', '#f39c12', '#7f8c8d']

export default function ListPage() {
  const [stats, setStats]     = useState(null)
  const [data, setData]       = useState(null)
  const [search, setSearch]   = useState('')
  const [query, setQuery]     = useState('')
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)

  // 통계 로드 (최초 1회)
  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(console.error)
  }, [])

  // 목록 로드
  const loadList = useCallback(async (p = 0, q = query) => {
    setLoading(true)
    try {
      const res = await getList(p, 20, q)
      setData(res.data)
      setPage(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { loadList(0, '') }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setQuery(search)
    loadList(0, search)
  }

  const handleReset = () => {
    setSearch('')
    setQuery('')
    loadList(0, '')
  }

  // 통계용 데이터 변환
  const categoryData  = stats?.countByCategory ?? []
  const apiTypeData   = stats?.countByApiType
    ? Object.entries(stats.countByApiType).map(([name, count]) => ({ name, count }))
    : []

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>OpenAPI 목록 조회</h1>

      {/* ── 통계 카드 ── */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.totalCount.toLocaleString()}</div>
            <div className={styles.statLabel}>전체 서비스 수</div>
          </div>
          {apiTypeData.map(({ name, count }) => (
            <div key={name} className={styles.statCard}>
              <div className={styles.statNum}>{Number(count).toLocaleString()}</div>
              <div className={styles.statLabel}>{name || '미분류'}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 차트 ── */}
      {stats && (
        <div className={styles.charts}>
          {/* 카테고리 바차트 */}
          <div className={styles.chartBox}>
            <h3>분류별 건수 (상위 10개)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0}
                  angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => v.toLocaleString()} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* API 유형 파이차트 */}
          <div className={styles.chartBox}>
            <h3>API 유형 비율</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={apiTypeData} dataKey="count" nameKey="name"
                  cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(1)}%`}>
                  {apiTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => v.toLocaleString()} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 검색 ── */}
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          placeholder="목록명(list_title) 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={styles.btnSearch} type="submit">검색</button>
        {query && <button className={styles.btnReset} type="button" onClick={handleReset}>초기화</button>}
      </form>

      {/* ── 테이블 ── */}
      {loading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : data && (
        <>
          <p className={styles.resultInfo}>
            총 <strong>{data.totalElements.toLocaleString()}</strong>건
            {query && <> · 검색어: <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>목록ID</th>
                  <th>목록명</th>
                  <th>제공기관</th>
                  <th>분류</th>
                  <th>API유형</th>
                  <th>비용</th>
                  <th>활용수</th>
                  <th>수정일</th>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0 ? (
                  <tr><td colSpan={8} className={styles.empty}>검색 결과가 없습니다.</td></tr>
                ) : data.content.map((row) => (
                  <tr key={row.listId}>
                    <td className={styles.mono}>{row.listId}</td>
                    <td className={styles.titleCell} title={row.listTitle}>{row.listTitle}</td>
                    <td>{row.orgNm}</td>
                    <td>{row.newCategoryNm}</td>
                    <td><span className={`${styles.badge} ${styles[row.apiType?.toLowerCase()]}`}>{row.apiType}</span></td>
                    <td>{row.isCharged}</td>
                    <td className={styles.num}>{row.requestCnt?.toLocaleString()}</td>
                    <td>{row.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className={styles.pagination}>
            <button onClick={() => loadList(0)} disabled={data.first}>«</button>
            <button onClick={() => loadList(page - 1)} disabled={data.first}>‹</button>
            <span>{page + 1} / {data.totalPages}</span>
            <button onClick={() => loadList(page + 1)} disabled={data.last}>›</button>
            <button onClick={() => loadList(data.totalPages - 1)} disabled={data.last}>»</button>
          </div>
        </>
      )}
    </div>
  )
}
