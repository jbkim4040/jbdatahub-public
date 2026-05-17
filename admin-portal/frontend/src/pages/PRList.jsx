import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertCircle, GitPullRequest } from 'lucide-react'
import { prsApi } from '../api'
import PRCard from '../components/PRCard'

export default function PRList() {
  const [prs, setPrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reviewScores, setReviewScores] = useState({}) // pr_number → score

  const fetchPrs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await prsApi.list()
      setPrs(res.data.prs || [])
    } catch (e) {
      setError(e?.response?.data?.detail || 'PR 목록을 불러오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // 각 PR의 최신 리뷰 점수를 가져옴
  const fetchReviewScore = useCallback(async (prNumber) => {
    try {
      const res = await prsApi.get(prNumber)
      const reviews = res.data.reviews || []
      if (reviews.length > 0) {
        setReviewScores((prev) => ({ ...prev, [prNumber]: reviews[0].score }))
      }
    } catch (_) {
      // 무시
    }
  }, [])

  useEffect(() => {
    fetchPrs()
  }, [fetchPrs])

  useEffect(() => {
    prs.forEach((pr) => {
      if (reviewScores[pr.number] === undefined) {
        fetchReviewScore(pr.number)
      }
    })
  }, [prs]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReview(prNumber) {
    const res = await prsApi.review(prNumber)
    const result = res.data
    setReviewScores((prev) => ({ ...prev, [prNumber]: result.score }))
    return result
  }

  async function handleMerge(prNumber) {
    await prsApi.merge(prNumber)
    // 병합 후 목록 새로고침
    await fetchPrs()
  }

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mr-3" />
        PR 목록 로딩 중...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitPullRequest className="text-blue-400" size={24} />
          <div>
            <h1 className="text-xl font-bold text-white">PR 리뷰</h1>
            <p className="text-sm text-gray-400">
              {prs.length > 0
                ? `열린 PR ${prs.length}개`
                : '열린 PR이 없습니다'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchPrs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600
            text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={15} />
          새로고침
        </button>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4 text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* PR 목록 */}
      {prs.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-500">
          <GitPullRequest size={40} className="mx-auto mb-3 opacity-40" />
          <p>현재 열린 PR이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {prs.map((pr) => (
            <PRCard
              key={pr.number}
              pr={{ ...pr, latestScore: reviewScores[pr.number] }}
              onReview={handleReview}
              onMerge={handleMerge}
            />
          ))}
        </div>
      )}
    </div>
  )
}
