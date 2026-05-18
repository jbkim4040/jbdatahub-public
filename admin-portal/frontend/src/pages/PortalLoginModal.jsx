import { useEffect, useState } from 'react'
import api from '../api'

export default function PortalLoginModal({ onClose, onSaved }) {
  const [step, setStep] = useState('loading')      // loading | form | submitting | error
  const [token, setToken] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [form, setForm] = useState({ username: '', password: '', captcha: '' })
  const [error, setError] = useState('')

  const loadCaptcha = async () => {
    setStep('loading')
    setError('')
    try {
      const { data } = await api.post('/portal-login/prepare')
      setToken(data.token)
      setCaptcha(data.captcha)
      setStep('form')
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
      setStep('error')
    }
  }

  useEffect(() => { loadCaptcha() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setStep('submitting')
    setError('')
    try {
      await api.post('/portal-login/submit', { token, ...form })
      onSaved && onSaved()
      onClose && onClose()
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message
      setError(msg)
      if (msg.includes('token 만료') || msg.includes('410')) {
        loadCaptcha()
      } else {
        setStep('form')
      }
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e)=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{margin:0,fontSize:18}}>data.go.kr 자동 로그인</h2>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <p style={{fontSize:12,color:'#6b7280',marginBottom:12}}>
          ID/PW + CAPTCHA 한 번 입력 → cookie 1시간 자동 갱신.<br/>
          이 정보는 저장되지 않고, 발급된 세션 cookie만 DB에 보관됩니다.
        </p>

        {step === 'loading' && <div style={loading}>CAPTCHA 가져오는 중…</div>}

        {(step === 'form' || step === 'submitting') && (
          <form onSubmit={submit}>
            <input
              autoFocus
              placeholder="data.go.kr 아이디"
              value={form.username}
              onChange={(e)=>setForm({...form, username: e.target.value})}
              style={input} required
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={form.password}
              onChange={(e)=>setForm({...form, password: e.target.value})}
              style={input} required
            />
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
              <img src={captcha} alt="captcha" style={{height:40,border:'1px solid #d1d5db',borderRadius:4}}/>
              <button type="button" onClick={loadCaptcha}
                style={{padding:'6px 10px',fontSize:11,background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:4,cursor:'pointer'}}>
                새로고침
              </button>
            </div>
            <input
              placeholder="보안문자"
              value={form.captcha}
              onChange={(e)=>setForm({...form, captcha: e.target.value})}
              style={input} required
            />
            {error && <div style={errorBox}>{error}</div>}
            <button type="submit" disabled={step==='submitting'} style={primaryBtn}>
              {step==='submitting' ? '로그인 중…' : '로그인'}
            </button>
          </form>
        )}

        {step === 'error' && (
          <div>
            <div style={errorBox}>{error}</div>
            <button onClick={loadCaptcha} style={primaryBtn}>다시 시도</button>
          </div>
        )}
      </div>
    </div>
  )
}

const overlay = { position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }
const panel = { background:'#fff',padding:20,borderRadius:8,width:380,maxWidth:'90vw',boxShadow:'0 10px 40px rgba(0,0,0,.2)' }
const closeBtn = { background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#6b7280' }
const input = { width:'100%',padding:'8px 10px',marginBottom:8,border:'1px solid #d1d5db',borderRadius:4,fontSize:13,boxSizing:'border-box' }
const primaryBtn = { width:'100%',padding:'10px',background:'#2563eb',color:'#fff',border:'none',borderRadius:4,fontWeight:600,cursor:'pointer',fontSize:14 }
const errorBox = { padding:8,background:'#fef2f2',color:'#dc2626',borderRadius:4,fontSize:12,marginBottom:8 }
const loading = { textAlign:'center',padding:20,color:'#6b7280' }
