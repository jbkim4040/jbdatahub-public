import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getApiDetail, invokeApi, saveServiceKey } from '../api/publicApi'

const SERVICE_KEY_ALIASES = new Set(['servicekey', 'service_key', 'serviceKey'])
const PARAM_DEFAULTS = { numofrows: '10', pageNo: '1', pageno: '1', _type: 'json', datatype: 'JSON' }
const isHttpSuccess = (r) =>
  r?.status === 'success' && (r.httpStatus == null || (r.httpStatus >= 200 && r.httpStatus < 300))
const safeUrl = (url) => (url && /^https?:\/\//.test(url) ? url : '')

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const panel = {
  width: 'min(720px, 96vw)', maxHeight: '92vh',
  background: '#fff', borderRadius: 10, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
}
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }
const inputStyle = {
  width: '100%', padding: '7px 9px', fontSize: 13,
  border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box',
}

function parseParams(rawEn) {
  if (!rawEn) return []
  return rawEn.split(',')
    .map(s => s.trim())
    .filter(s => s && !SERVICE_KEY_ALIASES.has(s.toLowerCase()))
    .map((key, i) => ({
      id: i + 1,
      key,
      value: PARAM_DEFAULTS[key] ?? PARAM_DEFAULTS[key.toLowerCase()] ?? '',
    }))
}

export default function ApiInvokeConsole({ listId, listTitle, onClose }) {
  const [operations, setOperations] = useState([])
  const [opLoading, setOpLoading]   = useState(true)
  // 'select': 오퍼레이션 선택 화면 | 'invoke': 파라미터 입력 + 실행 화면
  const [step, setStep]             = useState('select')
  const [selectedOp, setSelectedOp] = useState(null)
  const [endpointUrl, setEndpointUrl] = useState('')
  const [serviceKey, setServiceKey]   = useState('')
  const [keySaved, setKeySaved]       = useState(false)
  const [keySaving, setKeySaving]     = useState(false)
  const [params, setParams]   = useState([{ id: 1, key: '', value: '' }])
  const nextParamId = useRef(2)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  // 저장된 serviceKey 불러오기 — axios 직접 호출로 전역 인터셉터(logout 흐름) 우회
  useEffect(() => {
    axios.get('/api/auth/me', { withCredentials: true })
      .then(r => { if (r.data?.serviceKey) setServiceKey(r.data.serviceKey) })
      .catch(() => {})
  }, [])

  // 오퍼레이션 목록 로드
  useEffect(() => {
    let cancelled = false
    getApiDetail(listId)
      .then(r => {
        if (cancelled) return
        const ops = r.data?.operations || []
        setOperations(ops)
        // 오퍼레이션이 1개 이하면 선택 화면 건너뜀
        if (ops.length === 1) {
          selectOp(ops[0])
        } else if (ops.length === 0) {
          setStep('invoke')
        }
      })
      .catch(() => { if (!cancelled) setStep('invoke') })
      .finally(() => { if (!cancelled) setOpLoading(false) })
    return () => { cancelled = true }
  }, [listId])

  const selectOp = (op) => {
    setSelectedOp(op)
    const defaultParams = parseParams(op.requestParamNmEn)
    if (defaultParams.length > 0) {
      nextParamId.current = defaultParams.length + 1
      setParams(defaultParams)
    } else {
      setParams([{ id: 1, key: '', value: '' }])
      nextParamId.current = 2
    }
    setResult(null)
    setError('')
    setStep('invoke')
  }

  const handleSaveKey = async () => {
    if (!serviceKey.trim()) return
    setKeySaving(true)
    try {
      await saveServiceKey(serviceKey.trim())
      setKeySaved(true)
      setTimeout(() => setKeySaved(false), 2000)
    } catch (e) {
      const status = e?.response?.status
      setError(status === 401 || status === 403
        ? '저장하려면 로그인이 필요합니다.'
        : '인증키 저장에 실패했습니다. 다시 시도해주세요.')
    } finally { setKeySaving(false) }
  }

  const updateParam = (i, field, val) =>
    setParams(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)))
  const addParam = () =>
    setParams(prev => [...prev, { id: nextParamId.current++, key: '', value: '' }])
  const removeParam = (i) => setParams(prev => prev.filter((_, idx) => idx !== i))

  const run = async () => {
    setError(''); setResult(null)
    if (!serviceKey.trim()) { setError('인증키(serviceKey)를 입력하세요.'); return }
    if (operations.length > 0 && !selectedOp) { setError('오퍼레이션을 선택하세요.'); return }
    if (operations.length === 0 && !endpointUrl.trim()) { setError('엔드포인트 URL을 입력하세요.'); return }

    const paramObj = {}
    params.forEach(p => { if (p.key.trim()) paramObj[p.key.trim()] = p.value })

    const body = {
      serviceKey: serviceKey.trim(),
      params: paramObj,
      ...(selectedOp ? { operationSeq: selectedOp.operationSeq } : { endpointUrl: endpointUrl.trim() }),
    }

    setRunning(true)
    try {
      const r = await invokeApi(body)
      setResult(r.data)
    } catch (e) {
      const status = e?.response?.status
      if (status === 401 || status === 403) {
        setError('API를 호출하려면 로그인이 필요합니다.')
      } else {
        const data = e?.response?.data
        if (data && data.status) setResult(data)
        else setError(data?.message || data?.error || e.message || '호출에 실패했습니다.')
      }
    } finally {
      setRunning(false)
    }
  }

  const prettyBody = (body) => {
    if (!body) return ''
    try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
  }

  const resultBlock = useMemo(() => {
    if (!result) return null
    const ok = isHttpSuccess(result)
    return (
      <div style={{
        border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '8px 12px', flexWrap: 'wrap',
          background: ok ? '#f0fdf4' : '#fef2f2',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: ok ? '#15803d' : '#b91c1c' }}>
            {ok ? '✓ 성공' : '✕ 실패'}
          </span>
          {result.httpStatus != null && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
              background: ok ? '#dcfce7' : '#fee2e2',
              color: ok ? '#166534' : '#991b1b',
            }}>
              HTTP {result.httpStatus}
            </span>
          )}
          {result.elapsedMs != null && (
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
              {result.elapsedMs}ms
            </span>
          )}
          {result.contentType && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{result.contentType}</span>
          )}
        </div>
        {result.message && (
          <div style={{ fontSize: 12, color: '#b91c1c', padding: '6px 12px', background: '#fef2f2' }}>
            {result.message}
          </div>
        )}
        {safeUrl(result.requestUrl) && (
          <div style={{
            fontSize: 11, color: '#94a3b8', padding: '4px 12px',
            borderTop: '1px solid #f1f5f9', wordBreak: 'break-all',
          }}>
            {safeUrl(result.requestUrl)}
          </div>
        )}
        {result.body && (
          <pre style={{
            fontSize: 12, background: '#0f172a', color: '#e2e8f0',
            padding: 12, margin: 0, overflowX: 'auto',
            maxHeight: ok ? 400 : 200,
            overflowY: 'auto',
          }}>{prettyBody(result.body)}</pre>
        )}
        {ok && !result.body && (
          <div style={{ fontSize: 12, color: '#64748b', padding: '8px 12px' }}>
            응답 바디 없음
          </div>
        )}
      </div>
    )
  }, [result])

  const canGoBack = operations.length > 1

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc',
        }}>
          {step === 'invoke' && canGoBack && (
            <button onClick={() => { setStep('select'); setResult(null); setError('') }} style={{
              background: 'transparent', border: 'none', fontSize: 14,
              color: '#2563eb', cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }}>← 뒤로</button>
          )}
          <span style={{
            fontWeight: 700, color: '#0f172a', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            🔌 {step === 'invoke' && selectedOp
              ? `${selectedOp.operationNm || '(이름 없음)'}`
              : `API 호출 — ${listTitle}`}
          </span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', fontSize: 18,
            color: '#64748b', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* ── Step 1: 오퍼레이션 선택 ── */}
        {step === 'select' && (
          <div style={{ padding: 16, overflowY: 'auto' }}>
            {opLoading ? (
              <div style={{ fontSize: 13, color: '#64748b', padding: '24px 0', textAlign: 'center' }}>
                오퍼레이션 불러오는 중…
              </div>
            ) : operations.length === 0 ? (
              <div style={{ fontSize: 13, color: '#64748b' }}>등록된 오퍼레이션이 없습니다.</div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  호출할 오퍼레이션을 선택하세요.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {operations.map(op => (
                    <button
                      key={op.operationSeq}
                      onClick={() => selectOp(op)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        gap: 4, padding: '12px 14px', textAlign: 'left',
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                        cursor: 'pointer', transition: 'border-color .15s, background .15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {op.operationNm || '(이름 없음)'}
                      </span>
                      {op.operationUrl && (
                        <span style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>
                          {op.operationUrl}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: 파라미터 입력 + 실행 ── */}
        {step === 'invoke' && (
          <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 안내 */}
            <div style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '8px 10px' }}>
              본인의 공공데이터포털 인증키로 이 API를 직접 호출합니다. 키가 없다면{' '}
              <a href={`https://www.data.go.kr/data/${listId}/openapi.do`} target="_blank" rel="noreferrer"
                style={{ color: '#2563eb' }}>
                data.go.kr에서 활용신청 ↗
              </a>
              {' '}후 발급받으세요.
            </div>

            {/* 오퍼레이션 없을 때 직접 URL 입력 */}
            {operations.length === 0 && (
              <div>
                <label style={labelStyle}>엔드포인트 URL (저장된 오퍼레이션 없음 — 직접 입력)</label>
                <input style={inputStyle} value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)}
                  placeholder="https://apis.data.go.kr/..." />
              </div>
            )}

            {/* 인증키 */}
            <div>
              <label style={labelStyle}>인증키 (serviceKey · Encoding)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} type="password" autoComplete="off"
                  value={serviceKey} onChange={e => { setServiceKey(e.target.value); setKeySaved(false) }}
                  placeholder="data.go.kr Encoding 인증키" />
                <button onClick={handleSaveKey} disabled={keySaving || !serviceKey.trim()} style={{
                  padding: '0 12px', fontSize: 12, fontWeight: 600,
                  border: '1px solid #cbd5e1', borderRadius: 6,
                  background: keySaved ? '#dcfce7' : '#fff',
                  color: keySaved ? '#15803d' : '#475569',
                  cursor: keySaving || !serviceKey.trim() ? 'default' : 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {keySaved ? '✓ 저장됨' : keySaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>

            {/* 파라미터 */}
            <div>
              <label style={labelStyle}>요청 파라미터</label>
              {params.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="키 (예: numOfRows)"
                    value={p.key} onChange={e => updateParam(i, 'key', e.target.value)} />
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="값"
                    value={p.value} onChange={e => updateParam(i, 'value', e.target.value)} />
                  <button onClick={() => removeParam(i)} style={{
                    padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 6,
                    background: '#fff', cursor: 'pointer', color: '#64748b',
                  }}>−</button>
                </div>
              ))}
              <button onClick={addParam} style={{
                fontSize: 12, padding: '4px 10px', border: '1px dashed #cbd5e1',
                borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#475569',
              }}>+ 파라미터 추가</button>
            </div>

            {/* 실행 */}
            <button onClick={run} disabled={running} style={{
              padding: '9px 14px', fontSize: 13, fontWeight: 700,
              background: running ? '#93c5fd' : '#2563eb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: running ? 'default' : 'pointer',
            }}>
              {running ? '호출 중…' : '실행'}
            </button>

            {error && (
              <div style={{
                fontSize: 12, color: '#b91c1c', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 6, padding: '8px 10px',
              }}>{error}</div>
            )}

            {/* 결과 */}
            {resultBlock}
          </div>
        )}
      </div>
    </div>
  )
}
