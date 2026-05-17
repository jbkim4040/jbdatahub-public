import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

export const prsApi = {
  list:   (page = 1) => api.get(`/prs?page=${page}`),
  get:    (n)        => api.get(`/prs/${n}`),
  review: (n)        => api.post(`/prs/${n}/review`),
}

export const securityApi = {
  reports: (page = 1) => api.get(`/security/reports?page=${page}`),
  report:  (id)        => api.get(`/security/reports/${id}`),
  summary: ()          => api.get('/security/summary'),
}

export const deployApi = {
  status:  ()  => api.get('/deploy/status'),
  builds:  (p) => api.get(`/deploy/builds?page=${p}`),
  build:   (n) => api.get(`/deploy/builds/${n}`),
  trigger: ()  => api.post('/deploy/trigger'),
  scan:    ()  => api.post('/deploy/security-scan'),
}

export const requestApi = {
  preview: (payload) => api.post('/request/preview', payload),
  apply:   (payload) => api.post('/request/apply',   payload),
}

export const reportsApi = {
  list:   (page = 1, type) => api.get(`/reports?page=${page}${type ? `&report_type=${type}` : ''}`),
  get:    (id)             => api.get(`/reports/${id}`),
  create: (payload)        => api.post('/reports', payload),
  remove: (id)             => api.delete(`/reports/${id}`),
  pdfUrl: (id)             => `/api/reports/${id}/pdf`,
  docxUrl:(id)             => `/api/reports/${id}/docx`,
}
