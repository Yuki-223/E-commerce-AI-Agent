import { Link } from 'react-router-dom'
import { useToasts } from '../stores/toast'
import { IconAlert, IconCheckCircle } from './Icons'

/** WebInChat ⑰ 加购成功提示: bottom-right card above the composer. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none absolute bottom-[calc(96px+env(safe-area-inset-bottom))] left-3 right-3 z-40 flex flex-col gap-2 md:left-auto md:right-6 md:w-[320px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex animate-toast-in items-center gap-3 rounded-2xl border border-line-strong bg-surface p-3.5 shadow-[0_12px_32px_rgba(43,30,18,0.14)]"
        >
          {t.tone === 'error' ? <IconAlert className="shrink-0 text-error-text" /> : <IconCheckCircle size={22} tone="var(--success-text)" className="shrink-0" />}
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <span className="text-sm font-semibold">{t.title}</span>
            {t.detail && <span className="truncate text-xs text-ink-muted">{t.detail}</span>}
          </div>
          {t.action && (
            <Link to={t.action.to} className="shrink-0 text-[13px] font-semibold text-primary-text no-underline">
              {t.action.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
