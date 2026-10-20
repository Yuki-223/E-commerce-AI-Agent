import { describe, expect, it } from 'vitest'
import type { Comparison } from '../api/types'
import { mergeComparisons, narrowComparison } from './useComparison'

const p = (id: string, price: number) => ({ product_id: id, title: id, brand: '', price, image_url: null })

describe('mergeComparisons', () => {
  it('lines up pairwise /compare results into one table', () => {
    const ab: Comparison = { title: '', recommendation: '', products: [p('a', 200), p('b', 150)], rows: [
      { label: '价格', values: ['¥200', '¥150'], highlight: 1 }, { label: '续航', values: ['10h', '12h'], highlight: null },
    ] }
    const ac: Comparison = { title: '', recommendation: '', products: [p('a', 200), p('c', 99)], rows: [
      { label: '价格', values: ['¥200', '¥99 起'], highlight: 1 }, { label: '续航', values: ['10h', '—'], highlight: null },
    ] }
    const merged = mergeComparisons(['a', 'b', 'c'], [ab, ac])
    expect(merged.products.map((x) => x.product_id)).toEqual(['a', 'b', 'c'])
    expect(merged.rows).toEqual([
      { label: '价格', values: ['¥200', '¥150', '¥99 起'], highlight: 2 },
      { label: '续航', values: ['10h', '12h', '—'], highlight: null },
    ])
  })

  it('narrows a table to the remaining columns and re-picks the lowest price', () => {
    const abc: Comparison = { title: '', recommendation: '', products: [p('a', 200), p('b', 150), p('c', 99)], rows: [
      { label: '价格', values: ['¥200', '¥150', '¥99'], highlight: 2 }, { label: '续航', values: ['10h', '12h', '8h'], highlight: 1 },
    ] }
    expect(narrowComparison(abc, ['a', 'b'])?.rows).toEqual([
      { label: '价格', values: ['¥200', '¥150'], highlight: 1 },
      { label: '续航', values: ['10h', '12h'], highlight: 1 },
    ])
    expect(narrowComparison(abc, ['a', 'c'])?.rows[1].highlight).toBeNull()
    expect(narrowComparison(abc, ['a', 'd'])).toBeNull()
  })

  it('returns a single pair untouched', () => {
    const ab: Comparison = { title: 't', recommendation: '', products: [p('a', 1), p('b', 2)], rows: [] }
    expect(mergeComparisons(['a', 'b'], [ab])).toBe(ab)
  })
})
