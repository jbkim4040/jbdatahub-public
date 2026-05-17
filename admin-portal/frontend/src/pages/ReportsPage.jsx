import { useEffect, useState } from 'react'
import { FileText, Download, Trash2, RefreshCw, Eye, X, FileSearch } from 'lucide-react'
import { reportsApi } from '../api'

const TYPE_LABEL = {
  code_review:    { label: '코드 검토',   color: 'bg-blue-100 text-blue-700' },
  security_scan:  { label: '보안 스캔',   color: 'bg-purple-100 text-purple-700' },
  deploy_summary: { label: '배포 요약',   color: 'bg-green-100 text-green-700' },
  custom:         { label: '기타',        color: 'bg-gray-100 text-gray-700' },
}

function SeverityBadges({ summary }) {
  if (!summary || Object.keys(summary).length === 0) return null
  const items = [
    ['HIGH', summary.high, 'bg-red-100 text-red-700'],
    ['MED',  summary.medium, 'bg-yellow-100 text-yellow-700'],
    ['LOW',  summary.low, 'bg-green-100 text-green-700'],
  ].filter(([_, n]) => n > 0)
  return (
    <div className="flex gap-1">
      {items.map(([label, n, cls]) => (
        <span key={label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
          {label} {n}
        </span>
      ))}
    </div>
  )
}

function DetailModal({ report, onClose }) {
  if (!report) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="font-semibold text-gray-900">{report.title}</p>
            <p className="text-xs text-gray-400">{new Date(report.created_at).toLocaleString('ko-KR')} · {report.author}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={reportsApi.pdfUrl(report.id)} target="_blank" rel="noreferrer"
               className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700">
              <Download size={12} /> PDF
            </a>
            <a href={reportsApi.docxUrl(report.id)} target="_blank" rel="noreferrer"
               className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
              <Download size={12} /> DOCX
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto p-6 text-xs font-mono whitespace-pre-wrap bg-gray-50">
          {report.content_md}
        </pre>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [filter, setFilter]     = useState('')
  const [detail, setDetail]     = useState(null)
  const [error, setError]       = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await reportsApi.list(1, filter || undefined)
      setReports(res.data.items ?? [])
    } catch (e) {
      setError(e.response?.data?.detail ?? '리포트 목록 로드 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const openDetail = async (id) => {
    try {
      const res = await reportsApi.get(id)
      setDetail(res.data)
    } catch (e) { setError('상세 조회 실패') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 리포트를 삭제할까요?')) return
    await reportsApi.remove(id)
    setReports(reports.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch size={20} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">통합 리포트</h1>
        </div>
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'code_review', 'security_scan', 'deploy_summary', 'custom'].map(t => (
          <button key={t || 'all'} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filter === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t === '' ? '전체' : TYPE_LABEL[t]?.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">로딩 중...</p>
      ) : reports.length === 0 ? (
        <p className="text-center text-gray-400 py-12">리포트가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="flex items-center gap-4 bg-white border rounded-xl px-5 py-4 hover:bg-gray-50">
              <FileText size={20} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 truncate">{r.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABEL[r.report_type]?.color}`}>
                    {TYPE_LABEL[r.report_type]?.label ?? r.report_type}
                  </span>
                  <SeverityBadges summary={r.severity_summary} />
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleString('ko-KR')} · {r.author}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openDetail(r.id)} title="상세 보기"
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                  <Eye size={16} />
                </button>
                <a href={reportsApi.pdfUrl(r.id)} target="_blank" rel="noreferrer" title="PDF 다운로드"
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Download size={16} />
                </a>
                <a href={reportsApi.docxUrl(r.id)} target="_blank" rel="noreferrer" title="DOCX 다운로드"
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <FileText size={16} />
                </a>
                <button onClick={() => handleDelete(r.id)} title="삭제"
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DetailModal report={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
