import { IconRetry } from '../Icons'

/** WebStates ① (working) and ④ (auto-retry). */
export function StatusBubble({ text, retryAttempt }: { text?: string; retryAttempt?: number }) {
  return (
    <div role="status" className="flex items-center gap-2.5 self-start rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink-muted">
      {retryAttempt ? (
        <>
          <IconRetry className="animate-spin text-primary [animation-duration:1.4s]" />
          连接中断，正在第 {retryAttempt} 次重试
        </>
      ) : (
        <>
          <span aria-hidden="true" className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 180}ms` }} />
            ))}
          </span>
          {text || '正在为你寻找合适的商品'}
        </>
      )}
    </div>
  )
}
