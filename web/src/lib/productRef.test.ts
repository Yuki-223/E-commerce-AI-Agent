import { describe, expect, it } from 'vitest'
import { withProductRef } from './productRef'

const ref = { id: 'p_beauty_001', title: '理肤泉清痘净肤水' }

describe('withProductRef', () => {
  it('leaves plain messages alone', () => {
    expect(withProductRef('  推荐防晒 ', undefined)).toBe('推荐防晒')
  })
  it('prefixes the referenced product with its id', () => {
    expect(withProductRef('有便宜点的替代吗', ref)).toBe('关于商品「理肤泉清痘净肤水」（商品 ID：p_beauty_001）：有便宜点的替代吗')
  })
  it('asks about the product when nothing was typed', () => {
    expect(withProductRef(' ', ref)).toBe('关于商品「理肤泉清痘净肤水」（商品 ID：p_beauty_001），介绍一下这款')
  })
})
