import axios from 'axios'

const api = axios.create({
  baseURL: '/api/public-data',
  headers: { 'Content-Type': 'application/json' },
})

/** 전체 수집 */
export const collectAll = () => api.post('/collect')

/** 단일 페이지 수집 */
export const collectPage = (page) => api.post(`/collect/page/${page}`)
