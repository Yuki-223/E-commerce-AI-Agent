import { IconMoon } from '../Icons'
import { PHASES, cycleStatus } from '../../lib/cycle'
import { useCycle } from '../../stores/cycle'
import { useSettings } from '../../stores/ui'

/**
 * Home-page 经期关怀 card: today's estimated phase with three ready-to-send
 * prompts, or an invitation to record the cycle. Reads local data only.
 */
export function CycleCard({ onPrompt }: { onPrompt: (text: string) => void }) {
  const settings = useCycle((s) => s.settings)
  const openSettings = useSettings((s) => s.open)
  const status = settings ? cycleStatus(settings) : null

  if (!status) {
    return (
      <button
        type="button"
        onClick={() => openSettings('cycle')}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-transparent px-4 py-3 text-left text-[13px] text-ink-muted hover:border-primary hover:text-ink"
      >
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
          <IconMoon size={15} />
        </span>
        <span className="grow">记录经期周期，按阶段推荐补给（只保存在本机）</span>
        <span className="shrink-0 whitespace-nowrap text-primary-text">去设置</span>
      </button>
    )
  }

  const phase = PHASES[status.phase]
  return (
    <section aria-label="今日周期关怀" className="flex w-full flex-col gap-2.5 rounded-2xl bg-primary-soft px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-on-primary">{phase.label}</span>
        <span className="text-[13px] font-medium">周期第 {status.day} 天</span>
        <span className="text-xs text-ink-muted">· 约 {status.daysUntilNext} 天后下次经期</span>
        <button type="button" onClick={() => openSettings('cycle')} className="ml-auto p-0 text-xs text-ink-subtle hover:text-ink">
          调整
        </button>
      </div>
      <p className="m-0 text-[13px] leading-[19px] text-ink-muted">{phase.note}</p>
      <div className="flex flex-wrap gap-1.5">
        {phase.prompts.map((p) => (
          <button key={p} type="button" onClick={() => onPrompt(p)} className="rounded-full bg-surface px-3 py-1.5 text-[13px] text-ink shadow-card hover:text-primary-text">
            {p}
          </button>
        ))}
      </div>
    </section>
  )
}
