import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, opts = {}) => {
    const id = Date.now() + Math.random()
    const t = {
      id,
      message,
      type: opts.type || 'info', // info | success | warn | error
      duration: opts.duration ?? 3000,
    }
    setToasts((arr) => [...arr, t])
    if (t.duration > 0) {
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), t.duration)
    }
    return id
  }, [])

  const dismiss = useCallback((id) => setToasts((arr) => arr.filter((x) => x.id !== id)), [])

  // 전역 toast (window.toast) — 컴포넌트 밖에서도 호출 가능
  useEffect(() => {
    window.toast = {
      info: (m, o) => show(m, { ...o, type: 'info' }),
      success: (m, o) => show(m, { ...o, type: 'success' }),
      warn: (m, o) => show(m, { ...o, type: 'warn' }),
      error: (m, o) => show(m, { ...o, type: 'error' }),
    }
    return () => { delete window.toast }
  }, [show])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div style={containerStyle}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...toastStyle, ...styleByType[t.type] }} onClick={() => dismiss(t.id)}>
            <span style={{ marginRight: 8 }}>{iconByType[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={(e) => { e.stopPropagation(); dismiss(t.id) }} style={closeBtn}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const containerStyle = {
  position: 'fixed', top: 16, right: 16, zIndex: 9999,
  display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380,
}
const toastStyle = {
  display: 'flex', alignItems: 'center', padding: '12px 16px',
  borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.15)',
  fontSize: 14, fontWeight: 500, cursor: 'pointer',
  animation: 'slideIn 0.2s ease-out',
}
const styleByType = {
  info:    { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  success: { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' },
  warn:    { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  error:   { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
const iconByType = { info: 'ℹ️', success: '✓', warn: '⚠️', error: '✕' }
const closeBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 18, lineHeight: 1, color: 'currentColor', opacity: 0.7,
  marginLeft: 8, padding: 0,
}
