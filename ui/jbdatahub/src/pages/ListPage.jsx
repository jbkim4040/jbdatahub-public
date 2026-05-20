import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getList, getDataItems, getApiDetail,
  getSimilar, getDataItemSimilar, getTopics, getTopicList,
  getEmbedProgress, getRelatedTerms
} from '../api/publicApi'
import styles from './ListPage.module.css'
import RelatedDatasets from '../components/RelatedDatasets'

const TABS = [
  { key: 'openapi', label: 'OpenAPI' },
  { key: 'file',    label: '파일' },
]

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
function OpenApiTab() {
  const [data, setData]           = useState(null)
  const [search, setSearch]       = useState('')
  const [subscribedMap, setSubscribedMap]   = useState({})  // list_id → status
  const [embedProgress, setEmbedProgress]   = useState(null)  // {done,total,percent,topics,similarPairs}
  const [pendingApplies, setPendingApplies] = useState([])  // [{listId,listTitle}] — 신청 모달 닫힌 뒤 대기
  const [applyRow, setApplyRow] = useState(null)  // 현재 활용신청 모달에 띄운 row (null이면 닫힘)

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
  const [relatedTerms, setRelatedTerms] = useState([])
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
    if (search && search.trim()) {
      getRelatedTerms(search.trim()).then(r => setRelatedTerms(r.data || [])).catch(() => setRelatedTerms([]))
    } else {
      setRelatedTerms([])
    }
  }
  const handleReset = () => {
    setSearch(''); setQuery(''); setSelectedTopic(null); setRelatedTerms([])
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


  return (
    <>
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

      {pendingApplies.length > 0 && (
        <div style={{
          padding: '12px 16px', marginBottom: 12,
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>📝 활용신청 진행 중</div>
          <div style={{ color: '#78350f', marginBottom: 8, fontSize: 12 }}>
            모달에서 신청을 완료한 뒤 아래 "신청 완료" 버튼을 눌러주세요.
          </div>
          {pendingApplies.map(p => (
            <div key={p.listId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderTop: '1px solid #fde68a',
            }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.listTitle}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={async () => {
                    try {
                      const { markManualSubscription } = await import('../api/publicApi')
                      await markManualSubscription(p.listId)
                      setSubscribedMap(prev => ({ ...prev, [p.listId]: 'MANUAL_REGISTERED' }))
                      setPendingApplies(prev => prev.filter(x => x.listId !== p.listId))
                      window.toast?.success('신청 등록 완료')
                    } catch (err) {
                      const detail = err?.response?.data?.detail || err?.response?.data?.error || err.message
                      window.toast?.error('등록 실패: ' + String(detail).slice(0, 200))
                    }
                  }}
                  style={{ padding: '4px 10px', fontSize: 12, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  신청 완료
                </button>
                <button
                  onClick={() => setPendingApplies(prev => prev.filter(x => x.listId !== p.listId))}
                  style={{ padding: '4px 10px', fontSize: 12, background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 검색 */}
      <RelatedDatasets query={query} onSelect={(it) => { setSearch(it.listTitle); setQuery(it.listTitle); loadList(0, it.listTitle, sort, null) }} />
      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input className={styles.searchInput} placeholder="목록명 검색... (한/영/중 입력 가능)"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.btnSearch} type="submit">검색</button>
        {(query || selectedTopic !== null) && (
          <button className={styles.btnReset} type="button" onClick={handleReset}>초기화</button>
        )}
      </form>

      {relatedTerms.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '8px 0 4px' }}>
          <span style={{ fontSize: 12, color: '#64748b', marginRight: 2 }}>관련 검색어:</span>
          {relatedTerms.map(t => (
            <button
              key={t.term}
              type="button"
              onClick={() => {
                setSearch(t.term); setQuery(t.term); setSelectedTopic(null)
                loadList(0, t.term, sort, null)
                getRelatedTerms(t.term).then(r => setRelatedTerms(r.data || [])).catch(() => {})
              }}
              style={{
                padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                background: '#eff6ff', color: '#1d4ed8',
                border: '1px solid #bfdbfe', borderRadius: 12,
              }}>
              {t.term}
            </button>
          ))}
        </div>
      )}

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
                                // 활용신청 모달 (iframe) — 상세 페이지로 진입. 활용신청 직접 URL은 2026-05 deprecated
                                setApplyRow({ listId: row.listId, listTitle: row.listTitle })
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

      {/* 활용신청 iframe 모달 */}
      {applyRow && (
        <div
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(0,0,0,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
          onClick={() => setApplyRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width:'min(1180px, 96vw)', height:'min(880px, 94vh)',
              background:'#fff', borderRadius:10, overflow:'hidden',
              display:'flex', flexDirection:'column',
              boxShadow:'0 20px 50px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'10px 14px', borderBottom:'1px solid #e5e7eb',
              background:'#f8fafc', fontSize:13,
            }}>
              <span style={{fontWeight:600, color:'#0f172a', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                📝 활용신청 — {applyRow.listTitle}
              </span>
              <a
                href={`https://www.data.go.kr/data/${applyRow.listId}/openapi.do`}
                target="_blank" rel="noreferrer"
                style={{fontSize:12, color:'#2563eb', textDecoration:'none'}}>
                새 탭으로 열기 ↗
              </a>
              <button
                onClick={async () => {
                  try {
                    const { markManualSubscription } = await import('../api/publicApi')
                    await markManualSubscription(applyRow.listId)
                    setSubscribedMap(prev => ({ ...prev, [applyRow.listId]: 'MANUAL_REGISTERED' }))
                    setPendingApplies(prev => prev.filter(x => x.listId !== applyRow.listId))
                    setApplyRow(null)
                    window.toast?.success('신청 등록 완료')
                  } catch (err) {
                    const detail = err?.response?.data?.detail || err?.response?.data?.error || err.message
                    window.toast?.error('등록 실패: ' + String(detail).slice(0, 200))
                  }
                }}
                style={{
                  padding:'6px 14px', fontSize:12,
                  background:'#16a34a', color:'#fff',
                  border:'none', borderRadius:6, cursor:'pointer',
                }}>
                신청 완료
              </button>
              <button
                onClick={() => {
                  // 모달 닫기 — 상단 배너에 "완료/취소" 옵션이 그대로 남도록 pendingApplies 추가
                  setPendingApplies(prev =>
                    prev.some(x => x.listId === applyRow.listId)
                      ? prev
                      : [...prev, { listId: applyRow.listId, listTitle: applyRow.listTitle }]
                  )
                  setApplyRow(null)
                }}
                style={{
                  padding:'6px 12px', fontSize:12,
                  background:'#e5e7eb', color:'#374151',
                  border:'none', borderRadius:6, cursor:'pointer',
                }}>
                나중에
              </button>
              <button
                onClick={() => setApplyRow(null)}
                style={{
                  padding:'4px 10px', fontSize:16, lineHeight:1,
                  background:'transparent', color:'#64748b',
                  border:'none', cursor:'pointer',
                }}>
                ✕
              </button>
            </div>
            <iframe
              src={`https://www.data.go.kr/data/${applyRow.listId}/openapi.do`}
              title={`활용신청 - ${applyRow.listTitle}`}
              style={{flex:1, width:'100%', border:'none'}}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </>
  )
}

/* ── 파일 데이터 탭 — 파일 형식 ext 필터 + 유사도 ── */
const FILE_FORMAT_OPTIONS = [
  { value: '',                            label: '전체' },
  { value: 'csv',                         label: 'CSV' },
  { value: 'xlsx,xls',                    label: 'Excel (xlsx, xls)' },
  { value: 'json,JSON,JSON+XML',          label: 'JSON' },
  { value: 'xml,XML',                     label: 'XML' },
  { value: 'pdf',                         label: 'PDF' },
  { value: 'hwp,hwpx',                    label: '한글 (hwp/hwpx)' },
  { value: 'docx,doc,odt',                label: '워드 (docx/doc/odt)' },
  { value: 'pptx',                        label: '파워포인트' },
  { value: 'txt,TEXT',                    label: '텍스트 (txt)' },
  { value: 'jpg,jpeg,png,gif,tiff',       label: '이미지' },
  { value: 'mp4,mp3',                     label: '미디어' },
  { value: 'zip,7z',                      label: '압축' },
]
function DataItemTab() {
  const [extFilter, setExtFilter] = useState('')
  const [data, setData]           = useState(null)
  const [search, setSearch]       = useState('')
  const [query, setQuery]         = useState('')
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(false)
  const [sort, setSort]           = useState({ field: null, dir: null })
  const [selectedItem, setSelectedItem]   = useState(null)   // 유사도 모달 대상
  const [similar, setSimilar]             = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)

  const scrollRef = useRef(0)
  const loadItems = useCallback(async (p = 0, q = query, s = sort) => {
    scrollRef.current = window.scrollY
    setLoading(true)
    try {
      const res = await getDataItems(extFilter, p, 20, q, s.field, s.dir)
      setData(res.data)
      setPage(p)
      requestAnimationFrame(() => window.scrollTo(0, scrollRef.current))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [extFilter, query, sort])

  useEffect(() => {
    setSearch(''); setQuery(''); setSort({ field: null, dir: null })
    loadItems(0, '')
  }, [extFilter])

  useEffect(() => { loadItems(0, query, sort) }, [sort])

  const handleSearch = (e) => { e.preventDefault(); setQuery(search); loadItems(0, search, sort) }
  const handleReset  = () => { setSearch(''); setQuery(''); loadItems(0, '', sort) }
  const handleSort   = (newSort) => setSort(newSort)

  const handleRowClick = async (row) => {
    setSelectedItem(row)
    setSimilar([])
    setSimilarLoading(true)
    try {
      const res = await getDataItemSimilar(row.id)
      setSimilar(res.data || [])
    } catch (e) { console.error(e) }
    finally { setSimilarLoading(false) }
  }

  return (
    <>
      {/* 파일 형식 필터 */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: '#475569', marginRight: 8 }}>형식:</label>
        <select
          value={extFilter}
          onChange={(e) => { setExtFilter(e.target.value); setSearch(''); setQuery(''); }}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6 }}
        >
          {FILE_FORMAT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

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
                    <tr key={row.id} className={styles.clickableRow} onClick={() => handleRowClick(row)} title="클릭하여 유사 데이터 보기">
                      <td className={styles.titleCell} title={row.title}>{row.title}</td>
                      <td>{row.orgNm}</td>
                      <td>{row.newCategoryNm || row.categoryNm}</td>
                      <td>{row.ext || row.dataType || '-'}</td>
                      <td>{row.updateCycle || '-'}</td>
                      <td className={styles.num}>{row.viewCnt?.toLocaleString() ?? '-'}</td>
                      <td className={styles.num}>{row.downloadCnt?.toLocaleString() ?? '-'}</td>
                      <td>{row.updatedAt ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
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

      {/* 유사 데이터 모달 */}
      {selectedItem && (
        <div className={styles.detailOverlay} onClick={() => setSelectedItem(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailTitle}>{selectedItem.title}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedItem(null)}>✕</button>
            </div>
            <div className={styles.detailMeta}>
              <span>🏢 {selectedItem.orgNm}</span>
              <span>📂 {selectedItem.newCategoryNm || selectedItem.categoryNm}</span>
              <span>📄 {selectedItem.ext || selectedItem.dataType || '-'}</span>
              {selectedItem.updatedAt && <span>📅 {selectedItem.updatedAt}</span>}
            </div>
            {selectedItem.pageUrl && (
              <p><a href={selectedItem.pageUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>원본 페이지 바로가기 ↗</a></p>
            )}

            <h3 className={styles.sectionTitle}>유사 데이터</h3>
            {similarLoading && <p className={styles.noDdl}>불러오는 중...</p>}
            {!similarLoading && similar.length === 0 && (
              <p className={styles.noDdl}>유사 데이터를 찾지 못했습니다. (임베딩 배치 진행 중일 수 있음)</p>
            )}
            {similar.length > 0 && (
              <div className={styles.similarList}>
                {similar.map(s => (
                  <div key={s.id} className={styles.similarItem}
                    onClick={() => handleRowClick(s)}
                    title="클릭하여 유사 데이터 보기">
                    <span className={styles.similarTitle}>{s.title}</span>
                    <span className={styles.similarMeta}>
                      {s.orgNm} · {s.newCategoryNm || s.categoryNm} · {s.ext || s.dataType || '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ── 메인 ── */
export default function ListPage() {
  const [activeTab, setActiveTab] = useState('openapi')

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
        ? <OpenApiTab />
        : <DataItemTab key={activeTab} />
      }
    </div>
  )
}

