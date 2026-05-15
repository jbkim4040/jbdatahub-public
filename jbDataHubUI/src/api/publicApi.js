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

/** 수집 데이터 목록 조회 (dataset / file-data / standard-data) */
export const getDataItems = (sourceType = '', page = 0, size = 20, title = '', sortBy = null, sortDir = null) =>
  http.get('/public-data/data-items', { params: { sourceType: sourceType || undefined, page, size, title: title || undefined, sortBy: sortBy || undefined, sortDir: sortDir || undefined } })

/* ── 사용자 관리 (관리자 전용) ── */
export const getUsers = () => http.get('/admin/users')
export const createUser = (data) => http.post('/admin/users', data)
export const updateUser = (id, data) => http.put(`/admin/users/${id}`, data)
export const changeUserPassword = (id, newPassword) =>
  http.put(`/admin/users/${id}/password`, { newPassword })
export const deleteUser = (id) => http.delete(`/admin/users/${id}`)

/* ── 스케줄러 (관리자 전용) ── */
export const getScheduler = () => http.get('/admin/scheduler')
export const updateScheduler = (data) => http.put('/admin/scheduler', data)

/** 관리자 — 수집 재개 (중단 지점부터) */
export const resumeCollect = () => http.post("/admin/collect/resume")
