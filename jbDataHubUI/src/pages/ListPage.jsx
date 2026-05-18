import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getList, getStats, getDataItems, getDataItemStats, getApiDetail,
  semanticSearch, getSimilar, getTopics, getTopicList
} from '../api/publicApi'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import styles from './ListPage.module.css'
import RelatedDatasets from '../components/RelatedDatasets'

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

/* ── 정렬 헬퍼 ── */
const nextSort = (cur, field) => {
  if (cur.field !== field) return { field, dir: 'asc' }
  if (cur.dir === 'asc')   return { field, dir: 'desc' }
  return { field: null, dir: null }
}
function SortIcon({ field, sort }) {
  if (sort.field !== field) return <span className={styles.sortIdle}>↕</span>
  return <span className={styles.sortActive}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
}
function SortTh({ field, sort, onSort, children, className }) {
  return (
    <th className={`${className ?? ''} ${styles.sortable}`} onClick={() => onSort(nextSort(sort, field))}>
      {children} <SortIcon field={field} sort={sort} />
    </th>
  )
}

/* ── OpenAPI 탭 ─────────────────────────────────────── */
function OpenApiTab({ stats }) {
  const [data, setData]           = useState(null)
  const [search, setSearch]       = useState('')
  const [query, setQuery]         = useState('')
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(false)
  const [sort, setSort]           = useState({ field: null, dir: null })
  const [selectedApi, setSelectedApi]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [openedOps, setOpenedOps]         = useState(new Set())
  const [similar, setSimilar]             = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)

  // 의미 검색
  const [semanticMode, setSemanticMode] = useState(false)

  // 토픽 필터
  const [topics, setTopics]           = useState([])
  const [selectedTopic, setSelectedTopic] = useState(null)

  const scrollRef = useRef(0)

  // 토픽 목록 로드
  useEffect(() => {
    getTopics().then(r => setTopics(r.data)).catch(() => {})
  }, [])

  const loadList = useCallback(async (p = 0, q = query, s = sort, topicId = selectedTopic, semantic = semanticMode) => {
    scrollRef.current = window.scrollY
    setLoading(true)
    try {
      let res
      if (topicId !== null) {
        res = await getTopicList(topicId, p, 20)
      } else if (semantic && q) {
        res = await semanticSearch(q, p, 20)
      } else {
        res = await getList(p, 20, q, s.field, s.dir)
      }
      setData(res.data)
      setPage(p)
      requestAnimationFrame(() => window.scrollTo(0, scrollRef.current))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [query, sort, selectedTopic, semanticMode])

  useEffect(() => { loadList(0, '') }, [])
  useEffect(() => { loadList(0, query, sort) }, [sort])

  const handleSearch = (e) => {
    e.preventDefault()
    setSelectedTopic(null)
    setQuery(search)
    loadList(0, search, sort, null, semanticMode)
  }
  const handleReset = () => {
    setSearch(''); setQuery(''); setSelectedTopic(null); setSemanticMode(false)
    loadList(0, '', sort, null, false)
  }
  const handleSort   = (newSort) => { setSelectedTopic(null); setSort(newSort) }

  const handleTopicSelect = (topicId) => {
    const next = selectedTopic === topicId ? null : topicId
    setSelectedTopic(next)
    setSearch(''); setQuery('')
    loadList(0, '', sort, next, false)
  }

  const handleRowClick = async (row) => {
    setDetailLoading(true)
    setSelectedApi(null)
    setSimilar([])
    setOpenedOps(new Set())
    try {
      const res = await getApiDetail(row.listId)
      setSelectedApi(res.data)
      // 유사 API 로드
      setSimilarLoading(true)
      getSimilar(row.listId)
        .then(r => setSimilar(r.data))
        .catch(() => {})
        .finally(() => setSimilarLoading(false))
    } catch (e) { console.error(e) }
    finally { setDetailLoading(false) }
  }

  const toggleOp = (seq) => {
    setOpenedOps(prev => {
      const next = new Set(prev)
      if (next.has(seq)) { next.delete(seq) } else { next.add(seq) }
      return next
    })
  }

  const copyDdl = (text) => navigator.clipboard.writeText(text)

  const categoryData = stats?.countByCategory ?? []
  const apiTypeData  = stats?.countByApiType
    ? Object.entries(stats.countByApiType).map(([name, count]) => ({ name, count }))
    : []

  const searchLabel = semanticMode ? '의미검색 중...' : (selectedTopic !== null ? `토픽 ${selectedTopic + 1}` : (query ? `"${query}"` : '전체'))

  return (
    <>
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

      {/* 토픽 필터 */}
      {topics.length > 0 && (
        <div className={styles.topicRow}>
          <span className={styles.topicLabel}>토픽 필터</span>
          <div className={styles.topicChips}>
            {topics.slice(0, 12).map(t => (
              <button
                key={t.topicId}
                className={`${styles.topicChip} ${selectedTopic === t.topicId ? styles.topicChipActive : ''}`}
                onClick={() => handleTopicSelect(t.topicId)}
                title={t.topicKeywords}
              >
                {t.topicKeywords.split(', ').slice(0, 3).join(' · ')}
                <span className={styles.topicCount}>{t.itemCount}</span>
              </button>
            ))}
            {selectedTopic !== null && (
              <button className={styles.btnReset} onClick={handleReset}>전체 보기</button>
            )}
          </div>
        </div>
      )}

      {/* 검색 */}
      <RelatedDatasets query={query} onSelect={(it) => { setSearch(it.listTitle); setQuery(it.listTitle); loadList(0, it.listTitle, sort, null, semanticMode) }} />
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input className={styles.searchInput} placeholder="목록명 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.btnSearch} type="submit">검색</button>
        <button
          type="button"
          className={`${styles.btnSemantic} ${semanticMode ? styles.btnSemanticActive : ''}`}
          onClick={() => setSemanticMode(v => !v)}
          title="의미 기반 검색: 키워드가 없어도 의미적으로 유사한 결과를 찾습니다"
        >
          {semanticMode ? '의미검색 ON' : '의미검색'}
        </button>
        {(query || selectedTopic !== null) && (
          <button className={styles.btnReset} type="button" onClick={handleReset}>초기화</button>
        )}
      </form>

      {!data && loading && <div className={styles.loading}>불러오는 중...</div>}
      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity .15s' }}>
          <p className={styles.resultInfo}>
            총 <strong>{data.totalElements.toLocaleString()}</strong>건
            {selectedTopic !== null && topics.length > 0 && (
              <> · 토픽: <em>{topics.find(t => t.topicId === selectedTopic)?.topicKeywords?.split(', ').slice(0, 3).join(', ')}</em></>
            )}
            {query && selectedTopic === null && <> · {semanticMode ? '의미검색' : '검색어'}: <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>목록ID</th>
                  <SortTh field="listTitle" sort={sort} onSort={handleSort}>목록명</SortTh>
                  <SortTh field="orgNm" sort={sort} onSort={handleSort}>제공기관</SortTh>
                  <th>분류</th>
                  <th>API유형</th>
                  <SortTh field="isCharged" sort={sort} onSort={handleSort}>비용</SortTh>
                  <SortTh field="requestCnt" sort={sort} onSort={handleSort} className={styles.num}>활용수</SortTh>
                  <SortTh field="updatedAt" sort={sort} onSort={handleSort}>수정일</SortTh>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0
                  ? <tr><td colSpan={8} className={styles.empty}>검색 결과가 없습니다.</td></tr>
                  : data.content.map((row) => (
                    <tr key={row.listId} className={styles.clickableRow} onClick={() => handleRowClick(row)} title="클릭하여 상세 보기">
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
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {(detailLoading || selectedApi) && (
        <div className={styles.detailOverlay} onClick={() => setSelectedApi(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            {detailLoading && <div className={styles.detailLoading}>불러오는 중...</div>}
            {selectedApi && (
              <>
                <div className={styles.detailHeader}>
                  <h2 className={styles.detailTitle}>{selectedApi.listTitle}</h2>
                  <button className={styles.closeBtn} onClick={() => setSelectedApi(null)}>✕</button>
                </div>
                <div className={styles.detailMeta}>
                  <span>🏢 {selectedApi.orgNm}{selectedApi.deptNm ? ` / ${selectedApi.deptNm}` : ''}</span>
                  <span>📂 {selectedApi.newCategoryNm}</span>
                  <span>🔑 {selectedApi.listId}</span>
                  <span>{selectedApi.apiType}</span>
                  <span>{selectedApi.isCharged}</span>
                  {selectedApi.updatedAt && <span>📅 {selectedApi.updatedAt}</span>}
                </div>
                {selectedApi.description && (
                  <p className={styles.detailDesc}>{selectedApi.description}</p>
                )}

                {/* ── 유사 API ── */}
                <h3 className={styles.sectionTitle}>유사 API</h3>
                {similarLoading && <p className={styles.noDdl}>불러오는 중...</p>}
                {!similarLoading && similar.length === 0 && (
                  <p className={styles.noDdl}>유사 API 데이터가 없습니다. 임베딩 스크립트를 먼저 실행해 주세요.</p>
                )}
                {similar.length > 0 && (
                  <div className={styles.similarList}>
                    {similar.map(s => (
                      <div key={s.listId} className={styles.similarItem}
                        onClick={() => handleRowClick({ listId: s.listId })}
                        title="클릭하여 상세 보기">
                        <span className={styles.similarTitle}>{s.listTitle}</span>
                        <span className={styles.similarMeta}>{s.orgNm} · {s.categoryNm}</span>
                        <span className={styles.similarScore}>{(s.score * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className={styles.sectionTitle}>
                  오퍼레이션 ({selectedApi.operations?.length ?? 0}개)
                </h3>
                {selectedApi.operations?.length === 0 && (
                  <p className={styles.noDdl}>등록된 오퍼레이션이 없습니다.</p>
                )}
                {selectedApi.operations?.map(op => (
                  <div key={op.operationSeq} className={styles.opCard}>
                    <div className={styles.opHeader} onClick={() => toggleOp(op.operationSeq)}>
                      <span className={styles.opName}>{op.operationNm || '(이름 없음)'}</span>
                      <span className={styles.opUrl}>{op.operationUrl}</span>
                      {op.registerStatus && <span className={styles.opStatus}>{op.registerStatus}</span>}
                      <span className={styles.opToggle}>{openedOps.has(op.operationSeq) ? '▲' : '▼'}</span>
                    </div>
                    {openedOps.has(op.operationSeq) && (
                      op.generatedDdl ? (
                        <div className={styles.ddlWrap}>
                          <button className={styles.copyBtn} onClick={() => copyDdl(op.generatedDdl)}>복사</button>
                          <pre className={styles.ddlCode}>{op.generatedDdl}</pre>
                        </div>
                      ) : (
                        <p className={styles.noDdl}>DDL이 아직 생성되지 않았습니다. 관리자가 DDL 전체 생성을 실행해 주세요.</p>
                      )
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ── 데이터 유형 탭 (dataset / file-data / standard-data) ── */
function DataItemTab({ sourceType }) {
  const [data, setData]       = useState(null)
  const [stats, setStats]     = useState(null)
  const [search, setSearch]   = useState('')
  const [query, setQuery]     = useState('')
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [sort, setSort]       = useState({ field: null, dir: null })

  const scrollRef = useRef(0)
  const loadItems = useCallback(async (p = 0, q = query, s = sort) => {
    scrollRef.current = window.scrollY
    setLoading(true)
    try {
      const res = await getDataItems(sourceType, p, 20, q, s.field, s.dir)
      setData(res.data)
      setPage(p)
      requestAnimationFrame(() => window.scrollTo(0, scrollRef.current))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [sourceType, query, sort])

  useEffect(() => {
    setSearch(''); setQuery(''); setSort({ field: null, dir: null })
    loadItems(0, '')
    getDataItemStats(sourceType).then(r => setStats(r.data)).catch(() => {})
  }, [sourceType])

  useEffect(() => { loadItems(0, query, sort) }, [sort])

  const handleSearch = (e) => { e.preventDefault(); setQuery(search); loadItems(0, search, sort) }
  const handleReset  = () => { setSearch(''); setQuery(''); loadItems(0, '', sort) }
  const handleSort   = (newSort) => setSort(newSort)

  return (
    <>
      {/* 통계 카드 */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.totalCount.toLocaleString()}</div>
            <div className={styles.statLabel}>전체 건수</div>
          </div>
        </div>
      )}

      {/* 분류별 차트 */}
      {(stats?.countByCategory?.length > 0 || stats?.countByFormat?.length > 0) && (
        <div className={styles.charts}>
          {stats?.countByCategory?.length > 0 && (
            <div className={styles.chartBox}>
              <h3>분류별 건수 (상위 10개)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.countByCategory} margin={{ left: 0, right: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0}
                    angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.countByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {stats?.countByFormat?.length > 0 && (
            <div className={styles.chartBox}>
              <h3>형식 비율</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={stats.countByFormat} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                    {stats.countByFormat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 검색 */}
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input className={styles.searchInput} placeholder="제목 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.btnSearch} type="submit">검색</button>
        {query && <button className={styles.btnReset} type="button" onClick={handleReset}>초기화</button>}
      </form>

      {!data && loading && <div className={styles.loading}>불러오는 중...</div>}
      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity .15s' }}>
          <p className={styles.resultInfo}>
            총 <strong>{data.totalElements.toLocaleString()}</strong>건
            {query && <> · 검색어: <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh field="title" sort={sort} onSort={handleSort}>제목</SortTh>
                  <SortTh field="orgNm" sort={sort} onSort={handleSort}>제공기관</SortTh>
                  <th>분류</th>
                  <th>형식</th>
                  <th>갱신주기</th>
                  <SortTh field="viewCnt" sort={sort} onSort={handleSort} className={styles.num}>조회수</SortTh>
                  <SortTh field="downloadCnt" sort={sort} onSort={handleSort} className={styles.num}>다운로드</SortTh>
                  <SortTh field="updatedAt" sort={sort} onSort={handleSort}>수정일</SortTh>
                  <th>링크</th>
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
        </div>
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

      {activeTab === 'openapi'
        ? <OpenApiTab stats={stats} />
        : <DataItemTab sourceType={SOURCE_TYPE_MAP[activeTab]} key={activeTab} />
      }
    </div>
  )
}

