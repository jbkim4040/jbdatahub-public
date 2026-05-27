import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './HomePage.module.css'

// ─── 서비스 카탈로그 ───
// role: 'public' — 누구나
//       'user'   — 로그인 필요
//       'admin'  — ADMIN/SUPER_ADMIN
// kind: 'external' — 다른 서브도메인 (새 탭)
//       'internal' — 같은 SPA의 라우트 (현 탭, react-router로 이동)
const SERVICES = [
  { kind: 'external', host: 'recipe.jbdatahub.com',     icon: '📖', label: '레시피 북',      desc: 'URL만 붙여넣으면 자동 저장',         role: 'public' },
  { kind: 'external', host: 'compass.jbdatahub.com',    icon: '📈', label: '코스닥 컴파스',    desc: '국내·해외 주식 분석·모의 투자',     role: 'public' },
  { kind: 'internal', path: '/list',                    icon: '📋', label: '공공 데이터 검색', desc: '공공 API 카탈로그 검색',             role: 'public' },
  { kind: 'internal', path: '/collect',                 icon: '📡', label: '데이터 수집',     desc: '신규 API 추가·수집 (관리자)',         role: 'admin' },
  { kind: 'external', host: 'admin.jbdatahub.com',      icon: '🛠️', label: '관리자 콘솔',     desc: 'PR·배포·보안·Gemini 사용량',         role: 'admin' },
  { kind: 'external', host: 'jenkins.jbdatahub.com',    icon: '⚙️', label: 'Jenkins',         desc: 'CI/CD 파이프라인',                  role: 'admin' },
  { kind: 'external', host: 'grafana.jbdatahub.com',    icon: '📊', label: '모니터링',         desc: 'Grafana 대시보드 + 로그',           role: 'admin' },
  { kind: 'external', host: 'prometheus.jbdatahub.com', icon: '🔬', label: '메트릭',          desc: 'Prometheus 시계열 메트릭',          role: 'admin' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { auth, isAdmin } = useAuth()
  const isAuthed = !!auth

  const visible = SERVICES.filter(s => {
    if (s.role === 'public') return true
    if (s.role === 'user')   return isAuthed
    return isAdmin
  })

  // 권한 그룹 분리 (UI 그룹화)
  const publicSvcs = visible.filter(s => s.role === 'public')
  const adminSvcs  = visible.filter(s => s.role === 'admin')

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>JB DataHub 포털</h1>
      <p className={styles.desc}>
        {isAuthed
          ? <>환영합니다, <strong>{auth.username}</strong>님. {isAdmin && <span className={styles.youAreAdmin}>관리자 권한</span>}</>
          : '아래 서비스를 둘러보거나 로그인 후 더 많은 기능에 접근하세요.'}
      </p>

      {!isAuthed && (
        <div className={styles.loginPrompt}>
          <span>관리자 도구·데이터 수집 기능을 사용하려면</span>
          <button onClick={() => navigate('/login')} className={styles.loginBtn}>
            로그인 →
          </button>
        </div>
      )}

      {/* ── 공개 서비스 ── */}
      <section className={styles.servicesSection}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>공개 서비스</h2>
          <span className={styles.sectionMeta}>{publicSvcs.length}개</span>
        </div>
        <div className={styles.serviceGrid}>
          {publicSvcs.map(s => <ServiceCard key={s.kind + (s.host || s.path)} s={s} navigate={navigate} />)}
        </div>
      </section>

      {/* ── 관리자 전용 — 보이지 않으면 섹션 자체 숨김 ── */}
      {adminSvcs.length > 0 && (
        <section className={styles.servicesSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>관리자 전용</h2>
            <span className={styles.sectionMeta}>
              <span className={styles.roleBadge}>{isAdmin ? '관리자' : '권한 필요'}</span>
              {adminSvcs.length}개
            </span>
          </div>
          <div className={styles.serviceGrid}>
            {adminSvcs.map(s => <ServiceCard key={s.kind + (s.host || s.path)} s={s} navigate={navigate} />)}
          </div>
        </section>
      )}

      {/* 비관리자에게 안내 */}
      {isAuthed && !isAdmin && (
        <p className={styles.hint}>
          ※ 관리자 전용 서비스는 권한이 부여된 계정에서만 표시됩니다.
        </p>
      )}
    </div>
  )
}

function ServiceCard({ s, navigate }) {
  const isAdminCard = s.role === 'admin'
  const className   = `${styles.serviceCard} ${isAdminCard ? styles.serviceCardAdmin : ''}`

  const inner = (
    <>
      <div className={styles.serviceIcon}>{s.icon}</div>
      <div className={styles.serviceMeta}>
        <div className={styles.serviceLabel}>
          {s.label}
          {isAdminCard && <span className={styles.serviceBadge}>관리자</span>}
        </div>
        <div className={styles.serviceHost}>
          {s.kind === 'external' ? s.host : `포털 내부 · ${s.path}`}
        </div>
        <div className={styles.serviceDesc}>{s.desc}</div>
      </div>
      <div className={styles.serviceArrow}>{s.kind === 'external' ? '↗' : '→'}</div>
    </>
  )

  if (s.kind === 'internal') {
    return (
      <button
        type="button"
        onClick={() => navigate(s.path)}
        className={`${className} ${styles.serviceCardInternal}`}
      >
        {inner}
      </button>
    )
  }
  return (
    <a
      href={`https://${s.host}`}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {inner}
    </a>
  )
}
