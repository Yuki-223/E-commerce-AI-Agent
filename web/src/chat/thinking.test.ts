import { describe, expect, it } from 'vitest'
import { conditionsOf, finishThinking, onMeta, onStatus, onToolResult, queryWithout, startThinking } from './thinking'

const parsed = { category: '美妆护肤', sub_category: '防晒', max_price: 300, negative_ingredients: ['酒精'], soft_terms: ['清爽'], brand_exclude: ['某牌'] }

describe('thinking', () => {
  it('folds status, meta and tool_result into finished steps', () => {
    let t = startThinking()
    t = onStatus(t, { phase: 'routing', message: '识别意图中…' })
    t = onMeta(t, { decision: { tool: 'recommend', rewritten_query: '300元以内 不含酒精 防晒', confidence: 'high', reasoning: '用户在找防晒，并给了预算。' }, trace: {} })
    t = onStatus(t, { phase: 'tool', tool: 'recommend', message: '正在为你检索商品…' })
    t = onToolResult(t, { tool_name: 'recommend', payload: { products: [{}, {}, {}], debug: { parsed } } })
    t = onStatus(t, { phase: 'compose', message: '正在生成推荐解说…' })
    t = finishThinking(t)

    expect(t.steps.map((s) => s.done)).toEqual(['理解为：300元以内 不含酒精 防晒', '检索商品库，找到 3 款符合条件的商品', '写好推荐理由'])
    expect(t.steps.every((s) => s.finished)).toBe(true)
    expect(t.reason).toBe('用户在找防晒，并给了预算。')
    expect(t.finishedAt).toBeGreaterThanOrEqual(t.startedAt)
  })

  it('hides diagnostic router reasoning', () => {
    const t = onMeta(startThinking(), { decision: { tool: 'compare', rewritten_query: '', confidence: 'high', reasoning: 'post-route guard: compare intent detected; original=recommend' }, trace: {} })
    expect(t.reason).toBeUndefined()
  })

  it('lists the applied conditions as chips', () => {
    expect(conditionsOf(parsed).map((c) => c.label)).toEqual(['防晒', '≤ ¥300', '不含酒精', '不要某牌', '清爽'])
  })

  it('restates the search without the removed condition', () => {
    expect(queryWithout(parsed, 'price')).toBe('重新推荐 不含酒精的清爽防晒，不要某牌')
    expect(queryWithout(parsed, 'neg:酒精')).toBe('重新推荐 300 元以内的清爽防晒，不要某牌')
    expect(queryWithout({ max_price: 300 }, 'price')).toBeNull()
  })
})
