import http from './http'

/** 관리자 — 전체 수집 */
export const collectAll = () => http.post('/admin/collect')

/** 관리자 — 단일 페이지 수집 */
export const collectPage = (page) => http.post(`/admin/collect/page/${page}`)

/** 목록 조회 (페이징 + 검색) */
export const getList = (page = 0, size = 20, title = '') =>
  http.get('/public-data/list', { params: { page, size, title } })

/** 통계 조회 */
export const getStats = () => http.get('/public-data/stats')
