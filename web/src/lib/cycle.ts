/**
 * Menstrual-cycle phase estimate for 经期关怀. Everything stays in this browser
 * (stores/cycle.ts); nothing is sent to the backend. The estimate assumes the
 * luteal phase lasts about 14 days, which is an average and not a prediction.
 */
export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

export interface CycleSettings {
  /** First day of the last period, YYYY-MM-DD. */
  lastStart: string
  cycleLength: number
  periodLength: number
}

export interface CycleStatus {
  /** 1-based day of the current cycle. */
  day: number
  phase: Phase
  daysUntilNext: number
}

export const PHASES: Record<Phase, { label: string; note: string; prompts: string[] }> = {
  menstrual: {
    label: '经期',
    note: '照顾好自己：注意补铁、保暖，训练量按感觉来。',
    prompts: ['推荐经期也能训练的经期用品', '经期补铁有什么温和的选择', '推荐无咖啡因的暖身饮品'],
  },
  follicular: {
    label: '卵泡期',
    note: '精力通常在回升，适合安排力量和高强度训练。',
    prompts: ['推荐力量训练后的蛋白补给', '推荐跑跳不晃的高强度运动内衣', '推荐训练日的高蛋白早餐'],
  },
  ovulatory: {
    label: '排卵期前后',
    note: '状态不错的时候，记得训练补水和防晒。',
    prompts: ['推荐大汗量训练的电解质', '推荐防水防汗的运动防晒', '推荐训练前提神又不心慌的饮品'],
  },
  luteal: {
    label: '黄体期',
    note: '可能更容易水肿、嘴馋或睡不好，对自己温柔一点。',
    prompts: ['经前想吃甜的有什么健康零食', '推荐帮助放松和睡眠的营养素', '推荐经前穿着舒服的瑜伽裤'],
  },
}

const DAY = 86_400_000

function parseDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function todayUTC(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

export function cycleStatus(s: CycleSettings, now = new Date()): CycleStatus | null {
  const start = parseDay(s.lastStart)
  const length = Math.round(s.cycleLength)
  if (start === null || length < 15 || length > 60) return null
  const elapsed = Math.floor((todayUTC(now) - start) / DAY)
  if (elapsed < 0) return null
  const day = (elapsed % length) + 1
  const ovulation = length - 14
  let phase: Phase
  if (day <= Math.max(1, Math.round(s.periodLength))) phase = 'menstrual'
  else if (day < ovulation - 1) phase = 'follicular'
  else if (day <= ovulation + 1) phase = 'ovulatory'
  else phase = 'luteal'
  return { day, phase, daysUntilNext: length - day + 1 }
}
