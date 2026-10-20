import type { ReactNode } from 'react'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { BackButton, MenuButton, MobileHeader, MobileTitle } from './MobileHeader'

/**
 * A full-width page under the app shell (orders, merchant console, login):
 * the cart page's padding and heading on desktop, the sticky phone header
 * on narrow screens.
 */
export function PageFrame({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const narrow = useIsNarrow()
  if (narrow) {
    return (
      <>
        <MobileHeader left={<BackButton label="返回" />} right={<MenuButton />}>
          <MobileTitle>{title}</MobileTitle>
        </MobileHeader>
        <div className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-4 pb-6 pt-3.5">
          {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
          {children}
        </div>
      </>
    )
  }
  return (
    <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-10 py-7">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="m-0 text-[26px] font-bold">{title}</h1>
        {aside}
      </div>
      {children}
    </div>
  )
}

export const CARD = 'rounded-[20px] border border-line bg-surface shadow-[0_2px_6px_rgba(43,30,18,0.04)]'

/** Pill tabs used for status filters and console sections. */
export function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] ${o.value === value ? 'bg-ink font-semibold text-bg' : 'bg-secondary text-ink-muted hover:text-ink'}`}
        >
          {o.label}
          {o.count ? <span className="ml-1 opacity-70">{o.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

/** SQLite `datetime('now')` is UTC without a zone; show it in local time. */
export function sqlTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? '' : 'Z'))
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}
