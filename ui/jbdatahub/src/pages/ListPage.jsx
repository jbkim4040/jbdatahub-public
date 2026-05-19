import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getList, getStats, getDataItems, getDataItemStats, getApiDetail,
  getSimilar, getTopics, getTopicList,
  getEmbedProgress
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
  const [subscribedMap, setSubscribedMap]   = useState({})  // list_id → status
  const [embedProgress, setEmbedProgress]   = useState(null)  // {done,total,percent,topics,similarPairs}

  // 임베딩 배치 진행 상황 30초 폴링 (배치 완료까지)
  useEffect(() => {
    const fetchProgress = () => {
      getEmbedProgress().then(r => setEmbedProgress(r.data)).catch(() => {})
    }
    fetchProgress()
    const t = setInterval(fetchProgress, 30000)
    return () => clearInterval(t)
  }, [])

  // 사용자 신청 목록 로드 (등록 여부 표시용)
  useEffect(() => {
    let cancelled = false
    fetch('/api/public-data/my-subscriptions', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { if (!cancelled) {
        const m = {}; (d.items || []).forEach(it => { m[it.list_id] = it.status })
        setSubscribedMap(m)
      }})
      .catch(()=>{})
    return () => { cancelled = true }
  }, [])
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

  // 토픽 필터
  const [topics, setTopics]           = useState([])
  const [selectedTopic, setSelectedTopic] = useState(null)

  const scrollRef = useRef(0)

  // 토픽 목록 로드
  useEffect(() => {
    getTopics().then(r => setTopics(r.data)).catch(() => {})
  }, [])

  const loadList = useCallback(async (p = 0, q = query, s = sort, topicId = selectedTopic) => {
    scrollRef.current = window.scrollY
    setLoading(true)
    try {
      let res
      if (topicId !== null) {
        res = await getTopicList(topicId, p, 20)
      } else {
        res = await getList(p, 20, q, s.field, s.dir)
      }
      setData(res.data)
      setPage(p)
      requestAnimationFrame(() => window.scrollTo(0, scrollRef.current))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [query, sort, selectedTopic])

  useEffect(() => { loadList(0, '') }, [])
  useEffect(() => { loadList(0, query, sort) }, [sort])

  const handleSearch = (e) => {
    e.preventDefault()
    setSelectedTopic(null)
    setQuery(search)
    loadList(0, search, sort, null)
  }
  const handleReset = () => {
    setSearch(''); setQuery(''); setSelectedTopic(null)
    loadList(0, '', sort, null)
  }
  const handleSort   = (newSort) => { setSelectedTopic(null); setSort(newSort) }

  const handleTopicSelect = (topicId) => {
    const next = selectedTopic === topicId ? null : topicId
    setSelectedTopic(next)
    setSearch(''); setQuery('')
    loadList(0, '', sort, next)
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
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
      .then(() => console.log(`복사됨: ${label}`))
      .catch(() => {})
  }


  const categoryData = stats?.countByCategory ?? []
  const apiTypeData  = stats?.countByApiType
    ? Object.entries(stats.countByApiType).map(([name, count]) => ({ name, count }))
    : []

  const searchLabel = selectedTopic !== null ? `토픽 ${selectedTopic + 1}` : (query ? `"${query}"` : '전체')

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
      <RelatedDatasets query={query} onSelect={(it) => { setSearch(it.listTitle); setQuery(it.listTitle); loadList(0, it.listTitle, sort, null) }} />
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input className={styles.searchInput} placeholder="목록명 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.btnSearch} type="submit">검색</button>
        <button
          type="button"
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
            {query && selectedTopic === null && <> · '검색어': <em>"{query}"</em></>}
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
                  <th style={{width:90,textAlign:"center"}}>신청</th>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0
                  ? <tr><td colSpan={8} className={styles.empty}>검색 결과가 없습니다.</td></tr>
                  : data.content.map((row) => (
                    <tr key={row.listId} className={styles.clickableRow} onClick={() => handleRowClick(row)} title="클릭하여 상세 보기">
                      <td className={styles.mono} onClick={(e) => { e.stopPropagation(); copyToClipboard(row.listId, "listId"); }} title="클릭 시 복사" style={{cursor:"copy"}}>{row.listId}</td>
                      <td className={styles.titleCell} title="클릭 시 복사" onClick={(e) => { e.stopPropagation(); copyToClipboard(row.listTitle, "listTitle"); }} style={{cursor:"copy"}}>{row.listTitle}</td>
                      <td>{row.orgNm}</td>
                      <td>{row.newCategoryNm}</td>
                      <td><span className={`${styles.badge} ${styles[row.apiType?.toLowerCase()]}`}>{row.apiType}</span></td>
                      <td>{row.isCharged}</td>
                      <td className={styles.num}>{row.requestCnt?.toLocaleString()}</td>
                      <td>{row.updatedAt}</td>
                      <td style={{textAlign:"center"}} onClick={(e)=>e.stopPropagation()}>
                        {(() => {
                          const s = subscribedMap[row.listId]
                          if (s === 'APPROVED')          return <span style={{fontSize:11,color:'#15803d',fontWeight:600}}>🔑 승인</span>
                          if (s === 'SUBMITTED')         return <span style={{fontSize:11,color:'#2563eb',fontWeight:600}}>✓ 제출됨</span>
                          if (s === 'PENDING')           return <span style={{fontSize:11,color:'#92400e',fontWeight:600}}>⏳ 진행중</span>
                          if (s === 'MANUAL_REGISTERED') return <span style={{fontSize:11,color:'#6d28d9',fontWeight:600}} title="data.go.kr에서 직접 신청한 데이터셋">✓ 신청 완료</span>
                          return (
                            <button
                              style={{padding:'4px 10px',fontSize:11,background:'#2563eb',color:'#fff',border:'none',borderRadius:4,cursor:'pointer'}}
                              onClick={(e) => {
                                e.stopPropagation()
                                // data.go.kr 활용신청 팝업 — apiId(uddi) 있으면 활용신청 페이지 직접 진입
                                const apiId = row.apiId
                                const url = apiId
                                  ? `https://www.data.go.kr/iim/api/selectAcountAplyView.do?publicDataDetailPk=${encodeURIComponent(apiId)}`
                                  : `https://www.data.go.kr/data/${row.listId}/openapi.do`
                                const popup = window.open(url, `apply_${row.listId}`,
                                  'width=1100,height=800,scrollbars=yes,resizable=yes')
                                if (!popup) {
                                  // 팝업 차단 fallback — 새 탭
                                  window.toast?.warn('팝업이 차단되어 새 탭으로 엽니다')
                                  window.open(url, '_blank')
                                  return
                                }
                                const timer = setInterval(async () => {
                                  if (!popup.closed) return
                                  clearInterval(timer)
                                  if (!window.confirm('신청을 완료하셨나요? "확인"을 누르면 내 목록에 등록됩니다.')) return
                                  try {
                                    const { markManualSubscription } = await import('../api/publicApi')
                                    const res = await markManualSubscription(row.listId)
                                    const status = res?.data?.status || 'MANUAL_REGISTERED'
                                    setSubscribedMap(prev => ({...prev, [row.listId]: status}))
                                    window.toast?.success('신청 등록 완료 — 내 목록에서 확인 가능')
                                  } catch (err) {
                                    const detail = err?.response?.data?.detail || err?.response?.data?.error || err.message
                                    window.toast?.error('등록 실패: ' + String(detail).slice(0, 200))
                                  }
                                }, 1000)
                              }}>신청</button>
                          )
                        })()}
                      </td>
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

