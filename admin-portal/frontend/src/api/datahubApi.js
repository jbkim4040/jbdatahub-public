import http from './http'

export const collectAll          = () => http.post('/admin/collect')
export const collectPage         = (page) => http.post(`/admin/collect/page/${page}`)
export const collectDataset      = () => http.post('/admin/collect/dataset')
export const collectFileData     = () => http.post('/admin/collect/file-data')
export const collectStandardData = () => http.post('/admin/collect/standard-data')
export const stopCollect         = () => http.post('/admin/collect/stop')
export const resumeCollect       = () => http.post('/admin/collect/resume')
export const getCollectStatus    = () => http.get('/admin/collect/status')
export const getCollectHistory   = (limit = 20) => http.get('/admin/collect/history', { params: { limit } })
export const generateAllDdl      = () => http.post('/admin/ddl/generate-all')

export const getScheduler    = () => http.get('/admin/scheduler')
export const updateScheduler = (data) => http.put('/admin/scheduler', data)

export const getUsers           = () => http.get('/admin/users')
export const createUser         = (data) => http.post('/admin/users', data)
export const updateUser         = (id, data) => http.put(`/admin/users/${id}`, data)
export const changeUserPassword = (id, newPassword) => http.put(`/admin/users/${id}/password`, { newPassword })
export const deleteUser         = (id) => http.delete(`/admin/users/${id}`)
export const revokeUserTokens   = (id) => http.post(`/admin/users/${id}/revoke-tokens`)

export const login  = (username, password) => http.post('/auth/login', { username, password })
export const logout = () => http.post('/auth/logout')
export const getMe  = () => http.get('/auth/me')
