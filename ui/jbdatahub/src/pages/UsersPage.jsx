import { useAuth } from "../context/AuthContext"
import { useState, useEffect, useCallback } from 'react'
import {
  getUsers, createUser, updateUser, changeUserPassword, deleteUser, revokeUserTokens
} from '../api/publicApi'
import { useI18n } from '../context/I18nContext'
import styles from './UsersPage.module.css'

export default function UsersPage() {
  const { isSuperAdmin, auth } = useAuth()
  const { t } = useI18n()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ROLE_LABEL = { ADMIN: t('users.role.admin'), USER: t('users.role.user') }

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
      setError(t('users.fetchFail'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.username || !createForm.password) {
      setCreateError(t('users.inputRequired'))
      return
    }
    try {
      await createUser(createForm)
      setCreateForm({ username: '', password: '', role: 'USER' })
      fetchUsers()
    } catch (err) {
      setCreateError(err.response?.data || t('users.createFail'))
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { active: !user.active })
      fetchUsers()
    } catch {
      alert(t('users.statusChangeFail'))
    }
  }

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    try {
      await updateUser(user.id, { role: newRole })
      fetchUsers()
    } catch {
      alert(t('users.roleChangeFail'))
    }
  }

  const handleRevokeTokens = async (user) => {
    if (!window.confirm(t('users.revokeConfirm').replace('{name}', user.username))) return
    try {
      await revokeUserTokens(user.id)
      alert(t('users.revokeDone').replace('{name}', user.username))
    } catch (err) {
      alert(err.response?.data || t('users.revokeFail'))
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(t('users.deleteConfirm').replace('{name}', user.username))) return
    try {
      await deleteUser(user.id)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data || t('users.deleteFail'))
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (!newPw || newPw.length < 4) {
      setPwError(t('users.pwTooShort'))
      return
    }
    try {
      await changeUserPassword(pwModal.id, newPw)
      setPwModal(null)
      setNewPw('')
    } catch {
      setPwError(t('users.pwChangeFail'))
    }
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{t('users.title')}</h2>

      {/* 신규 사용자 생성 폼 */}
      <section className={styles.createSection}>
        <h3>{t('users.createTitle')}</h3>
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            className={styles.input}
            placeholder={t('users.username')}
            value={createForm.username}
            onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
          />
          <input
            className={styles.input}
            type="password"
            placeholder={t('users.password')}
            value={createForm.password}
            onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
          />
          <select
            className={styles.select}
            value={createForm.role}
            onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
          >
            <option value="USER">{t('users.role.user')}</option>
            {isSuperAdmin && <option value="ADMIN">{t('users.role.admin')}</option>}
          </select>
          <button className={styles.createBtn} type="submit">{t('users.add')}</button>
        </form>
        {createError && <p className={styles.errMsg}>{createError}</p>}
      </section>

      {/* 사용자 목록 */}
      <section className={styles.listSection}>
        {loading && <p>{t('common.loading')}</p>}
        {error && <p className={styles.errMsg}>{error}</p>}
        {!loading && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('users.col.id')}</th>
                <th>{t('users.col.username')}</th>
                <th>{t('users.col.role')}</th>
                <th>{t('users.col.status')}</th>
                <th>{t('users.col.createdAt')}</th>
                <th>{t('users.col.lastLogin')}</th>
                <th>{t('users.col.actions')}</th>
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
                      disabled={u.username === auth?.username}
                      title={u.username === auth?.username ? t('users.selfRoleTip') : t('users.roleChangeTip')}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`${styles.tagBtn} ${u.active ? styles.activeTag : styles.inactiveTag}`}
                      onClick={() => handleToggleActive(u)}
                      title={t('users.statusChangeTip')}
                    >
                      {u.active ? t('users.active') : t('users.inactive')}
                    </button>
                  </td>
                  <td>{u.createdAt ? u.createdAt.slice(0, 10) : '-'}</td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.pwBtn}
                      onClick={() => { setPwModal(u); setNewPw(''); setPwError('') }}
                    >
                      {t('users.pwChange')}
                    </button>
                    <button
                      className={styles.revokeBtn}
                      onClick={() => handleRevokeTokens(u)}
                      title={t('users.forceLogoutTip')}
                    >
                      {t('users.forceLogout')}
                    </button>
                    <button
                      className={styles.delBtn}
                      onClick={() => handleDelete(u)}
                    >
                      {t('users.delete')}
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
            <h3>{t('users.pwModalTitle')}{pwModal.username}</h3>
            <input
              className={styles.input}
              type="password"
              placeholder={t('users.newPw')}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              autoFocus
            />
            {pwError && <p className={styles.errMsg}>{pwError}</p>}
            <div className={styles.modalBtns}>
              <button className={styles.createBtn} onClick={handleChangePassword}>{t('users.change')}</button>
              <button className={styles.cancelBtn} onClick={() => setPwModal(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
