import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export const prsApi = {
  list: ()              => api.get('/prs'),
  get:  (n)            => api.get(`/prs/${n}`),
  review: (n)          => api.post(`/prs/${n}/review`),
  merge:  (n)          => api.post(`/prs/${n}/merge`),
}

export const securityApi = {
  reports: (page = 1)  => api.get('/security/reports', { params: { page } }),
  report:  (id)        => api.get(`/security/reports/${id}`),
  summary: ()          => api.get('/security/summary'),
}

export const deployApi = {
  builds:  (page = 1)  => api.get('/deploy/builds', { params: { page } }),
  build:   (n)         => api.get(`/deploy/builds/${n}`),
  trigger: ()          => api.post('/deploy/trigger'),
  scan:    ()          => api.post('/deploy/security-scan'),
  status:  ()          => api.get('/deploy/status'),
}

export default api
