import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { getStats } from '../api/publicApi'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { t } = useI18n()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(() => {})
  }, [])

  const cards = [
    { icon: '📋', label: t('home.card.list.label'), desc: t('home.card.list.desc'), path: '/list', show: true },
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
