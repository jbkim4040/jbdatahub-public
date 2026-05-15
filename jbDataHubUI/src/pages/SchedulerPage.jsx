import { useState, useEffect } from 'react'
import { getScheduler, updateScheduler } from '../api/publicApi'
import styles from './SchedulerPage.module.css'

const SOURCE_TYPES = [
  { value: 'openapi',       label: 'OpenAPI 목록' },
  { value: 'dataset',       label: '데이터셋' },
  { value: 'file-data',     label: '파일데이터' },
  { value: 'standard-data', label: '표준데이터' },
]

const SCHEDULE_TYPES = [
  { value: 'DAILY',   label: '매일 (특정 시각)' },
  { value: 'HOURLY',  label: '매 N시간마다' },
  { value: 'WEEKLY',  label: '매주 (특정 요일·시각)' },
  { value: 'MONTHLY', label: '매월 (특정 날짜·시각)' },
]

const DOW_LABELS = ['', '월', '화', '수', '목', '금', '토', '일']

const fmtDate = (iso) => {
  if (!iso) return '없음'
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function SchedulerPage() {
  const [config, setConfig]   = useState(null)
  const [form, setForm]       = useState({
    enabled: false, scheduleType: 'DAILY',
    hour: 2, minute: 0, intervalHours: 1,
    dayOfWeek: 1, dayOfMonth: 1,
    sourceType: 'openapi',
  })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getScheduler()
      .then((res) => {
        setConfig(res.data)
        setForm({
          enabled:       res.data.enabled,
          scheduleType:  res.data.scheduleType || 'DAILY',
          hour:          res.data.hour,
          minute:        res.data.minute,
          intervalHours: res.data.intervalHours || 1,
          dayOfWeek:     res.data.dayOfWeek || 1,
          dayOfMonth:    res.data.dayOfMonth || 1,
          sourceType:    res.data.sourceType || 'openapi',
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const dis = !form.enabled

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>자동 수집 스케줄</h1>
        <span className={styles.adminBadge}>🔒 관리자 전용</span>
      </div>
      <p className={styles.desc}>설정한 주기에 맞춰 자동으로 데이터를 수집합니다.</p>

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
              <span className={styles.statusLabel}>주기</span>
              <span className={styles.statusValue}>
                {SCHEDULE_TYPES.find(t => t.value === (config.scheduleType || 'DAILY'))?.label}
              </span>
            </div>
          )}
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>마지막 실행</span>
            <span className={styles.statusValue}>{fmtDate(config.lastRunAt)}</span>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSave}>
        {/* 활성화 토글 */}
        <div className={styles.field}>
          <label className={styles.label}>자동 수집 활성화</label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        {/* 수집 유형 */}
        <div className={styles.field}>
          <label className={styles.label}>수집 유형</label>
          <select className={styles.select} value={form.sourceType}
            onChange={e => set('sourceType', e.target.value)} disabled={dis}>
            {SOURCE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {/* 스케줄 타입 */}
        <div className={styles.field}>
          <label className={styles.label}>스케줄 주기</label>
          <select className={styles.select} value={form.scheduleType}
            onChange={e => set('scheduleType', e.target.value)} disabled={dis}>
            {SCHEDULE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {/* HOURLY: 간격 */}
        {form.scheduleType === 'HOURLY' && (
          <div className={styles.field}>
            <label className={styles.label}>실행 간격</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="1" max="24"
                value={form.intervalHours} onChange={e => set('intervalHours', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>시간마다</span>
            </div>
            <p className={styles.hint}>1~24 사이로 설정하세요. (예: 6 = 매 6시간)</p>
          </div>
        )}

        {/* WEEKLY: 요일 */}
        {form.scheduleType === 'WEEKLY' && (
          <div className={styles.field}>
            <label className={styles.label}>요일</label>
            <div className={styles.dowRow}>
              {[1,2,3,4,5,6,7].map(d => (
                <button key={d} type="button"
                  className={`${styles.dowBtn} ${form.dayOfWeek === d ? styles.dowActive : ''}`}
                  onClick={() => set('dayOfWeek', d)} disabled={dis}>
                  {DOW_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MONTHLY: 날짜 */}
        {form.scheduleType === 'MONTHLY' && (
          <div className={styles.field}>
            <label className={styles.label}>매월 며칠</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="1" max="31"
                value={form.dayOfMonth} onChange={e => set('dayOfMonth', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>일</span>
            </div>
          </div>
        )}

        {/* 시각 (DAILY / WEEKLY / MONTHLY) */}
        {form.scheduleType !== 'HOURLY' && (
          <div className={styles.field}>
            <label className={styles.label}>실행 시각 (KST)</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="0" max="23"
                value={form.hour} onChange={e => set('hour', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>시</span>
              <input className={styles.timeInput} type="number" min="0" max="59"
                value={form.minute} onChange={e => set('minute', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>분</span>
            </div>
            <p className={styles.hint}>서버 시간 기준. KST = UTC+9 (서버가 UTC라면 9 빼서 입력)</p>
          </div>
        )}

        {/* HOURLY: 분 기준 */}
        {form.scheduleType === 'HOURLY' && (
          <div className={styles.field}>
            <label className={styles.label}>매 시간 몇 분에</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="0" max="59"
                value={form.minute} onChange={e => set('minute', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>분</span>
            </div>
          </div>
        )}

        {error && <div className={styles.errorBox}>❌ {error}</div>}
        {saved  && <div className={styles.savedBox}>✅ 저장되었습니다.</div>}

        <button className={styles.btnSave} type="submit" disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  )
}
