import { useEffect, useState, useCallback } from 'react'
import { getList, getStats, getDataItems } from '../api/publicApi'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import styles from './ListPage.module.css'

const COLORS = ['#1e3a5f', '#3b7dd8', '#e67e22', '#27ae60', '#8e44ad',
                 '#2980b9', '#e74c3c', '#16a085', '#f39c12', '#7f8c8d']

const TABS = [
  { key: 'openapi',       label: 'OpenAPI' },
  { key: 'dataset',       label: '데이터셋' },
  { key: 'file-data',     label: '파일데이터' },
  { key: 'standard-data', label: '표준데이터' },
]

const SOURCE_TYPE_MAP = {
  dataset:        'dataset',
  'file-data':    'file-data',
  'standard-data':'standard-data',
}

/* ── OpenAPI 탭 ─────────────────────────────────────── */
function OpenApiTab({ stats }) {
  const [data, setData]       = useState(null)
  const [search, setSearch]   = useState('')
  const [query, setQuery]     = useState('')
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)

  const loadList = useCallback(async (p = 0, q = query) => {
    setLoading(true)
    try {
      const res = await getList(p, 20, q)
      setData(res.data)
      setPage(p)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [query])

  useEffect(() => { loadList(0, '') }, [])

  const handleSearch = (e) => { e.preventDefault(); setQuery(search); loadList(0, search) }
  const handleReset  = () => { setSearch(''); setQuery(''); loadList(0, '') }

  const categoryData = stats?.countByCategory ?? []
  const apiTypeData  = stats?.countByApiType
    ? Object.entries(stats.countByApiType).map(([name, count]) => ({ name, count }))
    : []

  return (
    <>
      {/* 통계 카드 */}
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

      {/* 차트 */}
      {stats && (
        <div className={styles.charts}>
          <div className={styles.chartBox}>
            <h3>분류별 건수 (상위 10개)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0}
                  angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => v.toLocaleString()} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartBox}>
            <h3>API 유형 비율</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={apiTypeData} dataKey="count" nameKey="name"
                  cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                  {apiTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => v.toLocaleString()} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 검색 */}
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input className={styles.searchInput} placeholder="목록명 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.btnSearch} type="submit">검색</button>
        {query && <button className={styles.btnReset} type="button" onClick={handleReset}>초기화</button>}
      </form>

      {/* 테이블 */}
      {loading ? <div className={styles.loading}>불러오는 중...</div> : data && (
        <>
          <p className={styles.resultInfo}>
            총 <strong>{data.totalElements.toLocaleString()}</strong>건
            {query && <> · 검색어: <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>목록ID</th><th>목록명</th><th>제공기관</th>
                  <th>분류</th><th>API유형</th><th>비용</th><th>활용수</th><th>수정일</th>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0
                  ? <tr><td colSpan={8} className={styles.empty}>검색 결과가 없습니다.</td></tr>
                  : data.content.map((row) => (
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
                  ))
                }
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <button onClick={() => loadList(0)} disabled={data.first}>«</button>
            <button onClick={() => loadList(page - 1)} disabled={data.first}>‹</button>
            <span>{page + 1} / {data.totalPages}</span>
            <button onClick={() => loadList(page + 1)} disabled={data.last}>›</button>
            <button onClick={() => loadList(data.totalPages - 1)} disabled={data.last}>»</button>
          </div>
        </>
      )}
    </>
  )
}

/* ── 데이터 유형 탭 (dataset / file-data / standard-data) ── */
function DataItemTab({ sourceType }) {
  const [data, setData]       = useState(null)
  const [search, setSearch]   = useState('')
  const [query, setQuery]     = useState('')
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)

  const loadItems = useCallback(async (p = 0, q = query) => {
    setLoading(true)
    try {
      const res = await getDataItems(sourceType, p, 20, q)
      setData(res.data)
      setPage(p)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [sourceType, query])

  useEffect(() => { setSearch(''); setQuery(''); loadItems(0, '') }, [sourceType])

  const handleSearch = (e) => { e.preventDefault(); setQuery(search); loadItems(0, search) }
  const handleReset  = () => { setSearch(''); setQuery(''); loadItems(0, '') }

  return (
    <>
      {/* 검색 */}
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input className={styles.searchInput} placeholder="제목 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.btnSearch} type="submit">검색</button>
        {query && <button className={styles.btnReset} type="button" onClick={handleReset}>초기화</button>}
      </form>

      {loading ? <div className={styles.loading}>불러오는 중...</div> : data && (
        <>
          <p className={styles.resultInfo}>
            총 <strong>{data.totalElements.toLocaleString()}</strong>건
            {query && <> · 검색어: <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>제목</th><th>제공기관</th><th>분류</th>
                  <th>형식</th><th>갱신주기</th><th>조회수</th><th>다운로드</th><th>수정일</th><th>링크</th>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0
                  ? <tr><td colSpan={9} className={styles.empty}>검색 결과가 없습니다.</td></tr>
                  : data.content.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.titleCell} title={row.title}>{row.title}</td>
                      <td>{row.orgNm}</td>
                      <td>{row.newCategoryNm || row.categoryNm}</td>
                      <td>{row.ext || row.dataType || '-'}</td>
                      <td>{row.updateCycle || '-'}</td>
                      <td className={styles.num}>{row.viewCnt?.toLocaleString() ?? '-'}</td>
                      <td className={styles.num}>{row.downloadCnt?.toLocaleString() ?? '-'}</td>
                      <td>{row.updatedAt ?? '-'}</td>
                      <td>
                        {row.pageUrl
                          ? <a href={row.pageUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>바로가기</a>
                          : '-'
                        }
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <button onClick={() => loadItems(0)} disabled={data.first}>«</button>
            <button onClick={() => loadItems(page - 1)} disabled={data.first}>‹</button>
            <span>{page + 1} / {data.totalPages}</span>
            <button onClick={() => loadItems(page + 1)} disabled={data.last}>›</button>
            <button onClick={() => loadItems(data.totalPages - 1)} disabled={data.last}>»</button>
          </div>
        </>
      )}
    </>
  )
}

/* ── 메인 ── */
export default function ListPage() {
  const [activeTab, setActiveTab] = useState('openapi')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(console.error)
  }, [])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>목록 조회</h1>

      {/* 탭 */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'openapi'
        ? <OpenApiTab stats={stats} />
        : <DataItemTab sourceType={SOURCE_TYPE_MAP[activeTab]} key={activeTab} />
      }
    </div>
  )
}
