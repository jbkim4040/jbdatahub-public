import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import styles from './Layout.module.css'

export default function Layout() {
  const { auth, isAdmin, logout } = useAuth()
  const { t, lang, changeLang } = useI18n()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>jbDataHub</NavLink>
        <button className={styles.menuToggle} onClick={() => setMenuOpen(v=>!v)} aria-label={t('nav.menu')}>☰</button>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>{t('nav.home')}</NavLink>
          <NavLink to="/list" className={({ isActive }) => isActive ? styles.active : ''}>{t('nav.list')}</NavLink>
        </nav>
        <div className={styles.authArea}>
          <button
            className={styles.langToggle}
            onClick={() => changeLang(lang === 'ko' ? 'en' : 'ko')}
            title={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
          >
            {lang === 'ko' ? 'EN' : '한국어'}
          </button>
          {auth ? (
            <>
              <span className={styles.username}>
                {isAdmin && <span className={styles.badge}>{t('nav.admin')}</span>}
                {auth.username}
              </span>
              <button className={styles.logoutBtn} onClick={handleLogout}>{t('nav.logout')}</button>
            </>
          ) : (
            <NavLink to="/login" className={styles.loginBtn}>{t('nav.login')}</NavLink>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>{t('footer.copyright')}</footer>
    </div>
  )
}
