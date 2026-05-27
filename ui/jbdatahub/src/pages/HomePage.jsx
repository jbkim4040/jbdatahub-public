import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './HomePage.module.css'

// role: 'public' | 'admin' (ADMIN/SUPER_ADMIN/GUEST) | 'super_admin' (SUPER_ADMIN만)
const SERVICES = [
  {
    category: 'FINANCE',  accent: '#22d3ee',
    host: 'compass.jbdatahub.com', icon: '📈',
    name: 'Compass',
    desc: 'KRX·NASDAQ 종목 검색, 지표 분석, AI 리포트, 모의투자',
    role: 'public',
    disabled: true,
  },
  {
    category: 'APP',      accent: '#f97316',
    host: 'recipe.jbdatahub.com',  icon: '🍽️',
    name: '레시피 저장소',
    desc: 'URL 붙여넣기로 레시피 자동 추출·저장, 단계별 요리 모드',
    role: 'public',
  },
  {
    category: 'DATA',     accent: '#10b981',
    host: 'datahub.jbdatahub.com', icon: '🗄️',
    name: '공공데이터허브',
    desc: '공공 API 목록 조회·수집 현황, 스케줄러 모니터링',
    role: 'public',
  },
  {
    category: 'ADMIN',    accent: '#3b82f6',
    host: 'admin.jbdatahub.com',   icon: '📁',
    name: 'Admin Portal',
    desc: '공공데이터 수집·관리, 사용자 권한 관리, 스케줄러 제어',
    role: 'admin',
  },
  {
    category: 'MONITORING', accent: '#facc15',
    host: 'grafana.jbdatahub.com', icon: '📊',
    name: 'Grafana',
    desc: '서버 메트릭, 애플리케이션 로그, 실시간 알림 대시보드',
    role: 'admin',
  },
  {
    category: 'CI/CD',    accent: '#ef4444',
    host: 'jenkins.jbdatahub.com', icon: '⚙️',
    name: 'Jenkins',
    desc: 'Blue/Green 자동 배포 파이프라인, 빌드 로그 및 히스토리',
    role: 'super_admin',
  },
  {
    category: 'METRICS',  accent: '#a855f7',
    host: 'prometheus.jbdatahub.com', icon: '📡',
    name: 'Prometheus',
    desc: 'JVM, HTTP, DB 커넥션 풀 메트릭 수집 및 쿼리',
    role: 'super_admin',
  },
]

const ROLE_LABEL = {
  public:      { text: '공개',  className: 'rolePublic' },
  admin:       { text: '내부',  className: 'roleAdmin' },
  super_admin: { text: '내부',  className: 'roleSuper' },
}

export default function HomePage() {
  const navigate = useNavigate()
  const { auth, isAdmin, isSuperAdmin, isGuest, logout } = useAuth()
  const isAuthed = !!auth

  const visible = SERVICES.filter(s => {
    if (s.role === 'public')      return true
    if (s.role === 'admin')       return isAdmin || isGuest
    if (s.role === 'super_admin') return isSuperAdmin || isGuest
    return false
  })

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>JB DataHub</div>
          <div className={styles.userArea}>
            {isAuthed ? (
              <>
                <span className={styles.username}>{auth.username}</span>
                <span className={styles.roleBadge}>
                  {isSuperAdmin ? '코어팀' : isAdmin ? '팀원' : isGuest ? '뷰어' : '회원'}
                </span>
                <button onClick={handleLogout} className={styles.logoutBtn}>
                  로그아웃
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className={styles.logoutBtn}>
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={styles.glow} aria-hidden />

      <section className={styles.titleSection}>
        <h1 className={styles.title}>서비스 포털</h1>
        <p className={styles.subtitle}>
          {isAuthed
            ? <><strong>{auth.username}</strong>님, 안녕하세요</>
            : '아래 서비스를 둘러보거나 로그인 후 더 많은 기능에 접근하세요'}
        </p>
      </section>

      <main className={styles.main}>
        <div className={styles.sectionLabel}>전체 서비스</div>
        <div className={styles.grid}>
          {visible.map(s => (
            <a
              key={s.host}
              href={s.disabled ? undefined : `https://${s.host}`}
              target={s.disabled ? undefined : '_blank'}
              rel="noreferrer"
              className={`${styles.card}${s.disabled ? ' ' + styles.cardDisabled : ''}`}
              style={{ '--accent': s.accent }}
              aria-disabled={s.disabled}
              onClick={s.disabled ? (e) => e.preventDefault() : undefined}
            >
              <div className={styles.cardTopLine} aria-hidden />
              <div className={styles.cardIcon}>{s.icon}</div>
              <div className={styles.cardCategory}>{s.category}</div>
              <div className={styles.cardName}>{s.name}{s.disabled && <span className={styles.comingSoon}>준비중</span>}</div>
              <p className={styles.cardDesc}>{s.desc}</p>
              <div className={styles.cardFoot}>
                <span className={`${styles.roleBadge} ${styles[ROLE_LABEL[s.role].className]}`}>
                  {ROLE_LABEL[s.role].text}
                </span>
                <span className={styles.cardArrow}>→</span>
              </div>
            </a>
          ))}
        </div>

        {!isSuperAdmin && !isGuest && (
          <p className={styles.hint}>
            ※ {!isAdmin
              ? '일부 서비스는 로그인 및 권한이 부여된 계정에서만 표시됩니다.'
              : '일부 서비스는 추가 권한이 필요한 계정에서만 표시됩니다.'}
          </p>
        )}
      </main>

      <footer className={styles.footer}>
        jbdatahub.com — infrastructure by JB
      </footer>
    </div>
  )
}
