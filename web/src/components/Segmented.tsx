import type { ReactNode } from 'react'

interface Props<T extends string> {
  label: string
  options: [T, ReactNode][]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}

/**
 * Pill segmented control: equal columns on a 2px-inset track, with one thumb
 * that slides to the selected option rather than each button repainting.
 */
export function Segmented<T extends string>({ label, options, value, onChange, size = 'md' }: Props<T>) {
  const n = options.length
  const i = Math.max(0, options.findIndex(([v]) => v === value))
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative grid select-none rounded-full bg-[var(--segment)] p-[2px] ${size === 'sm' ? 'h-7 text-xs' : 'h-9 text-[13px]'}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[2px] top-[2px] rounded-full bg-[var(--segment-thumb)] shadow-[inset_0_0_0_1px_var(--line),0_1px_2px_rgba(0,0,0,0.08)] transition-[left] duration-snap ease-snap"
        style={{ left: `calc(2px + ${i} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }}
      />
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={`relative truncate rounded-full px-3 ${v === value ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
