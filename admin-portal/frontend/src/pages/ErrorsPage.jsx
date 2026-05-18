import { useEffect, useState } from 'react'
import api from '../api'

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

  const levelColor = (l) => ({FATAL:'#dc2626', '5XX':'#ea580c', ERROR:'#ca8a04'}[l] || '#6b7280')
  const statusColor = (s) => ({new:'#3b82f6', resolved:'#16a34a', muted:'#9ca3af'}[s] || '#6b7280')

  return (
    <div style={{padding:24}}>
      <h1 style={{marginBottom:16}}>Error Alerts</h1>

      <div style={{display:'flex', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        {stats.map((b,i) => (
          <div key={i} style={{background:'#f3f4f6', padding:'8px 14px', borderRadius:6, fontSize:13}}>
            <strong style={{color:levelColor(b.level)}}>{b.level}</strong>
            <span style={{color:statusColor(b.status), marginLeft:6}}>· {b.status}</span>
            <strong style={{marginLeft:8}}>{b.cnt}</strong>
          </div>
        ))}
      </div>

      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <select value={filter.level} onChange={e=>setFilter({...filter,level:e.target.value})}>
          <option value="">All Levels</option>
          <option value="FATAL">FATAL</option>
          <option value="5XX">5XX</option>
          <option value="ERROR">ERROR</option>
        </select>
        <select value={filter.status} onChange={e=>setFilter({...filter,status:e.target.value})}>
          <option value="">All Status</option>
          <option value="new">new</option>
          <option value="resolved">resolved</option>
          <option value="muted">muted</option>
        </select>
        <button onClick={load} disabled={loading}>{loading?'Loading…':'Refresh'}</button>
      </div>

      <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
        <thead style={{background:'#f9fafb'}}>
          <tr>
            <th style={{textAlign:'left', padding:8}}>Last Seen</th>
            <th style={{textAlign:'left', padding:8}}>Level</th>
            <th style={{textAlign:'left', padding:8}}>Server/Container</th>
            <th style={{textAlign:'right', padding:8}}>Count</th>
            <th style={{textAlign:'left', padding:8}}>Sample</th>
            <th style={{textAlign:'left', padding:8}}>Status</th>
            <th style={{padding:8}}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id} style={{borderTop:'1px solid #e5e7eb'}}>
              <td style={{padding:8, whiteSpace:'nowrap'}}>{new Date(it.last_seen).toLocaleString()}</td>
              <td style={{padding:8, color:levelColor(it.level), fontWeight:600}}>{it.level}</td>
              <td style={{padding:8, fontFamily:'monospace'}}>{it.server}/{it.container}</td>
              <td style={{padding:8, textAlign:'right'}}>{it.occurrence_count}</td>
              <td style={{padding:8, fontFamily:'monospace', fontSize:11,
                          maxWidth:500, overflow:'hidden', textOverflow:'ellipsis'}}
                  title={it.sample_line}>{it.sample_line}</td>
              <td style={{padding:8, color:statusColor(it.status)}}>{it.status}</td>
              <td style={{padding:8, whiteSpace:'nowrap'}}>
                {it.status !== 'resolved' && <button onClick={()=>act(it.id,'resolve')} style={{marginRight:4}}>✓</button>}
                {it.status !== 'muted' && <button onClick={()=>act(it.id,'mute')}>🔕</button>}
              </td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={7} style={{padding:24, textAlign:'center', color:'#9ca3af'}}>에러 없음</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
