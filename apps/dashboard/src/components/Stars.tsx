import type { Reputation } from '@/lib/types'

export function Stars({ reputation }: { reputation: Reputation | null }) {
  if (reputation && reputation.count > 0 && reputation.score != null) {
    return (
      <span className="stars">
        ⭐ {reputation.score.toFixed(0)}/100{' '}
        <span className="muted">({reputation.count})</span>
      </span>
    )
  }
  return <span className="stars unrated">unrated</span>
}
