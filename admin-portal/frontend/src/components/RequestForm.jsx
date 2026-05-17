import { FileEdit, PlusCircle, Trash2 } from 'lucide-react'

const TYPE_OPTS = [
  { value: '추가', label: '추가', icon: PlusCircle,  color: 'bg-green-100 text-green-700 border-green-300' },
  { value: '수정', label: '수정', icon: FileEdit,    color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: '삭제', label: '삭제', icon: Trash2,      color: 'bg-red-100 text-red-700 border-red-300' },
]

const AREA_OPTS = [
  { value: 'frontend', label: '프론트엔드' },
  { value: 'backend',  label: '백엔드 API' },
  { value: 'infra',    label: '인프라/배포' },
  { value: 'both',     label: '전체 (FE+BE)' },
]

export default function RequestForm({ form, setForm, onSubmit, loading }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 요청 유형 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">요청 유형</label>
        <div className="flex gap-2">
          {TYPE_OPTS.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, request_type: value }))}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                form.request_type === value ? color + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 대상 영역 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">대상 영역</label>
        <div className="flex flex-wrap gap-2">
          {AREA_OPTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, target_area: value }))}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                form.target_area === value
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 요청 내용 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          요청 내용 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="예: 배포 페이지에 롤백 버튼을 추가해줘. 이전 빌드 번호를 선택하면 해당 빌드로 재배포되어야 해."
          className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
        <p className="text-xs text-gray-400 mt-1">{form.description.length} 자</p>
      </div>

      {/* 자동 배포 */}
      <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
        <input
          type="checkbox"
          id="auto_deploy"
          checked={form.auto_deploy}
          onChange={e => setForm(f => ({ ...f, auto_deploy: e.target.checked }))}
          className="w-4 h-4 accent-yellow-500"
        />
        <label htmlFor="auto_deploy" className="text-sm text-yellow-700">
          변경 적용 후 자동으로 Jenkins 배포 트리거
        </label>
      </div>

      <button
        type="submit"
        disabled={loading || !form.description.trim()}
        className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'AI가 변경사항 분석 중...' : '변경 미리보기 생성'}
      </button>
    </form>
  )
}
