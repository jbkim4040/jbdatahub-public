import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getApiDetail, invokeApi, saveServiceKey } from '../api/publicApi'
import styles from './ApiInvokeConsole.module.css'

const SERVICE_KEY_ALIASES = new Set(['servicekey', 'service_key', 'serviceKey'])
const PARAM_DEFAULTS = {
  numofrows: '10', numOfRows: '10', pageNo: '1', pageno: '1',
  _type: 'json', datatype: 'JSON',
  MobileOS: 'IOS', MobileApp: 'AppTest',
}
const isHttpSuccess = (r) =>
  r?.status === 'success' && (r.httpStatus == null || (r.httpStatus >= 200 && r.httpStatus < 300))
const safeUrl = (url) => (url && /^https?:\/\//.test(url) ? url : '')

function parseExamples(exampleJson) {
  if (!exampleJson) return {}
  try { return JSON.parse(exampleJson) } catch { return {} }
}

function parseParams(rawEn, requiredRaw, exampleJson) {
  if (!rawEn) return []
  const requiredSet = new Set(
    (requiredRaw || '').split(',').map(s => s.trim()).filter(Boolean)
  )
  const examples = parseExamples(exampleJson)
  return rawEn.split(',')
    .map(s => s.trim())
    .filter(s => s && !SERVICE_KEY_ALIASES.has(s.toLowerCase()))
    .map((key, i) => ({
      id: i + 1,
      key,
      required: requiredSet.has(key),
      value: PARAM_DEFAULTS[key] ?? PARAM_DEFAULTS[key.toLowerCase()] ?? examples[key] ?? '',
      placeholder: examples[key] ?? '',
    }))
}

export default function ApiInvokeConsole({ listId, listTitle, onClose }) {
  const [operations, setOperations] = useState([])
  const [opLoading, setOpLoading]   = useState(true)
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

  useEffect(() => {
    axios.get('/api/auth/me', { withCredentials: true })
      .then(r => { if (r.data?.serviceKey) setServiceKey(r.data.serviceKey) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    getApiDetail(listId)
      .then(r => {
        if (cancelled) return
        const ops = r.data?.operations || []
        setOperations(ops)
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
    const defaultParams = parseParams(op.requestParamNmEn, op.requiredParamNmEn, op.exampleParamNmEn)
    if (defaultParams.length > 0) {
      nextParamId.current = defaultParams.length + 1
      setParams(defaultParams)
    } else {
      setParams([{ id: 1, key: '', value: '' }])
      nextParamId.current = 2
    }
    setResult(null); setError(''); setStep('invoke')
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
    const hint401 = !ok && result.httpStatus === 401
      ? '인증키(serviceKey)가 유효하지 않거나 해당 API의 활용 신청이 필요합니다. data.go.kr에서 활용 신청 후 Encoding 키를 입력해 주세요.'
      : null
    const hint403 = !ok && result.httpStatus === 403
      ? '해당 API에 대한 접근 권한이 없습니다. data.go.kr에서 활용 신청 여부를 확인해 주세요.'
      : null
    return (
      <div className={`${styles.result} ${ok ? styles.resultSuccess : styles.resultFailure}`}>
        <div className={`${styles.resultHeader} ${ok ? styles.resultHeaderSuccess : styles.resultHeaderFailure}`}>
          <span className={`${styles.statusLabel} ${ok ? styles.statusSuccess : styles.statusFailure}`}>
            {ok ? '✓ 성공' : '✕ 실패'}
          </span>
          {result.httpStatus != null && (
            <span className={`${styles.httpBadge} ${ok ? styles.httpBadgeSuccess : styles.httpBadgeFailure}`}>
              HTTP {result.httpStatus}
            </span>
          )}
          {result.elapsedMs != null && <span className={styles.elapsed}>{result.elapsedMs}ms</span>}
          {result.contentType && <span className={styles.contentType}>{result.contentType}</span>}
        </div>
        {result.message && <div className={styles.resultMsg}>{result.message}</div>}
        {(hint401 || hint403) && <div className={styles.resultHint}>{hint401 || hint403}</div>}
        {!ok && result.body && (
          <pre className={styles.bodyError}>{prettyBody(result.body)}</pre>
        )}
        {ok && (
          <>
            {safeUrl(result.requestUrl) && (
              <div className={styles.requestUrl}>{safeUrl(result.requestUrl)}</div>
            )}
            {result.body
              ? <pre className={styles.bodySuccess}>{prettyBody(result.body)}</pre>
              : <div className={styles.noBody}>응답 바디 없음</div>
            }
          </>
        )}
      </div>
    )
  }, [result])

  const canGoBack = operations.length > 1

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={styles.header}>
          {step === 'invoke' && canGoBack && (
            <button className={styles.backBtn}
              onClick={() => { setStep('select'); setResult(null); setError('') }}>
              ← 뒤로
            </button>
          )}
          <span className={styles.headerTitle}>
            🔌 {step === 'invoke' && selectedOp
              ? `${selectedOp.operationNm || '(이름 없음)'}`
              : `API 호출 — ${listTitle}`}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Step 1: 오퍼레이션 선택 ── */}
        {step === 'select' && (
          <div className={styles.stepPane}>
            {opLoading ? (
              <div className={styles.loadingMsg}>오퍼레이션 불러오는 중…</div>
            ) : operations.length === 0 ? (
              <div className={styles.emptyMsg}>등록된 오퍼레이션이 없습니다.</div>
            ) : (
              <>
                <p className={styles.opHint}>호출할 오퍼레이션을 선택하세요.</p>
                <div className={styles.opList}>
                  {operations.map(op => (
                    <button key={op.operationSeq} className={styles.opBtn} onClick={() => selectOp(op)}>
                      <span className={styles.opBtnTitle}>{op.operationNm || '(이름 없음)'}</span>
                      {op.operationUrl && (
                        <span className={styles.opBtnUrl}>{op.operationUrl}</span>
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
          <div className={styles.invokePane}>
            <div className={styles.hint}>
              본인의 공공데이터포털 인증키로 이 API를 직접 호출합니다. 키가 없다면{' '}
              <a href={`https://www.data.go.kr/data/${listId}/openapi.do`} target="_blank" rel="noreferrer"
                className={styles.hintLink}>
                data.go.kr에서 활용신청 ↗
              </a>
              {' '}후 발급받으세요.
            </div>

            {operations.length === 0 && (
              <div>
                <label className={styles.label}>엔드포인트 URL (저장된 오퍼레이션 없음 — 직접 입력)</label>
                <input className={styles.input} value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)}
                  placeholder="https://apis.data.go.kr/..." />
              </div>
            )}

            <div>
              <label className={styles.label}>인증키 (serviceKey · Encoding)</label>
              <div className={styles.keyRow}>
                <input className={`${styles.input}`} style={{ flex: 1 }} type="password" autoComplete="off"
                  value={serviceKey} onChange={e => { setServiceKey(e.target.value); setKeySaved(false) }}
                  placeholder="data.go.kr Encoding 인증키" />
                <button
                  className={`${styles.saveBtn} ${keySaved ? styles.saveBtnSaved : ''}`}
                  onClick={handleSaveKey}
                  disabled={keySaving || !serviceKey.trim()}>
                  {keySaved ? '✓ 저장됨' : keySaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>

            <div>
              <label className={styles.label}>요청 파라미터</label>
              {params.map((p, i) => (
                <div key={p.id} className={`${styles.paramRow} ${p.required ? styles.paramRowRequired : ''}`}>
                  <div className={styles.paramKeyWrap}>
                    <input
                      className={`${styles.input} ${p.required ? styles.inputRequired : ''}`}
                      style={{ flex: 1 }}
                      placeholder="키 (예: numOfRows)"
                      value={p.key}
                      onChange={e => updateParam(i, 'key', e.target.value)}
                      readOnly={p.required}
                    />
                    {p.required && <span className={styles.requiredBadge}>필수</span>}
                  </div>
                  <input
                    className={`${styles.input} ${p.required ? styles.inputRequired : ''}`}
                    style={{ flex: 1 }}
                    placeholder={p.placeholder || '값'}
                    value={p.value}
                    onChange={e => updateParam(i, 'value', e.target.value)}
                  />
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeParam(i)}
                    disabled={p.required}
                    style={p.required ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                  >−</button>
                </div>
              ))}
              <button className={styles.addParamBtn} onClick={addParam}>+ 파라미터 추가</button>
            </div>

            <button className={styles.runBtn} onClick={run} disabled={running}>
              {running ? '호출 중…' : '실행'}
            </button>

            {error && <div className={styles.errorMsg}>{error}</div>}

            {resultBlock}
          </div>
        )}
      </div>
    </div>
  )
}
