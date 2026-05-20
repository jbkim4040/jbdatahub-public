import http from './http'

/** 관리자 — OpenAPI 목록 전체 수집 */
export const collectAll = () => http.post('/admin/collect')

/** 관리자 — OpenAPI 단일 페이지 수집 */
export const collectPage = (page) => http.post(`/admin/collect/page/${page}`)

/** 관리자 — 데이터셋 전체 수집 */
export const collectDataset = () => http.post('/admin/collect/dataset')

/** 관리자 — 파일데이터 전체 수집 */
export const collectFileData = () => http.post('/admin/collect/file-data')

/** 관리자 — 표준데이터 전체 수집 */
export const collectStandardData = () => http.post('/admin/collect/standard-data')

/** 관리자 — 수집 중지 */
export const stopCollect = () => http.post('/admin/collect/stop')

/** 관리자 — 수집 상태 조회 */
export const getCollectStatus = () => http.get('/admin/collect/status')

/** 관리자 — 수집 이력 조회 (DB 영속) */
export const getCollectHistory = (limit = 20) =>
  http.get('/admin/collect/history', { params: { limit } })

/** 목록 조회 (페이징 + 검색 + 정렬) */
export const getList = (page = 0, size = 20, title = '', sortBy = null, sortDir = null) =>
  http.get('/public-data/list', { params: { page, size, title: title || undefined, sortBy: sortBy || undefined, sortDir: sortDir || undefined } })

/** 통계 조회 (OpenAPI) */
export const getStats = () => http.get('/public-data/stats')

/** 통계 조회 (dataset / file-data / standard-data) */
export const getDataItemStats = (sourceType) =>
  http.get('/public-data/stats/data-items', { params: { sourceType } })

/** 수집 데이터 목록 조회 — ext: 파일 형식 콤마 구분 (csv,xlsx 등) */
export const getDataItems = (extCsv = '', page = 0, size = 20, title = '', sortBy = null, sortDir = null) =>
  http.get('/public-data/data-items', {
    params: {
      ext: extCsv || undefined,
      page, size,
      title: title || undefined,
      sortBy: sortBy || undefined,
      sortDir: sortDir || undefined,
    }
  })

/** DataItem 유사도 조회 */
export const getDataItemSimilar = (id) =>
  http.get(`/public-data/data-items/${id}/similar`)

/* ── 사용자 관리 (관리자 전용) ── */
export const getUsers = () => http.get('/admin/users')
export const createUser = (data) => http.post('/admin/users', data)
export const updateUser = (id, data) => http.put(`/admin/users/${id}`, data)
export const changeUserPassword = (id, newPassword) =>
  http.put(`/admin/users/${id}/password`, { newPassword })
export const deleteUser = (id) => http.delete(`/admin/users/${id}`)
export const revokeUserTokens = (id) => http.post(`/admin/users/${id}/revoke-tokens`)

/* ── 스케줄러 (관리자 전용) ── */
export const getScheduler = () => http.get('/admin/scheduler')
export const updateScheduler = (data) => http.put('/admin/scheduler', data)

/** 관리자 — 수집 재개 (중단 지점부터) */
export const resumeCollect = () => http.post("/admin/collect/resume")

/** API 상세 조회 (operations + DDL 포함) */
export const getApiDetail = (listId) => http.get(`/public-data/detail/${listId}`)

/** 관리자 — 전체 DDL 생성 (비동기, 202 반환) */
export const generateAllDdl = () => http.post('/admin/ddl/generate-all')

/* ── 의미 검색 / 유사 API / 토픽 ── */
export const semanticSearch = (q, page = 0, size = 20) =>
  http.get('/public-data/semantic', { params: { q, page, size } })

export const getSimilar = (listId) =>
  http.get(`/public-data/${listId}/similar`)

export const getTopics = () =>
  http.get('/public-data/topics')

export const getTopicList = (topicId, page = 0, size = 20) =>
  http.get(`/public-data/topics/${topicId}/list`, { params: { page, size } })

/** 신청 — 사용자가 data.go.kr에서 직접 신청한 후 수동 등록 (팝업 흐름) */
export const markManualSubscription = (listId) =>
  http.post(`/public-data/${listId}/subscribe/manual`)

/** API 호출(프록시) — 사용자 인증키로 공공 API 직접 호출 (백엔드 타임아웃 8s + 여유) */
export const invokeApi = (body) => http.post('/public-data/invoke', body, { timeout: 12000 })

/** 초기 배치 임베딩 진행 상황 */
export const getEmbedProgress = () =>
  http.get('/public-data/embed-progress')

/** 관련 검색어 (단어 유사도) */
export const getRelatedTerms = (q, limit = 8) =>
  http.get('/public-data/related-terms', { params: { q, limit } })

/** 내 프로필 조회 (serviceKey 포함) */
export const getMe = () => http.get('/auth/me')

/** 내 serviceKey 저장 */
export const saveServiceKey = (key) => http.patch('/auth/me/service-key', { serviceKey: key })

