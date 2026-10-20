import { describe, expect, it } from 'vitest'
import { greeting } from './format'

const at = (h: number) => new Date(2026, 9, 20, h, 30)

describe('greeting', () => {
  it('follows the local hour', () => {
    expect(greeting(at(4))).toBe('晚上好')
    expect(greeting(at(5))).toBe('早上好')
    expect(greeting(at(10))).toBe('早上好')
    expect(greeting(at(11))).toBe('中午好')
    expect(greeting(at(12))).toBe('中午好')
    expect(greeting(at(13))).toBe('下午好')
    expect(greeting(at(17))).toBe('下午好')
    expect(greeting(at(18))).toBe('晚上好')
    expect(greeting(at(23))).toBe('晚上好')
  })
})
