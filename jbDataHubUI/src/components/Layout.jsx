import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Layout.module.css'

export default function Layout() {
  const { auth, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>jbDataHub</NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>홈</NavLink>
          <NavLink to="/list" className={({ isActive }) => isActive ? styles.active : ''}>목록 조회</NavLink>
          {isAdmin && (
            <NavLink to="/collect" className={({ isActive }) => isActive ? styles.active : ''}>
              데이터 수집
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? styles.active : ''}>
              사용자 관리
            </NavLink>
          )}
        </nav>
        <div className={styles.authArea}>
          {auth ? (
            <>
              <span className={styles.username}>
                {isAdmin && <span className={styles.badge}>관리자</span>}
                {auth.username}
              </span>
              <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <NavLink to="/login" className={styles.loginBtn}>로그인</NavLink>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>© 2025 jbDataHub</footer>
    </div>
  )
}
