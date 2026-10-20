/**
 * The 思考过程 shown above an answer, folded from the structured stream events
 * (status phases, meta.decision, tool_result.payload.debug.parsed). Every line is
 * templated from those fields; the router's free-text `reasoning` is shown only
 * when it reads like a sentence for people, never the diagnostic guard strings.
 */
import type { IntentDecision, MetaEventData, StatusEventData, ToolResultEventData } from '../api/types'

export type ThinkingPhase = 'vision' | 'routing' | 'tool' | 'compose'

export interface ThinkingStep {
  phase: ThinkingPhase
  /** Shown while the step runs. */
  active: string
  /** Shown once the next step starts; falls back to `active`. */
  done?: string
  finished: boolean
}

/** One constraint the search actually applied, as a chip in the block. */
export interface ThinkingCondition {
  key: string
  label: string
  removable: boolean
}

export interface Thinking {
  startedAt: number
  finishedAt?: number
  steps: ThinkingStep[]
  /** decision.rewritten_query. */
  understood?: string
  reason?: string
  tool?: string
  /** ParsedQuery of a recommend / refine turn, kept to restate the search. */
  parsed?: Parsed
  hitCount?: number
}

/** The subset of ParsedQuery.to_dict() the block reads. */
export interface Parsed {
  category?: string | null
  sub_category?: string | null
  max_price?: number | null
  min_price?: number | null
  brand_include?: string[]
  brand_exclude?: string[]
  negative_ingredients?: string[]
  soft_terms?: string[]
  retrieval_query?: string
}

const TOOL_DONE: Record<string, (n?: number) => string> = {
  recommend: (n) => (n ? `检索商品库，找到 ${n} 款符合条件的商品` : '检索商品库，没有完全符合的商品'),
  refine: (n) => (n ? `按新条件重新筛选，留下 ${n} 款` : '按新条件重新筛选，没有完全符合的商品'),
  compare: (n) => `读取 ${n ?? 2} 款商品的对比维度`,
  product_detail: () => '查阅商品详情、评价和 FAQ',
  cart: () => '处理购物车',
  clarify: () => '还需要你补充一点信息',
}

const COMPOSE_DONE: Record<string, string> = {
  recommend: '写好推荐理由',
  refine: '写好筛选说明',
  compare: '写好对比总结',
  product_detail: '整理好详细介绍',
}

export function startThinking(): Thinking {
  return { startedAt: Date.now(), steps: [] }
}

/** A new status phase finishes the previous step and opens the next one. */
export function onStatus(t: Thinking, ev: StatusEventData): Thinking {
  const phase = ev.phase as ThinkingPhase
  const steps = t.steps.map((s) => ({ ...s, finished: true }))
  const last = steps[steps.length - 1]
  if (last?.phase === phase) {
    steps[steps.length - 1] = { ...last, active: ev.message, finished: false }
  } else {
    steps.push({ phase, active: ev.message, finished: false, done: phase === 'compose' ? COMPOSE_DONE[t.tool ?? ''] : undefined })
  }
  return { ...t, steps }
}

export function onMeta(t: Thinking, ev: MetaEventData): Thinking {
  const d = ev.decision
  const understood = d.rewritten_query?.trim() || undefined
  const steps = t.steps.map((s) =>
    s.phase === 'routing' ? { ...s, done: understood ? `理解为：${understood}` : '识别了你的意图' } : s.phase === 'vision' ? { ...s, done: '识别了图片内容' } : s,
  )
  return { ...t, steps, understood, tool: d.tool, reason: peopleReason(d) }
}

export function onToolResult(t: Thinking, ev: ToolResultEventData): Thinking {
  const payload = ev.payload as { products?: unknown[]; comparison?: { products?: unknown[] }; debug?: { parsed?: Parsed } }
  const tool = t.tool ?? ev.tool_name
  const hitCount = Array.isArray(payload.products) ? payload.products.length : payload.comparison?.products?.length
  const parsed = payload.debug?.parsed
  const done = TOOL_DONE[tool]?.(hitCount)
  const steps = t.steps.map((s) => (s.phase === 'tool' && done ? { ...s, done } : s))
  return {
    ...t,
    steps,
    hitCount,
    ...(parsed ? { parsed } : {}),
  }
}

export function finishThinking(t: Thinking): Thinking {
  return { ...t, finishedAt: t.finishedAt ?? Date.now(), steps: t.steps.map((s) => ({ ...s, finished: true })) }
}

export function conditionsOf(p: Parsed): ThinkingCondition[] {
  const out: ThinkingCondition[] = []
  const what = p.sub_category || p.category
  if (what) out.push({ key: 'subject', label: what, removable: false })
  if (p.max_price != null && p.min_price != null) out.push({ key: 'price', label: `¥${p.min_price}–${p.max_price}`, removable: true })
  else if (p.max_price != null) out.push({ key: 'price', label: `≤ ¥${p.max_price}`, removable: true })
  else if (p.min_price != null) out.push({ key: 'price', label: `≥ ¥${p.min_price}`, removable: true })
  for (const n of p.negative_ingredients ?? []) out.push({ key: `neg:${n}`, label: `不含${n}`, removable: true })
  for (const b of p.brand_include ?? []) out.push({ key: `brand:${b}`, label: `只看${b}`, removable: true })
  for (const b of p.brand_exclude ?? []) out.push({ key: `nobrand:${b}`, label: `不要${b}`, removable: true })
  for (const s of p.soft_terms ?? []) out.push({ key: `soft:${s}`, label: s, removable: true })
  return out
}

/** The router's sentence, unless it is one of the English diagnostic strings. */
function peopleReason(d: IntentDecision): string | undefined {
  const r = d.reasoning?.trim()
  if (!r || !/[一-鿿]/.test(r) || /guard|fallback|mock|router|pending/i.test(r)) return undefined
  // The router often ends with 「…，走 recommend。」; drop clauses that name a tool.
  const clauses = r.split(/[，,。；;]/).map((c) => c.trim()).filter((c) => c && !/[a-z_]{3,}/i.test(c))
  return clauses.length ? `${clauses.join('，')}。` : undefined
}

export function elapsed(t: Thinking): string {
  const ms = (t.finishedAt ?? Date.now()) - t.startedAt
  return `${(ms / 1000).toFixed(1)}s`
}
