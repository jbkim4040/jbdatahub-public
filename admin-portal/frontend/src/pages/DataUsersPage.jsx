import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/dateFormatter'
import {
  getUsers, createUser, updateUser, changeUserPassword, deleteUser, revokeUserTokens,
} from '../api/datahubApi'

const ROLE_LABEL = { ADMIN: '관리자', USER: '일반', SUPER_ADMIN: 'SUPER', GUEST: '방문자' }

export default function DataUsersPage() {
  const { isSuperAdmin, auth } = useAuth()
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'USER' })
  const [createError, setCreateError] = useState('')
  const [pwModal, setPwModal] = useState(null)
  const [newPw, setNewPw]   = useState('')
  const [pwError, setPwError] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try { const res = await getUsers(); setUsers(res.data) }
    catch { setError('사용자 목록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.username || !createForm.password) { setCreateError('아이디와 비밀번호를 입력하세요.'); return }
    try {
      await createUser(createForm)
      setCreateForm({ username: '', password: '', role: 'USER' })
      fetchUsers()
    } catch (err) {
      setCreateError(err.response?.data || '사용자 생성에 실패했습니다.')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { active: !user.active })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u))
    } catch { alert('상태 변경에 실패했습니다.') }
  }

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    try {
      await updateUser(user.id, { role: newRole })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    } catch { alert('권한 변경에 실패했습니다.') }
  }

  const handleRevokeTokens = async (user) => {
    if (!window.confirm(`${user.username}의 토큰을 모두 무효화하겠습니까?`)) return
    try { await revokeUserTokens(user.id); alert(`${user.username} 강제 로그아웃 완료`) }
    catch (err) { alert(err.response?.data || '토큰 무효화에 실패했습니다.') }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`${user.username}을(를) 삭제하겠습니까?`)) return
    try {
      await deleteUser(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (err) { alert(err.response?.data || '삭제에 실패했습니다.') }
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (!newPw || newPw.length < 8) { setPwError('비밀번호는 8자 이상이어야 합니다.'); return }
    try { await changeUserPassword(pwModal.id, newPw); setPwModal(null); setNewPw('') }
    catch { setPwError('비밀번호 변경에 실패했습니다.') }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>

      {/* 신규 사용자 생성 */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">신규 사용자 생성</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="아이디" value={createForm.username}
            onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
          />
          <input
            type="password"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="비밀번호" value={createForm.password}
            onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
          />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={createForm.role}
            onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
          >
            <option value="USER">일반</option>
            {isSuperAdmin && <option value="ADMIN">관리자</option>}
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            추가
          </button>
        </form>
        {createError && <p className="text-sm text-red-500">{createError}</p>}
      </section>

      {/* 사용자 목록 */}
      <section className="space-y-2">
        {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse bg-white rounded-xl overflow-hidden border border-gray-200">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs">
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">ID</th>
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">아이디</th>
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">권한</th>
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">상태</th>
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">생성일</th>
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">최근 로그인</th>
                  <th className="text-left px-3 py-2.5 border-b border-gray-200">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-gray-400">{u.id}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{u.username}</td>
                    <td className="px-3 py-2">
                      <button
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } disabled:cursor-default`}
                        onClick={() => handleToggleRole(u)}
                        disabled={u.username === auth?.username || u.role === 'SUPER_ADMIN' || u.role === 'GUEST'}
                        title={u.username === auth?.username ? '자신의 권한은 변경할 수 없습니다' : '클릭하여 권한 변경'}
                      >
                        {ROLE_LABEL[u.role] ?? u.role}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          u.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                        onClick={() => handleToggleActive(u)}
                        title="클릭하여 상태 변경"
                      >
                        {u.active ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{u.createdAt ? u.createdAt.slice(0, 10) : '-'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(u.lastLoginAt, '-')}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                          onClick={() => { setPwModal(u); setNewPw(''); setPwError('') }}
                        >
                          비밀번호
                        </button>
                        <button
                          className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100 transition-colors"
                          onClick={() => handleRevokeTokens(u)}
                          title="강제 로그아웃"
                        >
                          강제 로그아웃
                        </button>
                        <button
                          className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                          onClick={() => handleDelete(u)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 비밀번호 변경 모달 */}
      {pwModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setPwModal(null)}
        >
          <div
            className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900">{pwModal.username} 비밀번호 변경</h3>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="새 비밀번호"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              autoFocus
            />
            {pwError && <p className="text-sm text-red-500">{pwError}</p>}
            <div className="flex gap-2">
              <button
                className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={handleChangePassword}
              >
                변경
              </button>
              <button
                className="flex-1 bg-gray-100 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={() => setPwModal(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
