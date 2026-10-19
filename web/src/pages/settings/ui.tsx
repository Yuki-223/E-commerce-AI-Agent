import type { ReactNode } from 'react'

/**
 * Building blocks for the settings pages, modelled on claude.ai/settings:
 * plain sections split by hairlines, rows with the label + hint on the left
 * and the control on the right, no cards.
 */
export function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col border-b border-line py-7">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex grow flex-col gap-1">
          <h2 className="m-0 text-[17px] font-semibold">{title}</h2>
          {description && <p className="m-0 text-sm leading-[21px] text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

/**
 * Label on the left, control on the right; `stacked` puts wide controls
 * underneath, `wide` lets the control drop below the label on phones.
 */
export function Row({ label, hint, htmlFor, stacked, wide, children }: { label: string; hint?: ReactNode; htmlFor?: string; stacked?: boolean; wide?: boolean; children: ReactNode }) {
  const head = (
    <div className="flex min-w-0 grow flex-col gap-0.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[15px] font-medium">
          {label}
        </label>
      ) : (
        <span className="text-[15px] font-medium">{label}</span>
      )}
      {hint && <span className="text-[13px] leading-[19px] text-ink-muted">{hint}</span>}
    </div>
  )
  if (stacked) {
    return (
      <div className="flex flex-col gap-2.5">
        {head}
        {children}
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-x-6 gap-y-2.5 ${wide ? 'flex-wrap sm:flex-nowrap' : ''}`}>
      {head}
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors ${checked ? 'justify-end bg-primary' : 'justify-start bg-disabled'}`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]" />
    </button>
  )
}

/** Wraps the tab content: hides the first section's top padding and the last one's hairline. */
export const SECTIONS = '-mt-7 [&>section:last-child]:border-b-0 [&>div:last-child>section:last-child]:border-b-0'

export const FIELD = 'h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-primary'

const BUTTON_BASE = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium disabled:opacity-40'
export const BUTTON = `${BUTTON_BASE} border border-line-strong bg-surface text-ink hover:bg-secondary`
export const BUTTON_DANGER = `${BUTTON_BASE} border border-[color-mix(in_srgb,var(--error-text)_40%,transparent)] bg-surface text-error-text hover:bg-[color-mix(in_srgb,var(--error)_8%,transparent)]`
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-on-primary hover:bg-primary-hover`
