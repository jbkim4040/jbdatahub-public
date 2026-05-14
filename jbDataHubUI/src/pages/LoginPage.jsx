import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/authApi'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { login: setAuth } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(form.username, form.password)
      setAuth(res.data.token, res.data.refreshToken, res.data.username, res.data.role)
      navigate('/')
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>관리자 로그인</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>아이디</label>
          <input
            className={styles.input}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="username"
            required
          />
          <label className={styles.label}>비밀번호</label>
          <input
            className={styles.input}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="password"
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
