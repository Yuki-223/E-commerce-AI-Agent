import { describe, expect, it } from 'vitest'
import { cycleStatus } from './cycle'

const s = { lastStart: '2026-10-01', cycleLength: 28, periodLength: 5 }
const on = (d: string) => new Date(`${d}T09:00:00`)

describe('cycleStatus', () => {
  it('walks the phases of a 28-day cycle', () => {
    expect(cycleStatus(s, on('2026-10-01'))).toEqual({ day: 1, phase: 'menstrual', daysUntilNext: 28 })
    expect(cycleStatus(s, on('2026-10-05'))?.phase).toBe('menstrual')
    expect(cycleStatus(s, on('2026-10-06'))?.phase).toBe('follicular')
    expect(cycleStatus(s, on('2026-10-14'))?.phase).toBe('ovulatory')
    expect(cycleStatus(s, on('2026-10-20'))?.phase).toBe('luteal')
  })

  it('wraps into the next estimated cycle', () => {
    expect(cycleStatus(s, on('2026-10-29'))).toMatchObject({ day: 1, phase: 'menstrual' })
  })

  it('rejects future or invalid input', () => {
    expect(cycleStatus(s, on('2026-09-30'))).toBeNull()
    expect(cycleStatus({ ...s, lastStart: 'nope' })).toBeNull()
    expect(cycleStatus({ ...s, cycleLength: 5 })).toBeNull()
  })
})
