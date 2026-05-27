import { useState, useEffect } from 'react'
import { getScheduler, updateScheduler } from '../api/datahubApi'
import { fmtDate } from '../utils/dateFormatter'

const SOURCE_TYPES = [
  { value: 'openapi',       label: 'OpenAPI' },
  { value: 'dataset',       label: '데이터셋' },
  { value: 'file-data',     label: '파일데이터' },
  { value: 'standard-data', label: '표준데이터' },
]

const SCHEDULE_TYPES = [
  { value: 'DAILY',   label: '매일' },
  { value: 'HOURLY',  label: '매시간' },
  { value: 'WEEKLY',  label: '매주' },
  { value: 'MONTHLY', label: '매월' },
]

const DOW = ['', '월', '화', '수', '목', '금', '토', '일']

const fmtDateOrNone = (iso) => fmtDate(iso, '없음')

export default function DataSchedulerPage() {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({
    enabled: false, scheduleType: 'DAILY',
    hour: 2, minute: 0, intervalHours: 1,
    dayOfWeek: 1, dayOfMonth: 1,
    sourceType: 'openapi',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState(null)

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
      .catch(() => setError('스케줄러 설정을 불러오지 못했습니다.'))
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
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">수집 스케줄</h1>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">관리자 전용</span>
        </div>
        <p className="text-sm text-gray-500">자동 수집 스케줄을 설정합니다.</p>
      </div>

      {config && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">현재 상태</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
              {config.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          {config.enabled && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">주기</span>
              <span className="text-gray-800 font-medium">
                {SCHEDULE_TYPES.find(s => s.value === (config.scheduleType || 'DAILY'))?.label ?? ''}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">마지막 실행</span>
            <span className="text-gray-800">{fmtDateOrNone(config.lastRunAt)}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 bg-white border border-gray-200 rounded-xl p-5">
        {/* 활성화 토글 */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">스케줄 활성화</label>
          <button
            type="button"
            onClick={() => set('enabled', !form.enabled)}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${form.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* 수집 유형 */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">수집 유형</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            value={form.sourceType} onChange={e => set('sourceType', e.target.value)} disabled={dis}
          >
            {SOURCE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {/* 주기 */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">주기</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            value={form.scheduleType} onChange={e => set('scheduleType', e.target.value)} disabled={dis}
          >
            {SCHEDULE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {/* 매시간 — 간격 */}
        {form.scheduleType === 'HOURLY' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">실행 간격</label>
            <div className="flex items-center gap-2">
              <input
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                type="number" min="1" max="24"
                value={form.intervalHours} onChange={e => set('intervalHours', Number(e.target.value))} disabled={dis}
              />
              <span className="text-sm text-gray-500">시간마다</span>
            </div>
            <p className="text-xs text-gray-400">매시 정각 기준으로 간격이 적용됩니다.</p>
          </div>
        )}

        {/* 매주 — 요일 */}
        {form.scheduleType === 'WEEKLY' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">요일</label>
            <div className="flex gap-1.5">
              {[1,2,3,4,5,6,7].map(d => (
                <button
                  key={d} type="button"
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${form.dayOfWeek === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} disabled:opacity-40`}
                  onClick={() => set('dayOfWeek', d)} disabled={dis}
                >
                  {DOW[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 매월 — 일 */}
        {form.scheduleType === 'MONTHLY' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">실행 일</label>
            <div className="flex items-center gap-2">
              <input
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                type="number" min="1" max="31"
                value={form.dayOfMonth} onChange={e => set('dayOfMonth', Number(e.target.value))} disabled={dis}
              />
              <span className="text-sm text-gray-500">일</span>
            </div>
          </div>
        )}

        {/* 실행 시각 */}
        {form.scheduleType !== 'HOURLY' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">실행 시각</label>
            <div className="flex items-center gap-2">
              <input
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                type="number" min="0" max="23"
                value={form.hour} onChange={e => set('hour', Number(e.target.value))} disabled={dis}
              />
              <span className="text-sm text-gray-500">시</span>
              <input
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                type="number" min="0" max="59"
                value={form.minute} onChange={e => set('minute', Number(e.target.value))} disabled={dis}
              />
              <span className="text-sm text-gray-500">분</span>
            </div>
            <p className="text-xs text-gray-400">서버 기준 시각 (UTC+9)</p>
          </div>
        )}

        {/* 매시간 — 분 */}
        {form.scheduleType === 'HOURLY' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">실행 분</label>
            <div className="flex items-center gap-2">
              <input
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                type="number" min="0" max="59"
                value={form.minute} onChange={e => set('minute', Number(e.target.value))} disabled={dis}
              />
              <span className="text-sm text-gray-500">분</span>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">❌ {error}</div>}
        {saved && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">✅ 저장되었습니다.</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  )
}
