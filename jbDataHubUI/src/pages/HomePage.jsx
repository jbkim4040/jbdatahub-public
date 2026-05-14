import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const cards = [
    { icon: '📋', label: '목록 조회', desc: 'DB에 저장된 OpenAPI 목록을 검색·조회합니다.', path: '/list', show: true },
    { icon: '📡', label: '데이터 수집', desc: '외부 API에서 OpenAPI 목록을 수집하여 DB에 저장합니다.', path: '/collect', show: isAdmin, admin: true },
  ]

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>jbDataHub</h1>
      <p className={styles.desc}>공공데이터포털(data.go.kr) OpenAPI 목록을 수집하고 관리하는 허브입니다.</p>
      <div className={styles.cards}>
        {cards.filter(c => c.show).map(card => (
          <div key={card.path} className={`${styles.card} ${card.admin ? styles.adminCard : ''}`} onClick={() => navigate(card.path)}>
            <div className={styles.icon}>{card.icon}</div>
            <h2>{card.label}</h2>
            {card.admin && <span className={styles.badge}>관리자 전용</span>}
            <p>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
