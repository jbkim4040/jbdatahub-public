import { useEffect, useState } from 'react'
import { Database, Plus, RefreshCw, Key, AlertCircle, Cookie } from 'lucide-react'
import api from '../api'

const STATUS_STYLE = {
  PENDING:   'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
  ERROR:     'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function CookieModal({ onClose, onSaved }) {
  const [cookie, setCookie] = useState('')
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/subscription/session', { cookie_jar: cookie, user_name: name })
      onSaved()
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Cookie size={18} /> data.go.kr 세션 등록
        </h2>
        <ol className="text-sm text-gray-600 mb-4 space-y-1 list-decimal pl-5">
          <li>https://www.data.go.kr 카카오/네이버 로그인</li>
          <li>F12 → <b>Network</b> 탭 → F5 새로고침 → 첫 요청 클릭 → Headers → <b>Request Headers</b> → <code>Cookie:</code> 값 통째 복사</li>
          <li>그리고 F12 → <b>Application</b> → Cookies → <code>https://auth.data.go.kr</code> 도메인도 cookie 복사하여 <code>;</code>로 이어붙이기 (SSO redirect용)</li>
          <li>최종 형식: <code>JSESSIONID=...; SCOUTER=...; OZSESSION=...;</code> (두 도메인 모두 포함)</li>
        </ol>
        <form onSubmit={submit} className="space-y-3">
          <input type="text" placeholder="data.go.kr 사용자명 (참고용)"
                 value={name} onChange={e=>setName(e.target.value)}
                 className="w-full px-3 py-2 border rounded-lg text-sm" />
          <textarea required value={cookie} onChange={e=>setCookie(e.target.value)}
                    placeholder="JSESSIONID=...; SCOUTER=...; OZSESSION=..."
                    className="w-full h-32 px-3 py-2 border rounded-lg text-xs font-mono" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded">취소</button>
            <button type="submit" disabled={saving || !cookie.trim()}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SubscriptionPage() {
  const [items, setItems]       = useState([])
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [filter, setFilter]     = useState('')
  const [showCookie, setShowCookie] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        api.get('/subscription/session/status'),
        api.get(`/subscription/list${filter ? `?status=${filter}` : ''}`),
      ])
      setSession(s.data)
      setItems(l.data.items ?? [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filter])

  const refresh = async () => {
    await api.post('/subscription/refresh-status'); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={20} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">공공데이터 신청 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCookie(true)}
                  className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
            <Cookie size={14} /> 세션 등록
          </button>
          <button onClick={refresh}
                  className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw size={14} /> 상태 새로고침
          </button>
        </div>
      </div>

      {/* 세션 상태 */}
      <div className={`rounded-xl border px-4 py-3 text-sm ${
        session?.has_session ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
      }`}>
        {session?.has_session ? (
          <>
            ✓ 세션 등록됨 — {session.user_name || '(이름 미지정)'} · 만료: {
              session.expires_at ? new Date(session.expires_at).toLocaleString('ko-KR') : 'n/a'
            }
          </>
        ) : (
          <>⚠️ data.go.kr 세션 없음. 우상단 "세션 등록" 클릭</>
        )}
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {['', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ERROR'].map(s => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s || '전체'}
          </button>
        ))}
      </div>

      {/* 신청 목록 */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">로딩 중...</p>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-400 py-12">신청 내역이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="flex items-center gap-4 bg-white border rounded-xl px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 truncate">{it.list_title || it.list_id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[it.status]}`}>
                    {it.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {it.org_nm && `${it.org_nm} · `}list_id: {it.list_id} · 요청: {new Date(it.requested_at).toLocaleString('ko-KR')}
                </p>
                {it.api_key && <p className="text-xs text-green-700 font-mono mt-1">🔑 {it.api_key}</p>}
                {it.error_message && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {it.error_message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCookie && (
        <CookieModal
          onClose={() => setShowCookie(false)}
          onSaved={() => { setShowCookie(false); load(); }}
        />
      )}
    </div>
  )
}
