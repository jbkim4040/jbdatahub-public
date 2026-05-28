import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getList, getDataItems, getApiDetail,
  getSimilar, getDataItemSimilar, getTopics, getTopicList,
  getEmbedProgress, getRelatedTerms
} from '../api/publicApi'
import { useI18n } from '../context/I18nContext'
import styles from './ListPage.module.css'
import RelatedDatasets from '../components/RelatedDatasets'
import ApiInvokeConsole from '../components/ApiInvokeConsole'
import Pagination from '../components/Pagination'
import SearchBar from '../components/SearchBar'

const TABS = [
  { key: 'openapi', labelKey: 'list.tab.openapi' },
  { key: 'file',    labelKey: 'list.tab.file' },
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
  const { t } = useI18n()
  const [data, setData]           = useState(null)
  const [search, setSearch]       = useState('')
  const [subscribedMap, setSubscribedMap]   = useState({})  // list_id → status
  const [embedProgress, setEmbedProgress]   = useState(null)  // {done,total,percent,topics,similarPairs}
  const [invokeRow, setInvokeRow] = useState(null)  // API 호출 콘솔에 띄운 row

  // 임베딩 배치 진행 상황 30초 폴링 (배치 완료까지)
  useEffect(() => {
    const fetchProgress = () => {
      getEmbedProgress().then(r => setEmbedProgress(r.data)).catch(() => {})
    }
    fetchProgress()
    const timer = setInterval(fetchProgress, 30000)
    return () => clearInterval(timer)
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
          <span className={styles.topicLabel}>{t('list.topicFilter')}</span>
          <div className={styles.topicChips}>
            {topics.slice(0, 12).map(tp => (
              <button
                key={tp.topicId}
                className={`${styles.topicChip} ${selectedTopic === tp.topicId ? styles.topicChipActive : ''}`}
                onClick={() => handleTopicSelect(tp.topicId)}
                title={tp.topicKeywords}
              >
                {tp.topicKeywords.split(', ').slice(0, 3).join(' · ')}
                <span className={styles.topicCount}>{tp.itemCount}</span>
              </button>
            ))}
            {selectedTopic !== null && (
              <button className={styles.btnReset} onClick={handleReset}>{t('list.viewAll')}</button>
            )}
          </div>
        </div>
      )}

      {/* 검색 */}
      <RelatedDatasets query={query} onSelect={(it) => { setSearch(it.listTitle); setQuery(it.listTitle); loadList(0, it.listTitle, sort, null) }} />
      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSubmit={handleSearch}
        onReset={handleReset}
        showReset={!!(query || selectedTopic !== null)}
        placeholder={t('list.search.placeholder')}
        searchLabel={t('common.search')}
        resetLabel={t('common.reset')}
      />

      {relatedTerms.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '8px 0 4px' }}>
          <span style={{ fontSize: 12, color: '#64748b', marginRight: 2 }}>{t('list.relatedTerms')}</span>
          {relatedTerms.map(rt => (
            <button
              key={rt.term}
              type="button"
              onClick={() => {
                setSearch(rt.term); setQuery(rt.term); setSelectedTopic(null)
                loadList(0, rt.term, sort, null)
                getRelatedTerms(rt.term).then(r => setRelatedTerms(r.data || [])).catch(() => {})
              }}
              style={{
                padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                background: '#eff6ff', color: '#1d4ed8',
                border: '1px solid #bfdbfe', borderRadius: 12,
              }}>
              {rt.term}
            </button>
          ))}
        </div>
      )}

      {!data && loading && <div className={styles.loading}>{t('common.loading')}</div>}
      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity .15s' }}>
          <p className={styles.resultInfo}>
            {t('list.total')} <strong>{data.totalElements.toLocaleString()}</strong>{t('list.count')}
            {selectedTopic !== null && topics.length > 0 && (
              <> · {t('list.topicLabel')} <em>{topics.find(tp => tp.topicId === selectedTopic)?.topicKeywords?.split(', ').slice(0, 3).join(', ')}</em></>
            )}
            {query && selectedTopic === null && <> · {t('list.searchLabel')} <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('list.col.listId')}</th>
                  <SortTh field="listTitle" sort={sort} onSort={handleSort}>{t('list.col.listTitle')}</SortTh>
                  <SortTh field="orgNm" sort={sort} onSort={handleSort}>{t('list.col.orgNm')}</SortTh>
                  <th>{t('list.col.category')}</th>
                  <th>{t('list.col.apiType')}</th>
                  <SortTh field="isCharged" sort={sort} onSort={handleSort}>{t('list.col.charge')}</SortTh>
                  <SortTh field="requestCnt" sort={sort} onSort={handleSort} className={styles.num}>{t('list.col.useCount')}</SortTh>
                  <SortTh field="updatedAt" sort={sort} onSort={handleSort}>{t('list.col.updated')}</SortTh>
                  <th style={{width:90,textAlign:"center"}}>{t('list.invoke.col')}</th>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0
                  ? <tr><td colSpan={8} className={styles.empty}>{t('list.empty')}</td></tr>
                  : data.content.map((row) => (
                    <tr key={row.listId} className={styles.clickableRow} onClick={() => handleRowClick(row)} title={t('list.detailClick')}>
                      <td className={styles.mono} onClick={(e) => { e.stopPropagation(); copyToClipboard(row.listId, "listId"); }} title={t('list.copyClick')} style={{cursor:"copy"}}>{row.listId}</td>
                      <td className={styles.titleCell} title={t('list.copyClick')} onClick={(e) => { e.stopPropagation(); copyToClipboard(row.listTitle, "listTitle"); }} style={{cursor:"copy"}}>{row.listTitle}</td>
                      <td>{row.orgNm}</td>
                      <td>{row.newCategoryNm}</td>
                      <td><span className={`${styles.badge} ${styles[row.apiType?.toLowerCase()]}`}>{row.apiType}</span></td>
                      <td>{row.isCharged}</td>
                      <td className={styles.num}>{row.requestCnt?.toLocaleString()}</td>
                      <td>{row.updatedAt}</td>
                      <td style={{textAlign:"center"}} onClick={(e)=>e.stopPropagation()}>
                        {(() => {
                          const s = subscribedMap[row.listId]
                          if (s === 'APPROVED')          return <span style={{fontSize:11,color:'#15803d',fontWeight:600}}>{t('list.apply.approved')}</span>
                          if (s === 'SUBMITTED')         return <span style={{fontSize:11,color:'#2563eb',fontWeight:600}}>{t('list.apply.submitted')}</span>
                          if (s === 'PENDING')           return <span style={{fontSize:11,color:'#92400e',fontWeight:600}}>{t('list.apply.pending')}</span>
                          if (s === 'MANUAL_REGISTERED') return <span style={{fontSize:11,color:'#6d28d9',fontWeight:600}} title={t('list.apply.doneTip')}>{t('list.apply.done')}</span>
                          return (
                            <button
                              style={{padding:'4px 10px',fontSize:11,background:'#2563eb',color:'#fff',border:'none',borderRadius:4,cursor:'pointer'}}
                              onClick={(e) => {
                                e.stopPropagation()
                                // 신청 → API 호출 콘솔로 변경
                                setInvokeRow({ listId: row.listId, listTitle: row.listTitle })
                              }}>{t('list.invoke.btn')}</button>
                          )
                        })()}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={data.totalPages}
            first={data.first}
            last={data.last}
            onPageChange={loadList}
          />
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {(detailLoading || selectedApi) && (
        <div className={styles.detailOverlay} onClick={() => setSelectedApi(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            {detailLoading && <div className={styles.detailLoading}>{t('common.loading')}</div>}
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
                <h3 className={styles.sectionTitle}>{t('list.similar')}</h3>
                {similarLoading && <p className={styles.noDdl}>{t('common.loading')}</p>}
                {!similarLoading && similar.length === 0 && (
                  <p className={styles.noDdl}>{t('list.similar.none')}</p>
                )}
                {similar.length > 0 && (
                  <div className={styles.similarList}>
                    {similar.map(s => (
                      <div key={s.listId} className={styles.similarItem}
                        onClick={() => handleRowClick({ listId: s.listId })}
                        title={t('list.detailClick')}>
                        <span className={styles.similarTitle}>{s.listTitle}</span>
                        <span className={styles.similarMeta}>{s.orgNm} · {s.categoryNm}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className={styles.sectionTitle}>
                  {t('list.operations')} ({selectedApi.operations?.length ?? 0})
                </h3>
                {selectedApi.operations?.length === 0 && (
                  <p className={styles.noDdl}>{t('list.operations.none')}</p>
                )}
                {selectedApi.operations?.map(op => (
                  <div key={op.operationSeq} className={styles.opCard}>
                    <div className={styles.opHeader} onClick={() => toggleOp(op.operationSeq)}>
                      <span className={styles.opName}>{op.operationNm || t('list.opNoName')}</span>
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

      {/* API 호출 콘솔 */}
      {invokeRow && (
        <ApiInvokeConsole
          listId={invokeRow.listId}
          listTitle={invokeRow.listTitle}
          onClose={() => setInvokeRow(null)}
        />
      )}
    </>
  )
}

/* ── 파일 데이터 탭 — 파일 형식 ext 필터 + 유사도 ── */
const FILE_FORMAT_OPTIONS = [
  { value: '',                            labelKey: 'list.fmt.all' },
  { value: 'csv',                         label: 'CSV' },
  { value: 'xlsx,xls',                    label: 'Excel (xlsx, xls)' },
  { value: 'json,JSON,JSON+XML',          label: 'JSON' },
  { value: 'xml,XML',                     label: 'XML' },
  { value: 'pdf',                         label: 'PDF' },
  { value: 'hwp,hwpx',                    labelKey: 'list.fmt.hwp' },
  { value: 'docx,doc,odt',                labelKey: 'list.fmt.word' },
  { value: 'pptx',                        labelKey: 'list.fmt.ppt' },
  { value: 'txt,TEXT',                    labelKey: 'list.fmt.txt' },
  { value: 'jpg,jpeg,png,gif,tiff',       labelKey: 'list.fmt.image' },
  { value: 'mp4,mp3',                     labelKey: 'list.fmt.media' },
  { value: 'zip,7z',                      labelKey: 'list.fmt.archive' },
]
function DataItemTab() {
  const { t } = useI18n()
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
        <label style={{ fontSize: 13, color: '#475569', marginRight: 8 }}>{t('list.format.label')}</label>
        <select
          value={extFilter}
          onChange={(e) => { setExtFilter(e.target.value); setSearch(''); setQuery(''); }}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6 }}
        >
          {FILE_FORMAT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.labelKey ? t(o.labelKey) : o.label}</option>
          ))}
        </select>
      </div>

      {/* 검색 */}
      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSubmit={handleSearch}
        onReset={handleReset}
        showReset={!!query}
        placeholder={t('list.search.filePlaceholder')}
        searchLabel={t('common.search')}
        resetLabel={t('common.reset')}
      />

      {!data && loading && <div className={styles.loading}>{t('common.loading')}</div>}
      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity .15s' }}>
          <p className={styles.resultInfo}>
            {t('list.total')} <strong>{data.totalElements.toLocaleString()}</strong>{t('list.count')}
            {query && <> · {t('list.searchLabel')} <em>"{query}"</em></>}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh field="title" sort={sort} onSort={handleSort}>{t('list.col.title')}</SortTh>
                  <SortTh field="orgNm" sort={sort} onSort={handleSort}>{t('list.col.orgNm')}</SortTh>
                  <th>{t('list.col.category')}</th>
                  <th>{t('list.col.format')}</th>
                  <th>{t('list.col.cycle')}</th>
                  <SortTh field="viewCnt" sort={sort} onSort={handleSort} className={styles.num}>{t('list.col.viewCnt')}</SortTh>
                  <SortTh field="downloadCnt" sort={sort} onSort={handleSort} className={styles.num}>{t('list.col.downloadCnt')}</SortTh>
                  <SortTh field="updatedAt" sort={sort} onSort={handleSort}>{t('list.col.updated')}</SortTh>
                  <th>{t('list.col.link')}</th>
                </tr>
              </thead>
              <tbody>
                {data.content.length === 0
                  ? <tr><td colSpan={9} className={styles.empty}>{t('list.empty')}</td></tr>
                  : data.content.map((row) => (
                    <tr key={row.id} className={styles.clickableRow} onClick={() => handleRowClick(row)} title={t('list.similarDataClick')}>
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
                          ? <a href={row.pageUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>{t('list.linkGo')}</a>
                          : '-'
                        }
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={data.totalPages}
            first={data.first}
            last={data.last}
            onPageChange={loadItems}
          />
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
              <p><a href={selectedItem.pageUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>{t('list.origin')}</a></p>
            )}

            <h3 className={styles.sectionTitle}>{t('list.similarData')}</h3>
            {similarLoading && <p className={styles.noDdl}>{t('common.loading')}</p>}
            {!similarLoading && similar.length === 0 && (
              <p className={styles.noDdl}>{t('list.similarData.none')}</p>
            )}
            {similar.length > 0 && (
              <div className={styles.similarList}>
                {similar.map(s => (
                  <div key={s.id} className={styles.similarItem}
                    onClick={() => handleRowClick(s)}
                    title={t('list.similarDataClick')}>
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
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('openapi')

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('list.title')}</h1>

      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
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
