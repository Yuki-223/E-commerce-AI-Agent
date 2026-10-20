import { describe, expect, it } from 'vitest'
import { parseQuantity } from './agent'

// Mirrors backend/agent/tests/test_cart.py::test_parse_quantity.
describe('mock parseQuantity', () => {
  it.each([
    ['我要 白色，2 件', 2],
    ['就第一个，两瓶', 2],
    ['我要十二瓶', 12],
    ['×3', 3],
    ['第一个', null],
    ['把第二个加入购物车', null],
    ['要 3 件装那个', null],
    ['能用两个月吗', null],
    ['256GB 黑色', null],
  ])('%s → %s', (text, expected) => {
    expect(parseQuantity(text)).toBe(expected)
  })
})
