import { useMemo, useState } from 'react'
import type { Review } from '../../api/types'

type Filter = 'all' | 'positive' | 'negative'
type Sort = 'default' | 'high' | 'low'

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating))
  return (
    <span role="img" aria-label={`${r} 星`} className="text-[11px] text-primary">
      {'★'.repeat(r)}
      <span className="text-star-empty">{'★'.repeat(5 - r)}</span>
    </span>
  )
}

/**
 * Reviews with rating counts, plus the filter/sort row from iOS ③ Detail.dc.html
 * (好评 / 差评, 评分高→低). Ratings and text come straight from the product payload.
 */
export function Reviews({ reviews, collapsedCount = 3 }: { reviews: Review[]; collapsedCount?: number }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('default')
  const [expanded, setExpanded] = useState(false)

  const dist = useMemo(() => {
    const counts = new Map<number, number>()
    for (const r of reviews) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([star, n]) => `${star} 星 ×${n}`).join(' · ')
  }, [reviews])

  const list = useMemo(() => {
    const filtered = reviews.filter((r) => filter === 'all' || r.polarity === filter)
    if (sort === 'high') return [...filtered].sort((a, b) => b.rating - a.rating)
    if (sort === 'low') return [...filtered].sort((a, b) => a.rating - b.rating)
    return filtered
  }, [reviews, filter, sort])

  if (!reviews.length) return <div className="text-[13px] text-ink-subtle">暂无用户评价</div>

  const shown = expanded ? list : list.slice(0, collapsedCount)
  const chip = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs ${active ? 'bg-primary-tint font-semibold text-primary-text' : 'bg-field text-ink-muted'}`

  return (
    <section className="flex flex-col gap-2.5" aria-label="用户评价">
      <div className="flex items-center gap-2">
        <span className="grow text-[13px] font-semibold">用户评价 · {reviews.length} 条</span>
        <span className="text-xs text-ink-subtle">{dist}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['all', '全部'],
            ['positive', `好评 ${reviews.filter((r) => r.polarity === 'positive').length}`],
            ['negative', `差评 ${reviews.filter((r) => r.polarity === 'negative').length}`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={chip(filter === key)}>
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs text-ink-subtle">
          <span className="sr-only-label">排序</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md bg-transparent py-0.5 text-xs text-ink-muted outline-none">
            <option value="default">默认排序</option>
            <option value="high">评分从高到低</option>
            <option value="low">评分从低到高</option>
          </select>
        </label>
      </div>
      {shown.map((r, i) => (
        <div key={r.id} className={`flex flex-col gap-1 pb-2.5 ${i < shown.length - 1 ? 'border-b border-line-faint' : ''}`}>
          <div className="flex items-center text-[13px] font-semibold">
            <span className="grow">{r.nickname || '匿名用户'}</span>
            <Stars rating={r.rating} />
          </div>
          <p className="m-0 text-[13px] leading-[19px] text-ink-muted">{r.content}</p>
        </div>
      ))}
      {list.length === 0 && <div className="text-[13px] text-ink-subtle">没有符合条件的评价</div>}
      {list.length > collapsedCount && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="self-start p-0 text-[13px] font-semibold text-primary-text">
          {expanded ? '收起' : `查看全部 ${list.length} 条`}
        </button>
      )}
    </section>
  )
}
