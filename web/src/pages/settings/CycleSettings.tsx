import { useEffect, useState } from 'react'
import { PHASES, cycleStatus } from '../../lib/cycle'
import { useCycle } from '../../stores/cycle'
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY, FIELD, Row, SECTIONS, Section } from './ui'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 经期关怀 settings tab: record the cycle locally; the home page then suggests phase-aware supplies. */
export function CycleSettings() {
  const { settings, save, clear } = useCycle()
  const [lastStart, setLastStart] = useState(settings?.lastStart ?? '')
  const [cycleLength, setCycleLength] = useState(String(settings?.cycleLength ?? 28))
  const [periodLength, setPeriodLength] = useState(String(settings?.periodLength ?? 5))
  useEffect(() => {
    setLastStart(settings?.lastStart ?? '')
    setCycleLength(String(settings?.cycleLength ?? 28))
    setPeriodLength(String(settings?.periodLength ?? 5))
  }, [settings])

  const draft = { lastStart, cycleLength: Number(cycleLength), periodLength: Number(periodLength) }
  const status = lastStart ? cycleStatus(draft) : null
  const valid = Boolean(status) && draft.periodLength >= 1 && draft.periodLength <= 10

  return (
    <div className={SECTIONS}>
      <Section
        title="经期关怀"
        description="记录周期后，首页会按你所处的阶段推荐补给。数据只保存在这台设备的浏览器里，不会上传。"
        action={
          settings && (
            <button type="button" className={BUTTON_DANGER} onClick={clear}>
              清除记录
            </button>
          )
        }
      >
        <Row label="最近一次经期开始日" htmlFor="cycle-start">
          <input id="cycle-start" type="date" max={today()} value={lastStart} onChange={(e) => setLastStart(e.target.value)} className={FIELD} />
        </Row>
        <Row label="平均周期长度" hint="两次经期第一天之间的天数，常见 21-35 天" htmlFor="cycle-length">
          <input id="cycle-length" inputMode="numeric" value={cycleLength} onChange={(e) => setCycleLength(e.target.value.replace(/\D/g, ''))} className={`${FIELD} w-[88px] text-right`} />
        </Row>
        <Row label="经期天数" htmlFor="period-length">
          <input id="period-length" inputMode="numeric" value={periodLength} onChange={(e) => setPeriodLength(e.target.value.replace(/\D/g, ''))} className={`${FIELD} w-[88px] text-right`} />
        </Row>
        {status && (
          <p className="m-0 rounded-xl bg-primary-soft px-4 py-3 text-sm leading-[21px]">
            今天大约是周期第 {status.day} 天 · <b>{PHASES[status.phase].label}</b>，预计 {status.daysUntilNext} 天后下次经期。
            <br />
            <span className="text-ink-muted">{PHASES[status.phase].note}</span>
          </p>
        )}
        <div className="flex items-center gap-2">
          <button type="button" disabled={!valid} className={BUTTON_PRIMARY} onClick={() => save(draft)}>
            保存
          </button>
          {settings && (
            <button type="button" className={BUTTON} onClick={() => setLastStart(today())}>
              今天来了
            </button>
          )}
        </div>
        <p className="m-0 text-xs leading-[18px] text-ink-subtle">按平均周期估算，仅用于推荐参考，不能用于避孕或医疗判断。周期明显紊乱、经期疼痛加重时请咨询医生。</p>
      </Section>
    </div>
  )
}
