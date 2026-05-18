import { useState } from 'react'
import api from '../api'

export default function SubscribeModal({ onClose, onCreated, defaultListId = '', defaultListTitle = '' }) {
  const [form, setForm] = useState({
    list_id: defaultListId,
    operation_seq: '',
    usage_purpose: 'jb-workspace 통합 데이터 허브 운영 - 공공데이터 통합 검색 및 분석',
    purpose_code: 'WEB',
    daily_use_expect: 1000,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const body = {
        list_id: form.list_id.trim(),
        usage_purpose: form.usage_purpose,
        purpose_code: form.purpose_code,
        daily_use_expect: parseInt(form.daily_use_expect) || 1000,
      }
      if (form.operation_seq) body.operation_seq = parseInt(form.operation_seq)
      const { data } = await api.post('/subscription/request', body)
      onCreated && onCreated(data)
      onClose && onClose()
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ margin:0, fontSize:18 }}>새 자동 신청 등록</h2>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <form onSubmit={submit}>
          <label style={lbl}>list_id (필수)</label>
          <input value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })}
                 placeholder="예: 15000124" style={input} required />
          {defaultListTitle && <div style={hint}>{defaultListTitle}</div>}

          <label style={lbl}>operation_seq (선택, 단일 op 신청 시)</label>
          <input value={form.operation_seq} onChange={(e) => setForm({ ...form, operation_seq: e.target.value })}
                 placeholder="예: 17576 (비우면 전체)" style={input} />

          <label style={lbl}>활용 목적 코드</label>
          <select value={form.purpose_code} onChange={(e) => setForm({ ...form, purpose_code: e.target.value })} style={input}>
            <option value="WEB">웹</option>
            <option value="APP">앱</option>
            <option value="RESEARCH">연구</option>
            <option value="OTHER">기타</option>
          </select>

          <label style={lbl}>일일 예상 사용량</label>
          <input type="number" min="1" value={form.daily_use_expect}
                 onChange={(e) => setForm({ ...form, daily_use_expect: e.target.value })} style={input} />

          <label style={lbl}>사용 목적 설명</label>
          <textarea value={form.usage_purpose} onChange={(e) => setForm({ ...form, usage_purpose: e.target.value })}
                    rows={3} style={{ ...input, fontFamily:'inherit' }} required />

          {error && <div style={errorBox}>{error}</div>}

          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? '등록 중…' : '신청 등록 (즉시 자동 제출)'}
          </button>
          <p style={hint}>
            등록 즉시 백엔드가 data.go.kr에 자동 제출합니다. 세션 cookie가 유효해야 성공합니다.
          </p>
        </form>
      </div>
    </div>
  )
}

const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }
const panel = { background:'#fff', padding:20, borderRadius:8, width:420, maxWidth:'90vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 10px 40px rgba(0,0,0,.2)' }
const closeBtn = { background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#6b7280' }
const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4, marginTop:8 }
const input = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:4, fontSize:13, boxSizing:'border-box', marginBottom:4 }
const hint = { fontSize:11, color:'#9ca3af', marginTop:4, marginBottom:6 }
const primaryBtn = { width:'100%', padding:'10px', background:'#2563eb', color:'#fff', border:'none', borderRadius:4, fontWeight:600, cursor:'pointer', fontSize:14, marginTop:12 }
const errorBox = { padding:8, background:'#fef2f2', color:'#dc2626', borderRadius:4, fontSize:12, marginTop:8 }
