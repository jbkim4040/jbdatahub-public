import { useEffect, useState } from 'react'
import api from '../api'

const LEVEL_COLOR = { FATAL: '#dc2626', '5XX': '#ea580c', ERROR: '#ca8a04' }
const STATUS_COLOR = { new: '#3b82f6', resolved: '#16a34a', muted: '#9ca3af' }

export default function ErrorsPage() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState([])
  const [filter, setFilter] = useState({ status: '', level: '' })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.level) params.append('level', filter.level)
      const [list, st] = await Promise.all([
        api.get(`/errors?${params.toString()}`),
        api.get('/errors/stats'),
      ])
      setItems(list.data.items || [])
      setStats(st.data.buckets || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const act = async (id, action) => {
    await api.post(`/errors/${id}/${action}`)
    load()
  }

  const levelColor = (l) => LEVEL_COLOR[l] || '#6b7280'
  const statusColor = (s) => STATUS_COLOR[s] || '#6b7280'

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Error Alerts</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        {stats.map((b, i) => (
          <div key={i} className="bg-gray-100 px-3.5 py-2 rounded text-sm">
            <strong style={{ color: levelColor(b.level) }}>{b.level}</strong>
            <span className="ml-1.5" style={{ color: statusColor(b.status) }}>· {b.status}</span>
            <strong className="ml-2">{b.cnt}</strong>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <select className="border rounded px-2 py-1 text-sm"
                value={filter.level} onChange={e => setFilter({ ...filter, level: e.target.value })}>
          <option value="">All Levels</option>
          <option value="FATAL">FATAL</option>
          <option value="5XX">5XX</option>
          <option value="ERROR">ERROR</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm"
                value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Status</option>
          <option value="new">new</option>
          <option value="resolved">resolved</option>
          <option value="muted">muted</option>
        </select>
        <button onClick={load} disabled={loading}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Last Seen</th>
            <th className="p-2 text-left">Level</th>
            <th className="p-2 text-left">Server/Container</th>
            <th className="p-2 text-right">Count</th>
            <th className="p-2 text-left">Sample</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id} className="border-t border-gray-200">
              <td className="p-2 whitespace-nowrap">{new Date(it.last_seen).toLocaleString()}</td>
              <td className="p-2 font-semibold" style={{ color: levelColor(it.level) }}>{it.level}</td>
              <td className="p-2 font-mono">{it.server}/{it.container}</td>
              <td className="p-2 text-right">{it.occurrence_count}</td>
              <td className="p-2 font-mono text-xs max-w-[500px] overflow-hidden text-ellipsis"
                  title={it.sample_line}>{it.sample_line}</td>
              <td className="p-2" style={{ color: statusColor(it.status) }}>{it.status}</td>
              <td className="p-2 whitespace-nowrap">
                {it.status !== 'resolved' && <button onClick={() => act(it.id, 'resolve')} className="mr-1 px-1">✓</button>}
                {it.status !== 'muted' && <button onClick={() => act(it.id, 'mute')} className="px-1">🔕</button>}
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr><td colSpan={7} className="p-6 text-center text-gray-400">에러 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
