import { useState, useEffect } from 'react'
import { getScheduler, updateScheduler } from '../api/publicApi'
import { useI18n } from '../context/I18nContext'
import styles from './SchedulerPage.module.css'

const SOURCE_TYPES = [
  { value: 'openapi',       labelKey: 'collect.type.openapi' },
  { value: 'dataset',       labelKey: 'collect.type.dataset' },
  { value: 'file-data',     labelKey: 'collect.type.fileData' },
  { value: 'standard-data', labelKey: 'collect.type.standardData' },
]

const SCHEDULE_TYPES = [
  { value: 'DAILY',   labelKey: 'scheduler.type.daily' },
  { value: 'HOURLY',  labelKey: 'scheduler.type.hourly' },
  { value: 'WEEKLY',  labelKey: 'scheduler.type.weekly' },
  { value: 'MONTHLY', labelKey: 'scheduler.type.monthly' },
]

const DOW_KEYS = ['', 'scheduler.dow.mon', 'scheduler.dow.tue', 'scheduler.dow.wed',
                  'scheduler.dow.thu', 'scheduler.dow.fri', 'scheduler.dow.sat', 'scheduler.dow.sun']

export default function SchedulerPage() {
  const { t } = useI18n()
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

  const fmtDate = (iso) => {
    if (!iso) return t('scheduler.none')
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

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
      .catch(() => setError(t('scheduler.loadFail')))
  }, [t])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await updateScheduler(form)
      setConfig(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError(t('scheduler.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const dis = !form.enabled

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('scheduler.title')}</h1>
        <span className={styles.adminBadge}>{t('collect.adminOnly')}</span>
      </div>
      <p className={styles.desc}>{t('scheduler.desc')}</p>

      {config && (
        <div className={styles.statusCard}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>{t('scheduler.currentStatus')}</span>
            <span className={`${styles.statusBadge} ${config.enabled ? styles.on : styles.off}`}>
              {config.enabled ? t('scheduler.on') : t('scheduler.off')}
            </span>
          </div>
          {config.enabled && (
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>{t('scheduler.cycle')}</span>
              <span className={styles.statusValue}>
                {(() => {
                  const st = SCHEDULE_TYPES.find(s => s.value === (config.scheduleType || 'DAILY'))
                  return st ? t(st.labelKey) : ''
                })()}
              </span>
            </div>
          )}
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>{t('scheduler.lastRun')}</span>
            <span className={styles.statusValue}>{fmtDate(config.lastRunAt)}</span>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSave}>
        <div className={styles.field}>
          <label className={styles.label}>{t('scheduler.enable')}</label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t('scheduler.collectType')}</label>
          <select className={styles.select} value={form.sourceType}
            onChange={e => set('sourceType', e.target.value)} disabled={dis}>
            {SOURCE_TYPES.map(({ value, labelKey }) => <option key={value} value={value}>{t(labelKey)}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t('scheduler.cycleLabel')}</label>
          <select className={styles.select} value={form.scheduleType}
            onChange={e => set('scheduleType', e.target.value)} disabled={dis}>
            {SCHEDULE_TYPES.map(({ value, labelKey }) => <option key={value} value={value}>{t(labelKey)}</option>)}
          </select>
        </div>

        {form.scheduleType === 'HOURLY' && (
          <div className={styles.field}>
            <label className={styles.label}>{t('scheduler.interval')}</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="1" max="24"
                value={form.intervalHours} onChange={e => set('intervalHours', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>{t('scheduler.everyHours')}</span>
            </div>
            <p className={styles.hint}>{t('scheduler.intervalHint')}</p>
          </div>
        )}

        {form.scheduleType === 'WEEKLY' && (
          <div className={styles.field}>
            <label className={styles.label}>{t('scheduler.dowLabel')}</label>
            <div className={styles.dowRow}>
              {[1,2,3,4,5,6,7].map(d => (
                <button key={d} type="button"
                  className={`${styles.dowBtn} ${form.dayOfWeek === d ? styles.dowActive : ''}`}
                  onClick={() => set('dayOfWeek', d)} disabled={dis}>
                  {t(DOW_KEYS[d])}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.scheduleType === 'MONTHLY' && (
          <div className={styles.field}>
            <label className={styles.label}>{t('scheduler.monthDay')}</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="1" max="31"
                value={form.dayOfMonth} onChange={e => set('dayOfMonth', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>{t('scheduler.dayUnit')}</span>
            </div>
          </div>
        )}

        {form.scheduleType !== 'HOURLY' && (
          <div className={styles.field}>
            <label className={styles.label}>{t('scheduler.runTime')}</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="0" max="23"
                value={form.hour} onChange={e => set('hour', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>{t('scheduler.hourUnit')}</span>
              <input className={styles.timeInput} type="number" min="0" max="59"
                value={form.minute} onChange={e => set('minute', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>{t('scheduler.minUnit')}</span>
            </div>
            <p className={styles.hint}>{t('scheduler.timeHint')}</p>
          </div>
        )}

        {form.scheduleType === 'HOURLY' && (
          <div className={styles.field}>
            <label className={styles.label}>{t('scheduler.minuteOfHour')}</label>
            <div className={styles.timeRow}>
              <input className={styles.timeInput} type="number" min="0" max="59"
                value={form.minute} onChange={e => set('minute', Number(e.target.value))} disabled={dis} />
              <span className={styles.timeSep}>{t('scheduler.minUnit')}</span>
            </div>
          </div>
        )}

        {error && <div className={styles.errorBox}>❌ {error}</div>}
        {saved  && <div className={styles.savedBox}>{t('scheduler.saved')}</div>}

        <button className={styles.btnSave} type="submit" disabled={saving}>
          {saving ? t('scheduler.saving') : t('scheduler.save')}
        </button>
      </form>
    </div>
  )
}
