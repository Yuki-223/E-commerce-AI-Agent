import { useEffect, useId, useState } from 'react'
import { conditionsOf, elapsed, type Thinking, type ThinkingCondition } from '../../chat/thinking'
import { IconCheck, IconChevronDown, IconClose } from '../Icons'

interface Props {
  thinking: Thinking
  /** Chips can drop a condition only under the latest finished answer. */
  editable: boolean
  /** Removes one condition and reruns the previous search without it. */
  onDropCondition: (condition: ThinkingCondition) => void
}

/**
 * 思考过程 above an answer: open and growing while the turn works, folded to
 * 「已思考 · 2.3s · 防晒 · ≤ ¥300」 once the answer starts. Removing a condition
 * chip reruns the previous search without it (drop_conditions on /chat/stream).
 */
export function ThinkingBlock({ thinking, editable, onDropCondition }: Props) {
  const running = !thinking.finishedAt
  const [open, setOpen] = useState<boolean | null>(null)
  const expanded = open ?? running
  const panelId = useId()
  const conditions = thinking.parsed ? conditionsOf(thinking.parsed) : []

  // Tick the timer while the turn works.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => tick((n) => n + 1), 100)
    return () => clearInterval(t)
  }, [running])

  if (!thinking.steps.length) {
    return (
      <div role="status" className="flex items-center gap-2 self-start text-[13px] text-ink-muted">
        <Dots />
        正在思考
      </div>
    )
  }

  return (
    <div className="flex max-w-[640px] flex-col self-start">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setOpen(!expanded)}
        className="group flex min-h-7 items-center gap-2 self-start rounded-lg bg-transparent px-0 text-left text-[13px] text-ink-muted hover:text-ink"
      >
        {running ? <Dots /> : <span className="font-medium">已思考</span>}
        {running && <span className="font-medium text-ink">正在思考</span>}
        <span className="tabular-nums text-ink-subtle">{elapsed(thinking)}</span>
        {!expanded && conditions.length > 0 && (
          <span className="truncate text-ink-subtle">· {conditions.map((c) => c.label).join(' · ')}</span>
        )}
        <IconChevronDown size={10} className={`shrink-0 text-ink-subtle transition-transform duration-snap ease-snap ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div id={panelId} className="ml-[5px] mt-1.5 flex animate-fade-in flex-col gap-2 border-l border-line-strong pb-1 pl-4">
          {thinking.steps.map((s, i) => (
            <div key={`${s.phase}-${i}`} className="flex flex-col gap-2">
              <div className="flex items-start gap-2 text-[13px] leading-5">
                {s.finished ? (
                  <IconCheck size={13} className="mt-[3px] shrink-0 text-primary" />
                ) : (
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
                )}
                <span key={s.finished ? 'done' : s.active} className={`animate-fade-in ${s.finished ? 'text-ink-muted' : 'text-ink'}`}>
                  {s.finished ? s.done ?? s.active.replace(/…$/, '') : s.active}
                </span>
              </div>
              {s.phase === 'routing' && thinking.reason && <p className="m-0 pl-[21px] text-xs leading-[18px] text-ink-subtle">{thinking.reason}</p>}
              {s.phase === 'tool' && conditions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-[21px]" aria-label="本次检索条件">
                  {conditions.map((c) => {
                    const drop = editable && c.removable
                    return (
                      <span key={c.key} className="flex h-6 items-center gap-1 rounded-full bg-chip pl-2.5 pr-2.5 text-xs text-ink has-[button]:pr-1">
                        {c.label}
                        {drop && (
                          <button
                            type="button"
                            title={`去掉「${c.label}」重新推荐`}
                            aria-label={`去掉条件 ${c.label}，重新推荐`}
                            onClick={() => onDropCondition(c)}
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-transparent p-0 text-ink-subtle hover:bg-line-strong hover:text-ink"
                          >
                            <IconClose size={8} />
                          </button>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Dots() {
  return (
    <span aria-hidden="true" className="flex items-center gap-[3.5px] pt-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 w-1 animate-quiet-dot rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}
