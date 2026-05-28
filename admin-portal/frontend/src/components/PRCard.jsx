import { useState } from 'react'
import { GitPullRequest, User, GitBranch, Star, Merge } from 'lucide-react'
import { STATE_BADGE } from '../utils/badge'

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return null
  const color =
    score >= 90
      ? 'text-green-400'
      : score >= 70
      ? 'text-blue-400'
      : score >= 50
      ? 'text-yellow-400'
      : 'text-red-400'
  return (
    <span className={`font-bold text-lg ${color}`} title="Claude 리뷰 점수">
      {score}
      <span className="text-xs text-gray-500 font-normal">/100</span>
    </span>
  )
}

export default function PRCard({ pr, onReview, onMerge }) {
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState(false)
  const [reviewResult, setReviewResult] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const badgeClass = STATE_BADGE[pr.state] || STATE_BADGE.open

  async function handleReview() {
    setLoading(true)
    setError(null)
    try {
      const result = await onReview(pr.number)
      setReviewResult(result)
      setExpanded(true)
    } catch (e) {
      setError(e?.response?.data?.detail || '리뷰 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMerge() {
    if (!window.confirm(`PR #${pr.number}을 squash merge 하시겠습니까?`)) return
    setMerging(true)
    setError(null)
    try {
      await onMerge(pr.number)
    } catch (e) {
      setError(e?.response?.data?.detail || '병합 중 오류가 발생했습니다.')
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-600 transition-colors">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GitPullRequest className="text-blue-400 shrink-0" size={18} />
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white hover:text-blue-400 truncate transition-colors"
            title={pr.title}
          >
            {pr.title}
          </a>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {pr.state}
        </span>
      </div>

      {/* 메타 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
        <span className="flex items-center gap-1">
          <User size={13} />
          {pr.author}
        </span>
        <span className="flex items-center gap-1">
          <GitBranch size={13} />
          <span className="font-mono text-xs">{pr.head_branch}</span>
          <span className="text-gray-600">→</span>
          <span className="font-mono text-xs">{pr.base_branch}</span>
        </span>
        <span className="text-gray-500 text-xs">
          #{pr.number} · {new Date(pr.created_at).toLocaleDateString('ko-KR')}
        </span>
        {pr.latestScore !== null && pr.latestScore !== undefined && (
          <span className="flex items-center gap-1">
            <Star size={13} className="text-yellow-400" />
            <ScoreBadge score={pr.latestScore} />
          </span>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleReview}
          disabled={loading || pr.state !== 'open'}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
            text-sm font-medium text-white transition-colors"
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
              분석 중...
            </>
          ) : (
            'Claude 리뷰'
          )}
        </button>
        <button
          onClick={handleMerge}
          disabled={merging || pr.state !== 'open'}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed
            text-sm font-medium text-white transition-colors"
        >
          <Merge size={15} />
          {merging ? '병합 중...' : '병합'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* 리뷰 결과 인라인 표시 */}
      {reviewResult && (
        <div className="mt-1 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-900 hover:bg-gray-800 transition-colors text-sm"
          >
            <span className="flex items-center gap-2 text-gray-300">
              <Star size={14} className="text-yellow-400" />
              리뷰 결과 — 점수:&nbsp;
              <ScoreBadge score={reviewResult.score} />
            </span>
            <span className="text-gray-500 text-xs">{expanded ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {expanded && (
            <div className="px-4 py-3 bg-gray-900/60 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {reviewResult.full_review}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
