import styles from './Pagination.module.css'

export default function Pagination({ page, totalPages, first, last, onPageChange }) {
  return (
    <div className={styles.pagination}>
      <button onClick={() => onPageChange(0)} disabled={first}>«</button>
      <button onClick={() => onPageChange(page - 1)} disabled={first}>‹</button>
      <span>{page + 1} / {totalPages}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={last}>›</button>
      <button onClick={() => onPageChange(totalPages - 1)} disabled={last}>»</button>
    </div>
  )
}
