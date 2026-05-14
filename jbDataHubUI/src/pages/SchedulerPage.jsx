import { useState, useEffect } from 'react'
import { getScheduler, updateScheduler } from '../api/publicApi'
import styles from './SchedulerPage.module.css'

const SOURCE_TYPES = [
  { value: 'openapi',       label: 'OpenAPI 목록' },
  { value: 'dataset',       label: '데이터셋' },
  { value: 'file-data',     label: '파일데이터' },
  { value: 'standard-data', label: '표준데이터' },
]

const fmtDate = (iso) => {
  if (!iso) return '없음'
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function SchedulerPage() {
  const [config, setConfig]   = useState(null)
  const [form, setForm]       = useState({ enabled: false, hour: 2, minute: 0, sourceType: 'openapi' })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getScheduler()
      .then((res) => {
        setConfig(res.data)
        setForm({
          enabled:    res.data.enabled,
          hour:       res.data.hour,
          minute:     res.data.minute,
          sourceType: res.data.sourceType || 'openapi',
        })
      })
      .catch(() => setError('스케줄 정보를 불러오지 못했습니다.'))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await updateScheduler(form)
      setConfig(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>자동 수집 스케줄</h1>
        <span className={styles.adminBadge}>🔒 관리자 전용</span>
      </div>
      <p className={styles.desc}>매일 지정한 시각에 자동으로 데이터를 수집합니다.</p>

      {config && (
        <div className={styles.statusCard}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>현재 상태</span>
            <span className={`${styles.statusBadge} ${config.enabled ? styles.on : styles.off}`}>
              {config.enabled ? '✅ 활성화' : '⏸ 비활성화'}
            </span>
          </div>
          {config.enabled && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>실행 시각</span>
              <span className={styles.statusValue}>
                매일 {String(config.hour).padStart(2,'0')}:{String(config.minute).padStart(2,'0')}
              </span>
            </div>
          )}
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>마지막 실행</span>
            <span className={styles.statusValue}>{fmtDate(config.lastRunAt)}</span>
          </div>
          {config.updatedAt && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>설정 변경</span>
              <span className={styles.statusValue}>{fmtDate(config.updatedAt)}</span>
            </div>
          )}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSave}>
        <div className={styles.field}>
          <label className={styles.label}>자동 수집 활성화</label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>수집 유형</label>
          <select
            className={styles.select}
            value={form.sourceType}
            onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
            disabled={!form.enabled}
          >
            {SOURCE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>실행 시각</label>
          <div className={styles.timeRow}>
            <input
              className={styles.timeInput}
              type="number" min="0" max="23"
              value={form.hour}
              onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}
              disabled={!form.enabled}
            />
            <span className={styles.timeSep}>시</span>
            <input
              className={styles.timeInput}
              type="number" min="0" max="59"
              value={form.minute}
              onChange={(e) => setForm({ ...form, minute: Number(e.target.value) })}
              disabled={!form.enabled}
            />
            <span className={styles.timeSep}>분</span>
          </div>
          <p className={styles.hint}>서버 시간(UTC) 기준입니다. KST는 +9시간입니다.</p>
        </div>

        {error && <div className={styles.errorBox}>❌ {error}</div>}
        {saved && <div className={styles.savedBox}>✅ 저장되었습니다.</div>}

        <button className={styles.btnSave} type="submit" disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  )
}
