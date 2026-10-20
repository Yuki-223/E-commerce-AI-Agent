import { useState } from 'react'
import { IconCheck } from './Icons'

/** Native share sheet where there is one; otherwise copy the link. Resolves true when it copied. */
export async function shareOrCopy(data: { title: string; url: string }): Promise<boolean> {
  if (navigator.share) {
    await navigator.share(data).catch(() => undefined)
    return false
  }
  if (!navigator.clipboard) return false
  return navigator.clipboard.writeText(data.url).then(
    () => true,
    () => false,
  )
}

/** Each copy bumps the id, so a second copy restarts the tip. */
export function useCopiedTip() {
  const [id, setId] = useState(0)
  return { id, show: () => setId((n) => n + 1), hide: () => setId(0) }
}

/**
 * 已复制链接: pops in, holds 2.5s, then fades out over 300ms (Storybook Code
 * Block & Copy, saved-check-decay) and unmounts. Position it with className.
 */
export function CopiedTip({ tip, className = '' }: { tip: ReturnType<typeof useCopiedTip>; className?: string }) {
  if (!tip.id) return null
  return (
    <span
      key={tip.id}
      role="status"
      onAnimationEnd={(e) => e.animationName === 'saved-check-decay' && tip.hide()}
      className={`pointer-events-none absolute z-30 flex w-max animate-copied items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-bg shadow-pop ${className}`}
    >
      <IconCheck size={12} />
      已复制链接
    </span>
  )
}
