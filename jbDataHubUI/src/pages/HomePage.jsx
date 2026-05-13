import { useNavigate } from 'react-router-dom'
import styles from './HomePage.module.css'

function HomePage() {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>jbDataHub</h1>
      <p className={styles.desc}>
        공공데이터포털(data.go.kr) OpenAPI 목록을 수집하고 관리하는 허브입니다.
      </p>
      <div className={styles.cards}>
        <div className={styles.card} onClick={() => navigate('/collect')}>
          <div className={styles.icon}>📡</div>
          <h2>데이터 수집</h2>
          <p>공공데이터포털 OpenAPI 목록을 수집하여 DB에 저장합니다.</p>
        </div>
      </div>
    </div>
  )
}

export default HomePage
