import { RESULT_STYLE } from '../utils/badge'

export default function BuildStatus({ build, onClick }) {
  const { number, result, timestamp, duration, building } = build
  const date = timestamp ? new Date(timestamp).toLocaleString('ko-KR') : '-'
  const dur  = duration  ? `${Math.round(duration / 60000)}분` : '-'
  const label = building ? 'RUNNING' : (result ?? 'UNKNOWN')
  const style = RESULT_STYLE[result] ?? 'bg-gray-100 text-gray-500'

  return (
    <button
      onClick={() => onClick?.(number)}
      className="w-full flex items-center gap-4 bg-white border rounded-xl px-5 py-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">#{number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
            {label}
          </span>
          {building && (
            <span className="text-xs text-blue-600 animate-pulse">실행 중...</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{date} · {dur}</p>
      </div>
    </button>
  )
}
