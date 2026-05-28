import styles from './SearchBar.module.css'

export default function SearchBar({ value, onChange, onSubmit, onReset, showReset, placeholder, searchLabel, resetLabel }) {
  return (
    <form className={styles.searchRow} onSubmit={onSubmit}>
      <input
        className={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button className={styles.btnSearch} type="submit">{searchLabel}</button>
      {showReset && (
        <button className={styles.btnReset} type="button" onClick={onReset}>{resetLabel}</button>
      )}
    </form>
  )
}
