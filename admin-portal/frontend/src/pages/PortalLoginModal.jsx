import { useEffect, useState } from 'react'
import api from '../api'

export default function PortalLoginModal({ onClose, onSaved }) {
  const [mode, setMode] = useState('choose')  // choose | captcha | kakao
  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e)=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{margin:0,fontSize:18}}>data.go.kr 자동 로그인</h2>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>
        {mode === 'choose' && <Choose onPick={setMode} />}
        {mode === 'captcha' && <CaptchaFlow onBack={()=>setMode('choose')} onDone={(r)=>{onSaved&&onSaved(r);onClose&&onClose()}} />}
        {mode === 'kakao' && <KakaoFlow onBack={()=>setMode('choose')} onDone={(r)=>{onSaved&&onSaved(r);onClose&&onClose()}} />}
      </div>
    </div>
  )
}

function Choose({ onPick }) {
  return (
    <div>
      <p style={{fontSize:12,color:'#6b7280',marginBottom:16}}>
        data.go.kr 로그인 방법을 선택하세요. 발급된 cookie만 저장되며 ID/PW는 저장되지 않습니다.
      </p>
      <button onClick={()=>onPick('kakao')} style={{...primaryBtn,background:'#FEE500',color:'#000',marginBottom:8}}>
        🟡 카카오로 로그인
      </button>
      <button onClick={()=>onPick('captcha')} style={{...primaryBtn,background:'#3b82f6'}}>
        🔐 일반 아이디 로그인 (CAPTCHA)
      </button>
    </div>
  )
}

function CaptchaFlow({ onBack, onDone }) {
  const [step, setStep] = useState('loading')
  const [token, setToken] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [form, setForm] = useState({ username:'', password:'', captcha:'' })
  const [error, setError] = useState('')

  const load = async () => {
    setStep('loading'); setError('')
    try {
      const { data } = await api.post('/portal-login/prepare')
      setToken(data.token); setCaptcha(data.captcha); setStep('form')
    } catch (e) {
      setError(e?.response?.data?.detail || e.message); setStep('error')
    }
  }
  useEffect(()=>{ load() }, [])

  const submit = async (e) => {
    e.preventDefault(); setStep('submitting'); setError('')
    try {
      await api.post('/portal-login/submit', { token, ...form })
      onDone()
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message
      setError(msg)
      if (String(msg).includes('만료')) load(); else setStep('form')
    }
  }

  return (
    <div>
      <BackBar onBack={onBack} />
      {step === 'loading' && <div style={loading}>CAPTCHA 가져오는 중…</div>}
      {(step === 'form' || step === 'submitting') && (
        <form onSubmit={submit}>
          <input placeholder="data.go.kr 아이디" value={form.username}
            onChange={(e)=>setForm({...form, username:e.target.value})} style={input} required autoFocus />
          <input type="password" placeholder="비밀번호" value={form.password}
            onChange={(e)=>setForm({...form, password:e.target.value})} style={input} required />
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <img src={captcha} alt="captcha" style={{height:40,border:'1px solid #d1d5db',borderRadius:4}}/>
            <button type="button" onClick={load} style={refreshBtn}>새로고침</button>
          </div>
          <input placeholder="보안문자" value={form.captcha}
            onChange={(e)=>setForm({...form, captcha:e.target.value})} style={input} required />
          {error && <div style={errorBox}>{error}</div>}
          <button type="submit" disabled={step==='submitting'} style={primaryBtn}>
            {step==='submitting' ? '로그인 중…' : '로그인'}
          </button>
        </form>
      )}
      {step === 'error' && (<div><div style={errorBox}>{error}</div><button onClick={load} style={primaryBtn}>다시 시도</button></div>)}
    </div>
  )
}

function KakaoFlow({ onBack, onDone }) {
  const [step, setStep] = useState('loading')  // loading | login | waiting2fa | submitting | error | success
  const [token, setToken] = useState('')
  const [shot, setShot] = useState('')
  const [form, setForm] = useState({ kakao_id:'', kakao_pw:'', user_label:'' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const start = async () => {
    setStep('loading'); setError('')
    try {
      const { data } = await api.post('/portal-login/kakao/start')
      setToken(data.token); setShot(data.screenshot); setStep('login')
    } catch (e) {
      setError(e?.response?.data?.detail || e.message); setStep('error')
    }
  }
  useEffect(()=>{ start() }, [])

  const submit = async (e) => {
    e.preventDefault(); setStep('submitting'); setError('')
    try {
      const { data } = await api.post('/portal-login/kakao/submit', { token, ...form })
      if (data.ok) { onDone(data); return }
      if (data.stage === '2fa') {
        setShot(data.screenshot)
        setMessage(data.message || '추가 인증 필요')
        setStep('waiting2fa')
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message); setStep('login')
    }
  }

  const continueAfter2fa = async () => {
    setStep('submitting'); setError('')
    try {
      const { data } = await api.post('/portal-login/kakao/continue', { token, user_label: form.user_label })
      if (data.ok) { onDone(data); return }
      if (data.stage === '2fa') {
        setShot(data.screenshot); setMessage(data.message); setStep('waiting2fa')
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message); setStep('waiting2fa')
    }
  }

  return (
    <div>
      <BackBar onBack={onBack} />
      {step === 'loading' && <div style={loading}>카카오 로그인 페이지 진입 중… (10~20초)</div>}
      {step === 'login' && (
        <form onSubmit={submit}>
          <p style={{fontSize:12,color:'#6b7280',marginBottom:8}}>
            카카오 계정 ID/PW를 입력하세요. 최초 1회는 모바일 카카오톡으로 기기 인증이 필요할 수 있습니다.
          </p>
          {shot && <img src={shot} alt="page" style={preview} />}
          <input placeholder="카카오 이메일/ID" value={form.kakao_id}
            onChange={(e)=>setForm({...form, kakao_id:e.target.value})} style={input} required autoFocus />
          <input type="password" placeholder="카카오 비밀번호" value={form.kakao_pw}
            onChange={(e)=>setForm({...form, kakao_pw:e.target.value})} style={input} required />
          <input placeholder="식별용 라벨 (선택, 예: yena_kakao)" value={form.user_label}
            onChange={(e)=>setForm({...form, user_label:e.target.value})} style={input} />
          {error && <div style={errorBox}>{error}</div>}
          <button type="submit" style={{...primaryBtn,background:'#FEE500',color:'#000'}}>카카오 로그인</button>
        </form>
      )}
      {step === 'waiting2fa' && (
        <div>
          <div style={{padding:8,background:'#fef3c7',color:'#92400e',borderRadius:4,fontSize:12,marginBottom:8}}>
            ⚠️ {message}<br/>모바일 카카오톡에서 인증을 완료한 뒤 아래 '계속' 버튼을 누르세요.
          </div>
          {shot && <img src={shot} alt="page" style={preview} />}
          {error && <div style={errorBox}>{error}</div>}
          <button onClick={continueAfter2fa} style={primaryBtn}>계속 (인증 완료)</button>
        </div>
      )}
      {step === 'submitting' && <div style={loading}>처리 중…</div>}
      {step === 'error' && (<div><div style={errorBox}>{error}</div><button onClick={start} style={primaryBtn}>다시 시도</button></div>)}
    </div>
  )
}

function BackBar({ onBack }) {
  return <button onClick={onBack} style={{background:'none',border:'none',color:'#6b7280',fontSize:12,marginBottom:8,cursor:'pointer'}}>← 다른 방법</button>
}

const overlay = { position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }
const panel = { background:'#fff',padding:20,borderRadius:8,width:420,maxWidth:'90vw',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 10px 40px rgba(0,0,0,.2)' }
const closeBtn = { background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#6b7280' }
const input = { width:'100%',padding:'8px 10px',marginBottom:8,border:'1px solid #d1d5db',borderRadius:4,fontSize:13,boxSizing:'border-box' }
const primaryBtn = { width:'100%',padding:'10px',background:'#2563eb',color:'#fff',border:'none',borderRadius:4,fontWeight:600,cursor:'pointer',fontSize:14 }
const refreshBtn = { padding:'6px 10px',fontSize:11,background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:4,cursor:'pointer' }
const errorBox = { padding:8,background:'#fef2f2',color:'#dc2626',borderRadius:4,fontSize:12,marginBottom:8 }
const loading = { textAlign:'center',padding:20,color:'#6b7280' }
const preview = { width:'100%',maxHeight:240,objectFit:'contain',border:'1px solid #e5e7eb',borderRadius:4,marginBottom:8 }
