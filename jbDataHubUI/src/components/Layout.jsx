import { Outlet, NavLink } from 'react-router-dom'
import styles from './Layout.module.css'

function Layout() {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <span className={styles.logo}>jbDataHub</span>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>
            홈
          </NavLink>
          <NavLink to="/collect" className={({ isActive }) => isActive ? styles.active : ''}>
            데이터 수집
          </NavLink>
        </nav>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        © 2025 jbDataHub
      </footer>
    </div>
  )
}

export default Layout
