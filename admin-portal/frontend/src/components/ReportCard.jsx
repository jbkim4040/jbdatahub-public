import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const STATUS_STYLE = {
  PASS:    'bg-green-100 text-green-700',
  FAIL:    'bg-red-100 text-red-700',
  WARN:    'bg-yellow-100 text-yellow-700',
  ERROR:   'bg-gray-100 text-gray-500',
  SKIPPED: 'bg-gray-100 text-gray-400',
}

const STATUS_ICON = { PASS: '✅', FAIL: '❌', WARN: '⚠️', ERROR: '💥', SKIPPED: '⏭️' }

function ToolRow({ name, status, detail }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm">
      <span className="text-base leading-none mt-0.5">{STATUS_ICON[status] ?? '?'}</span>
      <div>
        <span className="font-medium text-gray-700">{name}</span>
        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[status] ?? 'bg-gray-100'}`}>{status}</span>
        {detail && <p className="text-gray-500 text-xs mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

export default function ReportCard({ report }) {
  const [open, setOpen] = useState(false)
  const { build_number, created_at, overall_status, tools, duration_min } = report
  const date = new Date(created_at).toLocaleString('ko-KR')

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">Build #{build_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${overall_status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {overall_status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{date}{duration_min ? ` · ${duration_min}분` : ''}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {Object.values(tools).map((t, i) => (
            <span key={i} title={t.name}>{STATUS_ICON[t.status] ?? '?'}</span>
          ))}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 border-t bg-gray-50 divide-y divide-gray-100">
          {Object.values(tools).map((t, i) => (
            <ToolRow key={i} name={t.name} status={t.status} detail={t.detail} />
          ))}
        </div>
      )}
    </div>
  )
}
