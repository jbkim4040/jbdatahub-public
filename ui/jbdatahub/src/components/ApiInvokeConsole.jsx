import { useEffect, useRef, useState } from 'react'
import { getApiDetail, invokeApi } from '../api/publicApi'

/*
 * API 호출 콘솔
 * 목록 화면의 'API 호출' 버튼이 띄우는 모달.
 * 사용자가 자신의 공공데이터포털 인증키로 해당 API를 직접 호출하고 응답을 확인한다.
 */

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
const labelStyle = {
  fontSize: 12, fontWeight: 600, color: '#475569',
  display: 'block', marginBottom: 4,
}
const inputStyle = {
  width: '100%', padding: '7px 9px', fontSize: 13,
  border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box',
}

export default function ApiInvokeConsole({ listId, listTitle, onClose }) {
  const [operations, setOperations] = useState([])
  const [opLoading, setOpLoading]   = useState(true)
  const [selectedSeq, setSelectedSeq] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [serviceKey, setServiceKey]   = useState('')
  const [params, setParams]   = useState([{ id: 1, key: '', value: '' }])
  const nextParamId = useRef(2)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  // 오퍼레이션 목록 로드 (호출 대상 선택용)
  useEffect(() => {
    let cancelled = false
    getApiDetail(listId)
      .then(r => {
        if (cancelled) return
        const ops = r.data?.operations || []
        setOperations(ops)
        if (ops.length > 0) setSelectedSeq(String(ops[0].operationSeq))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOpLoading(false) })
    return () => { cancelled = true }
  }, [listId])

  const hasOps = operations.length > 0

  const updateParam = (i, field, val) =>
    setParams(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)))
  const addParam = () => setParams(prev => [...prev, { id: nextParamId.current++, key: '', value: '' }])
  const removeParam = (i) => setParams(prev => prev.filter((_, idx) => idx !== i))

  const run = async () => {
    setError(''); setResult(null)
    if (!serviceKey.trim()) { setError('인증키(serviceKey)를 입력하세요.'); return }
    if (hasOps && !selectedSeq) { setError('오퍼레이션을 선택하세요.'); return }
    if (!hasOps && !endpointUrl.trim()) { setError('엔드포인트 URL을 입력하세요.'); return }

    const paramObj = {}
    params.forEach(p => { if (p.key.trim()) paramObj[p.key.trim()] = p.value })

    const body = {
      serviceKey: serviceKey.trim(),
      params: paramObj,
      ...(hasOps ? { operationSeq: Number(selectedSeq) } : { endpointUrl: endpointUrl.trim() }),
    }

    setRunning(true)
    try {
      const r = await invokeApi(body)
      setResult(r.data)
    } catch (e) {
      // 백엔드는 실패 시 400 + { status:'fail', message } 형태로 응답
      const data = e?.response?.data
      if (data && data.status) setResult(data)
      else setError(data?.message || data?.error || e.message || '호출에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  const prettyBody = (body) => {
    if (!body) return ''
    try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc',
        }}>
          <span style={{
            fontWeight: 700, color: '#0f172a', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            🔌 API 호출 — {listTitle}
          </span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', fontSize: 18,
            color: '#64748b', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* 본문 */}
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

          {/* 호출 대상 */}
          {opLoading ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>오퍼레이션 불러오는 중…</div>
          ) : hasOps ? (
            <div>
              <label style={labelStyle}>오퍼레이션</label>
              <select style={inputStyle} value={selectedSeq} onChange={e => setSelectedSeq(e.target.value)}>
                {operations.map(op => (
                  <option key={op.operationSeq} value={op.operationSeq}>
                    {op.operationNm || '(이름 없음)'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>엔드포인트 URL (저장된 오퍼레이션 없음 — 직접 입력)</label>
              <input style={inputStyle} value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)}
                placeholder="https://apis.data.go.kr/..." />
            </div>
          )}

          {/* 인증키 */}
          <div>
            <label style={labelStyle}>인증키 (serviceKey · Encoding)</label>
            <input style={inputStyle} type="password" autoComplete="off"
              value={serviceKey} onChange={e => setServiceKey(e.target.value)}
              placeholder="data.go.kr Encoding 인증키" />
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
          {result && (
            <div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: result.status === 'success' ? '#15803d' : '#b91c1c' }}>
                  {result.status === 'success' ? '✓ 성공' : '✕ 실패'}
                </span>
                {result.httpStatus != null && <span style={{ color: '#475569' }}>HTTP {result.httpStatus}</span>}
                {result.elapsedMs != null && <span style={{ color: '#64748b' }}>{result.elapsedMs}ms</span>}
                {result.contentType && <span style={{ color: '#64748b' }}>{result.contentType}</span>}
              </div>
              {result.message && (
                <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 6 }}>{result.message}</div>
              )}
              {result.requestUrl && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, wordBreak: 'break-all' }}>
                  {result.requestUrl}
                </div>
              )}
              {result.body && (
                <pre style={{
                  fontSize: 12, background: '#0f172a', color: '#e2e8f0',
                  padding: 12, borderRadius: 6, overflowX: 'auto', maxHeight: 300, margin: 0,
                }}>{prettyBody(result.body)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
