import { useState, useEffect, useCallback } from 'react'
import {
  getUsers, createUser, updateUser, changeUserPassword, deleteUser
} from '../api/publicApi'
import styles from './UsersPage.module.css'

const ROLE_LABELS = { ADMIN: '관리자', USER: '일반 사용자' }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 신규 생성 폼
  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'USER' })
  const [createError, setCreateError] = useState('')

  // 비밀번호 변경 모달
  const [pwModal, setPwModal] = useState(null) // { id, username }
  const [newPw, setNewPw] = useState('')
  const [pwError, setPwError] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUsers()
      setUsers(res.data)
    } catch {
      setError('사용자 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.username || !createForm.password) {
      setCreateError('아이디와 비밀번호를 입력하세요.')
      return
    }
    try {
      await createUser(createForm)
      setCreateForm({ username: '', password: '', role: 'USER' })
      fetchUsers()
    } catch (err) {
      setCreateError(err.response?.data || '생성 실패')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { active: !user.active })
      fetchUsers()
    } catch {
      alert('상태 변경 실패')
    }
  }

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    try {
      await updateUser(user.id, { role: newRole })
      fetchUsers()
    } catch {
      alert('역할 변경 실패')
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`"${user.username}" 계정을 삭제하시겠습니까?`)) return
    try {
      await deleteUser(user.id)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data || '삭제 실패')
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (!newPw || newPw.length < 4) {
      setPwError('비밀번호는 4자 이상 입력하세요.')
      return
    }
    try {
      await changeUserPassword(pwModal.id, newPw)
      setPwModal(null)
      setNewPw('')
    } catch {
      setPwError('비밀번호 변경 실패')
    }
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>사용자 관리</h2>

      {/* 신규 사용자 생성 폼 */}
      <section className={styles.createSection}>
        <h3>새 계정 추가</h3>
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            className={styles.input}
            placeholder="아이디"
            value={createForm.username}
            onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
          />
          <input
            className={styles.input}
            type="password"
            placeholder="비밀번호"
            value={createForm.password}
            onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
          />
          <select
            className={styles.select}
            value={createForm.role}
            onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
          >
            <option value="USER">일반 사용자</option>
            <option value="ADMIN">관리자</option>
          </select>
          <button className={styles.createBtn} type="submit">추가</button>
        </form>
        {createError && <p className={styles.errMsg}>{createError}</p>}
      </section>

      {/* 사용자 목록 */}
      <section className={styles.listSection}>
        {loading && <p>불러오는 중...</p>}
        {error && <p className={styles.errMsg}>{error}</p>}
        {!loading && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>아이디</th>
                <th>역할</th>
                <th>상태</th>
                <th>생성일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={!u.active ? styles.inactiveRow : ''}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>
                    <button
                      className={`${styles.tagBtn} ${u.role === 'ADMIN' ? styles.adminTag : styles.userTag}`}
                      onClick={() => handleToggleRole(u)}
                      title="클릭하여 역할 변경"
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`${styles.tagBtn} ${u.active ? styles.activeTag : styles.inactiveTag}`}
                      onClick={() => handleToggleActive(u)}
                      title="클릭하여 상태 변경"
                    >
                      {u.active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td>{u.createdAt ? u.createdAt.slice(0, 10) : '-'}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.pwBtn}
                      onClick={() => { setPwModal(u); setNewPw(''); setPwError('') }}
                    >
                      비밀번호 변경
                    </button>
                    <button
                      className={styles.delBtn}
                      onClick={() => handleDelete(u)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 비밀번호 변경 모달 */}
      {pwModal && (
        <div className={styles.modalOverlay} onClick={() => setPwModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>비밀번호 변경 — {pwModal.username}</h3>
            <input
              className={styles.input}
              type="password"
              placeholder="새 비밀번호"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              autoFocus
            />
            {pwError && <p className={styles.errMsg}>{pwError}</p>}
            <div className={styles.modalBtns}>
              <button className={styles.createBtn} onClick={handleChangePassword}>변경</button>
              <button className={styles.cancelBtn} onClick={() => setPwModal(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
