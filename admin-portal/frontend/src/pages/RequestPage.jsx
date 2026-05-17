import { useState } from 'react'
import { MessageSquarePlus, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { requestApi } from '../api'
import RequestForm from '../components/RequestForm'

function DiffView({ changes }) {
  if (!changes || changes.length === 0) return null
  return (
    <div className="space-y-4">
      {changes.map((c, i) => (
        <div key={i} className="border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
            <FileText size={14} className="text-gray-400" />
            <span className="text-xs font-mono text-gray-700 flex-1">{c.path}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              c.action === 'create' ? 'bg-green-100 text-green-700' :
              c.action === 'delete' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {c.action === 'create' ? '새 파일' : c.action === 'delete' ? '삭제' : '수정'}
            </span>
          </div>
          {c.description && (
            <p className="px-4 py-2 text-xs text-gray-500 bg-blue-50 border-b">{c.description}</p>
          )}
          {c.action !== 'delete' && c.content && (
            <pre className="px-4 py-3 text-xs font-mono bg-gray-900 text-green-300 overflow-auto max-h-64 whitespace-pre-wrap">
              {c.content.length > 2000 ? c.content.slice(0, 2000) + '\n... (이하 생략)' : c.content}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

const DEFAULT_FORM = {
  description: '',
  request_type: '추가',
  target_area: 'frontend',
  auto_deploy: false,
}

export default function RequestPage() {
  const [form, setForm]         = useState(DEFAULT_FORM)
  const [loading, setLoading]   = useState(false)
  const [applying, setApplying] = useState(false)
  const [preview, setPreview]   = useState(null)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')

  const handlePreview = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setPreview(null)
    setResult(null)
    try {
      const res = await requestApi.preview(form)
      setPreview(res.data)
    } catch (err) {
      setError(err.response?.data?.detail ?? '미리보기 생성 실패. CLAUDE_API_KEY가 설정됐는지 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!preview?.changes?.length) return
    if (!window.confirm(`${preview.changes.length}개 파일을 GitHub에 적용하시겠습니까?`)) return
    setApplying(true)
    try {
      const res = await requestApi.apply({
        changes: preview.changes,
        commit_message: `[portal-request] ${form.request_type}: ${form.description.slice(0, 60)}`,
        auto_deploy: form.auto_deploy,
      })
      setResult(res.data)
      setPreview(null)
      setForm(DEFAULT_FORM)
    } catch (err) {
      setError(err.response?.data?.detail ?? '적용 실패')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquarePlus size={20} className="text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">기능 요청</h1>
      </div>
      <p className="text-sm text-gray-500">
        텍스트로 원하는 기능 추가·수정·삭제를 설명하면 AI가 코드를 생성하고 GitHub에 직접 반영합니다.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">적용 완료</p>
            <ul className="mt-1 space-y-0.5">
              {result.results?.map((r, i) => (
                <li key={i}>{r.path} — {r.status}</li>
              ))}
            </ul>
            {result.deployed && <p className="mt-1">Jenkins 배포가 트리거됐습니다.</p>}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl p-6">
        <RequestForm form={form} setForm={setForm} onSubmit={handlePreview} loading={loading} />
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              변경 미리보기 — {preview.summary}
            </h2>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {applying ? '적용 중...' : 'GitHub에 적용'}
            </button>
          </div>
          <DiffView changes={preview.changes} />
        </div>
      )}
    </div>
  )
}
