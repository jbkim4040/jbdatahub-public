import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { getStats } from '../api/publicApi'
import styles from './HomePage.module.css'

// jbdatahub 포털에 묶인 서브도메인 서비스 목록.
// `admin: true`는 관리자 전용 — 시각적으로만 표시(접근 시 각 서비스가 자체 인증).
const SERVICES = [
  { host: 'recipe.jbdatahub.com',     icon: '📖', label: '레시피 북',        desc: 'URL만 붙여넣으면 자동 저장' },
  { host: 'compass.jbdatahub.com',    icon: '📈', label: '코스닥 컴파스',     desc: '국내·해외 주식 분석·모의 투자' },
  { host: 'admin.jbdatahub.com',      icon: '🛠️', label: '관리자 콘솔',       desc: 'PR·배포·보안·Gemini 사용량',           admin: true },
  { host: 'jenkins.jbdatahub.com',    icon: '⚙️', label: 'Jenkins',            desc: 'CI/CD 파이프라인',                    admin: true },
  { host: 'grafana.jbdatahub.com',    icon: '📊', label: '모니터링',           desc: 'Grafana 대시보드 + 로그',             admin: true },
  { host: 'prometheus.jbdatahub.com', icon: '🔬', label: '메트릭',            desc: 'Prometheus 시계열 메트릭',            admin: true },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { t } = useI18n()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(() => {})
  }, [])

  const cards = [
    { icon: '📋', label: t('home.card.list.label'),    desc: t('home.card.list.desc'),    path: '/list',    show: true },
    { icon: '📡', label: t('home.card.collect.label'), desc: t('home.card.collect.desc'), path: '/collect', show: isAdmin, admin: true },
  ]

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('home.title')}</h1>
      <p className={styles.desc}>{t('home.desc')}</p>

      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.totalCount?.toLocaleString() ?? '-'}</div>
            <div className={styles.statLabel}>{t('home.stat.openapi')}</div>
          </div>
          {stats.countByApiType && Object.entries(stats.countByApiType).map(([type, count]) => (
            <div key={type} className={styles.statCard}>
              <div className={styles.statNum}>{Number(count).toLocaleString()}</div>
              <div className={styles.statLabel}>{type || t('common.uncategorized')}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 서브도메인 서비스 ── */}
      <section className={styles.servicesSection}>
        <h2 className={styles.sectionTitle}>전체 서비스</h2>
        <p className={styles.sectionDesc}>jbdatahub 포털에 묶인 서비스를 한눈에 확인하세요</p>
        <div className={styles.serviceGrid}>
          {SERVICES.map(s => (
            <a
              key={s.host}
              href={`https://${s.host}`}
              target="_blank"
              rel="noreferrer"
              className={`${styles.serviceCard} ${s.admin ? styles.serviceCardAdmin : ''}`}
            >
              <div className={styles.serviceIcon}>{s.icon}</div>
              <div className={styles.serviceMeta}>
                <div className={styles.serviceLabel}>
                  {s.label}
                  {s.admin && <span className={styles.serviceBadge}>관리자</span>}
                </div>
                <div className={styles.serviceHost}>{s.host}</div>
                <div className={styles.serviceDesc}>{s.desc}</div>
              </div>
              <div className={styles.serviceArrow}>↗</div>
            </a>
          ))}
        </div>
      </section>

      {/* ── 기존 데이터허브 카드 ── */}
      <div className={styles.cards}>
        {cards.filter(c => c.show).map(card => (
          <div key={card.path} className={`${styles.card} ${card.admin ? styles.adminCard : ''}`} onClick={() => navigate(card.path)}>
            <div className={styles.icon}>{card.icon}</div>
            <h2>{card.label}</h2>
            {card.admin && <span className={styles.badge}>{t('home.adminOnly')}</span>}
            <p>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
