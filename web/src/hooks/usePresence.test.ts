import { describe, expect, it } from 'vitest'
import { mergePresence, type Entry } from './usePresence'

const entries = (keys: string) => [...keys].map((k): Entry<string> => ({ key: k, item: k, leaving: false }))
const view = (list: Entry<string>[]) => list.map((e) => (e.leaving ? `(${e.key})` : e.key)).join('')

describe('mergePresence', () => {
  it('keeps a removed item in place, marked leaving', () => {
    expect(view(mergePresence(entries('abc'), ['a', 'c'], (x) => x))).toBe('a(b)c')
    expect(view(mergePresence(entries('abc'), ['b', 'c'], (x) => x))).toBe('(a)bc')
  })

  it('follows the new order and places new items where they arrive', () => {
    expect(view(mergePresence(entries('abc'), ['c', 'a', 'b'], (x) => x))).toBe('cab')
    expect(view(mergePresence(entries('ab'), ['n', 'a', 'b'], (x) => x))).toBe('nab')
  })

  it('brings a leaving item back when it returns', () => {
    const leaving = mergePresence(entries('ab'), ['a'], (x) => x)
    expect(view(mergePresence(leaving, ['a', 'b'], (x) => x))).toBe('ab')
  })
})
