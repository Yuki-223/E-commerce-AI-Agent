/**
 * Scripted stand-in for agent/orchestrator.py. It answers a handful of intents
 * with real catalog data and emits the same event sequence as handle_turn_stream:
 *
 *   session → status(routing) → meta → status(tool) → tool_result
 *           → status(compose)? → token → memory_update* → done
 *
 * No model is involved; wording follows the backend's fixed copy where it has some
 * (narrative_override strings, status messages) and the composer JSON otherwise.
 */
import type {
  CartToolPayload, ChatRequest, ComposerJson, IntentDecision, ProductCard, SseEvent, ToolResultEventData,
} from '../api/types'
import { buildComparison, catalog, compareTagline, getProductDetail, priceDisplay, type ProductDetail } from './catalog'
import { extractPreferenceUpdates } from './memory'
import { mockCtl } from './controls'
import { CartNotFoundError, cartStore, preferenceStore, sessionStore, type MockSession } from './state'

const TOOL_WORKING_HINT: Record<string, string> = {
  recommend: '正在为你检索商品…',
  refine: '正在重新筛选…',
  compare: '正在对比商品…',
  product_detail: '正在查看商品详情…',
  cart: '正在处理购物车…',
  clarify: '正在整理追问…',
}
const TOOL_COMPOSE_HINT: Record<string, string> = {
  recommend: '正在生成推荐解说…',
  refine: '正在生成筛选说明…',
  compare: '正在生成对比总结…',
  product_detail: '正在生成详细介绍…',
}

/** One scripted step: an event plus how long to wait before sending it. */
export interface Step {
  delay: number
  event: SseEvent
}

interface ToolOutcome {
  decision: IntentDecision
  result: ToolResultEventData
  /** Narrative text; for composer tools this is the JSON document. */
  narrative: string
}

const ORDINALS: Record<string, number> = { 一: 0, 1: 0, 二: 1, 两: 1, 2: 1, 三: 2, 3: 2, 四: 3, 4: 3, 五: 4, 5: 4 }

function ordinalIndex(q: string): number | null {
  const m = q.match(/第\s*([一二两三四五12345])\s*[个款件双支]?/)
  if (m) return ORDINALS[m[1]]
  if (/最后一[个款件]/.test(q)) return -1
  return null
}

function card(d: ProductDetail): ProductCard {
  return {
    product_id: d.product_id,
    title: d.title,
    brand: d.brand,
    category: d.category,
    sub_category: d.sub_category,
    price: d.base_price,
    price_display: priceDisplay(d.price_range),
  }
}

/** Mentions alcohol other than to say it is absent (marketing copy and FAQ only). */
function mentionsAlcohol(d: ProductDetail): boolean {
  const text = [d.marketing_description, ...d.faqs.map((f) => f.answer)].join('\n')
  const stripped = text.replace(/(不含|无|没有|零|0)\s*(添加)?\s*酒精/g, '')
  return /酒精/.test(stripped)
}

const CATEGORY_WORDS: [RegExp, string][] = [
  [/数码|电子/, '数码电子'],
  [/美妆|护肤|化妆/, '美妆护肤'],
  [/服饰|运动|衣服|鞋/, '服饰运动'],
  [/食品|饮料|零食|吃|喝/, '食品饮料'],
]

function search(query: string, userId: string | null | undefined) {
  const pref = userId ? preferenceStore.get(userId) : null
  const usePref = pref?.personalization_enabled ?? false
  const priceMatch = query.match(/(\d{2,6})\s*(?:元|块)?\s*(?:以内|以下|之内)/)
  const maxPrice = priceMatch ? Number(priceMatch[1]) : usePref && pref?.budget_max ? pref.budget_max : null
  const noAlcohol = /(不要|不含|无|没有)\s*(含)?\s*酒精/.test(query)
  const excluded = new Set(usePref ? pref?.brand_exclude ?? [] : [])

  const scored = catalog
    .map((d) => {
      let score = 0
      if (d.sub_category && query.includes(d.sub_category)) score += 6
      for (const tok of d.brand.split(/\s+/)) if (tok.length >= 2 && query.includes(tok)) score += 5
      for (const [re, cat] of CATEGORY_WORDS) if (re.test(query) && d.category === cat) score += 2
      // Shared two-character runs between query and title as a weak lexical signal.
      for (let i = 0; i < query.length - 1; i++) {
        const bi = query.slice(i, i + 2)
        if (/[一-鿿]{2}/.test(bi) && d.title.includes(bi)) score += 1
      }
      return { d, score }
    })
    .filter(({ d, score }) => {
      if (score < 3) return false
      if (maxPrice != null && d.price_range.min_price > maxPrice) return false
      if (noAlcohol && mentionsAlcohol(d)) return false
      if ([...excluded].some((b) => d.brand.includes(b))) return false
      return true
    })
    .sort((a, b) => b.score - a.score || a.d.price_range.min_price - b.d.price_range.min_price)
  const top = scored.slice(0, 4).map((x) => x.d)
  return { hits: top, maxPrice, noAlcohol }
}

function itemDescription(d: ProductDetail): string {
  const sellingPoint = compareTagline(d.product_id)
  const desc = (d.marketing_description.split(/[。！]/)[1] || d.marketing_description).trim()
  const brief = desc.replace(d.brand, '').slice(0, 26)
  return sellingPoint ? `${brief}，适合${sellingPoint}` : brief
}

function recommend(query: string, session: MockSession, userId: string | null | undefined): ToolOutcome {
  const { hits, maxPrice, noAlcohol } = search(query, userId)
  session.last_products = hits.map((d) => ({ product_id: d.product_id, title: d.title }))
  const sub = hits[0]?.sub_category ?? ''
  const limits = [maxPrice != null ? `${maxPrice} 元以内` : '', noAlcohol ? '不含酒精' : ''].filter(Boolean).join('、')
  const composer: ComposerJson = hits.length
    ? {
        opening: noAlcohol
          ? `已帮你排除含酒精的款，为你推荐了 ${hits.length} 款${limits ? `${limits}的` : ''}${sub}`
          : `为你推荐了 ${hits.length} 款${limits ? `${limits}的` : ''}${sub || '商品'}`,
        items: hits.map((d) => ({ productId: d.product_id, description: itemDescription(d) })),
        followup:
          sub === '防晒'
            ? ['敏感肌更推荐哪一款？', '有没有 200 元以内的？', '对比一下这两款']
            : ['推荐一些更平价的选择', `推荐其他品牌的${sub || '商品'}`, '对比一下刚才推荐的两款'],
      }
    : {
        opening: '抱歉，暂时没有找到完全符合条件的商品',
        items: [],
        followup: ['预算放宽一些再推荐', '换个品牌看看', '重新帮我推荐'],
      }
  return {
    decision: { tool: 'recommend', rewritten_query: query, confidence: 'high', reasoning: 'mock: product search' },
    result: {
      tool_name: 'recommend',
      payload: {
        query,
        products: hits.map(card),
        summary: { hit_count: hits.length, needs_clarification: false, category: hits[0]?.category ?? null },
        debug: { parsed: { max_price: maxPrice, negative_ingredients: noAlcohol ? ['酒精'] : [] } },
      },
      composer_hint: null,
      narrative_override: null,
      needs_composer: true,
    },
    narrative: JSON.stringify(composer),
  }
}

function cartResult(payload: CartToolPayload, narrative: string, needsComposer = false): ToolOutcome {
  return {
    decision: { tool: 'cart', rewritten_query: '', confidence: 'high', reasoning: 'mock: cart operation' },
    result: { tool_name: 'cart', payload, composer_hint: null, narrative_override: needsComposer ? null : narrative, needs_composer: needsComposer },
    narrative,
  }
}

/** Dimensions with more than one value, numeric-sorted like CartTool._varying_dims. */
function varyingDims(d: ProductDetail): Record<string, string[]> {
  const dims: Record<string, string[]> = {}
  for (const sku of d.skus) {
    for (const [k, v] of Object.entries(sku.properties)) {
      dims[k] ??= []
      if (!dims[k].includes(v)) dims[k].push(v)
    }
  }
  const out: Record<string, string[]> = {}
  for (const [k, vs] of Object.entries(dims)) {
    if (vs.length < 2) continue
    const nums = vs.map((v) => v.match(/\d+/))
    out[k] = nums.every(Boolean) ? [...vs].sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0])) : vs
  }
  return out
}

function commitAdd(d: ProductDetail, skuId: string, qty = 1): ToolOutcome {
  const line = cartStore.addProduct(d.product_id, skuId, qty)
  const snapshot = cartStore.snapshot()
  const spec = Object.entries(line.options).map(([k, v]) => `${k}${v}`).join('、')
  const text = `已把「${line.title}」${spec ? `（${spec}）` : ''}加入购物车，数量 ${line.quantity}。购物车现共 ${snapshot.cart.item_count} 件，合计 ${snapshot.cart.total} 元。`
  return cartResult({ action: 'add', added: line, ...snapshot }, text)
}

function addToCart(query: string, session: MockSession): ToolOutcome {
  let target: { product_id: string; title: string } | undefined
  const idx = ordinalIndex(query)
  const last = session.last_products
  if (idx != null) target = idx === -1 ? last[last.length - 1] : last[idx]
  target ??= last.find((p) => {
    const d = getProductDetail(p.product_id)
    return d?.brand.split(/\s+/).some((t) => t.length >= 2 && query.includes(t))
  })
  if (!target && last.length === 1) target = last[0]
  if (!target) {
    return cartResult({ action: 'noop' }, '想把哪款加进来呀？可以说「把第一个加入购物车」，或者先让我推荐几款。')
  }
  const d = getProductDetail(target.product_id)!
  const dims = varyingDims(d)
  const chosen = d.skus.filter((s) => Object.entries(s.properties).every(([k, v]) => !dims[k] || query.includes(v)))
  if (Object.keys(dims).length === 0 || chosen.length === 1) {
    session.pending_add = undefined
    return commitAdd(d, (chosen[0] ?? d.skus[0]).sku_id)
  }
  session.pending_add = { product_id: d.product_id, title: d.title }
  return cartResult(
    {
      action: 'ask_spec',
      product_id: d.product_id,
      title: d.title,
      dimensions: Object.entries(dims).map(([name, values]) => ({ name, values })),
      options: dims,
    },
    `已理解为把「${d.title}」加入购物车。这款有多个规格可选，下面选一下你想要的款式吧～`,
  )
}

function resolvePendingSpec(query: string, session: MockSession): ToolOutcome | null {
  const pending = session.pending_add
  if (!pending) return null
  const d = getProductDetail(pending.product_id)
  if (!d) return null
  const dims = varyingDims(d)
  const matched = d.skus.filter((s) => Object.entries(s.properties).every(([k, v]) => !dims[k] || query.includes(v)))
  if (matched.length !== 1) return null
  session.pending_add = undefined
  return commitAdd(d, matched[0].sku_id)
}

function compare(query: string, session: MockSession): ToolOutcome {
  const ids = session.last_products.map((p) => p.product_id)
  const details = ids.slice(0, 2).map((id) => getProductDetail(id)).filter((d): d is ProductDetail => Boolean(d))
  const decision: IntentDecision = { tool: 'compare', rewritten_query: query, confidence: 'high', reasoning: 'mock: compare last hits' }
  if (details.length < 2) {
    const text = '先告诉我想对比哪两款，或者先让我推荐几款再对比～'
    return { decision, result: { tool_name: 'compare', payload: { action: 'compare', comparison: null }, narrative_override: text, needs_composer: false }, narrative: text }
  }
  const comparison = buildComparison(details)
  const titles = comparison.products.map((p) => Array.from(p.title).slice(0, 14).join('')).join('」「')
  const text = `已为你对比「${titles}」，下面是各维度对照，可按自己看重的方面来选～`
  return { decision, result: { tool_name: 'compare', payload: { action: 'compare', comparison }, narrative_override: text, needs_composer: false }, narrative: text }
}

function productDetail(query: string, session: MockSession): ToolOutcome | null {
  const idx = ordinalIndex(query) ?? 0
  const ref = session.last_products[idx === -1 ? session.last_products.length - 1 : idx]
  const d = ref && getProductDetail(ref.product_id)
  if (!d) return null
  const good = d.reviews.filter((r) => r.polarity === 'positive').length
  const bad = d.reviews.filter((r) => r.polarity === 'negative').length
  const sensitive = /敏感/.test(query)
  const text = sensitive
    ? `从现有评价和 FAQ 看，${d.brand}这款${d.sub_category ?? ''}${bad ? `有 ${bad} 条差评提到不适，` : '未见集中差评，'}建议敏感肌先在耳后或手臂内侧试用，确认没有泛红刺痛再上脸。`
    : `✨ 总结：共 ${d.reviews.length} 条评价，好评 ${good} 条、差评 ${bad} 条。\n🌟 优点：${d.reviews.find((r) => r.polarity === 'positive')?.content.slice(0, 40) ?? '正向信息不多'}\n🔍 缺点：${d.reviews.find((r) => r.polarity === 'negative')?.content.slice(0, 40) ?? '未见集中差评'}`
  return {
    decision: { tool: 'product_detail', rewritten_query: query, confidence: 'high', reasoning: 'mock: detail follow-up' },
    result: {
      tool_name: 'product_detail',
      payload: { query, product: card(d), focus_aspect: sensitive ? 'general' : 'reviews' },
      composer_hint: null,
      narrative_override: null,
      needs_composer: true,
    },
    narrative: text,
  }
}

function route(query: string, session: MockSession, userId: string | null | undefined): ToolOutcome {
  const pending = resolvePendingSpec(query, session)
  if (pending) return pending
  if (/(加入|加到|放进|加)\s*(购物车|购物袋)|加购/.test(query)) return addToCart(query, session)
  if (/购物车/.test(query)) {
    const snapshot = cartStore.snapshot()
    if (/(删|移除|去掉|不要)/.test(query) && snapshot.cart.lines.length) {
      const i = Math.max(0, (ordinalIndex(query) ?? 0) === -1 ? snapshot.cart.lines.length - 1 : ordinalIndex(query) ?? 0)
      const line = snapshot.cart.lines[Math.min(i, snapshot.cart.lines.length - 1)]
      cartStore.removeItem(line.cart_item_id)
      const after = cartStore.snapshot()
      return cartResult({ action: 'remove', removed: line, ...after }, `已把「${line.title}」从购物车删除，还剩 ${after.cart.item_count} 件，合计 ${after.cart.total} 元。`, true)
    }
    if (!snapshot.cart.lines.length) return cartResult({ action: 'noop' }, '你的购物车还是空的，先让我帮你推荐几款吧～')
    const list = snapshot.cart.lines.map((l) => `${l.title.slice(0, 14)} × ${l.quantity}，小计 ${l.subtotal} 元`).join('；')
    return cartResult({ action: 'view', ...snapshot }, `购物车里有：${list}。合计 ${snapshot.cart.total} 元，需要帮你下单吗？`, true)
  }
  if (/对比|比较|比一比|哪个好|哪款好/.test(query) && session.last_products.length >= 2) return compare(query, session)
  const newSearch = /推荐(一|几|些)|找|有没有|想买|来几款/.test(query)
  if (session.last_products.length && !newSearch && /评价|口碑|怎么样|敏感肌|哪一款|好用吗|详情/.test(query)) {
    const detail = productDetail(query, session)
    if (detail) return detail
  }
  return recommend(query, session, userId)
}

function visualSearch(req: ChatRequest, session: MockSession, userId: string | null | undefined): ToolOutcome {
  const hint = (req.query ?? '').trim()
  // The mock cannot see the picture; it treats it as a sunscreen photo plus the text hint.
  const outcome = recommend(`防晒 ${hint}`, session, userId)
  outcome.decision = { tool: 'recommend', rewritten_query: `防晒霜 ${hint}`.trim(), confidence: 'high', reasoning: 'image visual search' }
  const composer = JSON.parse(outcome.narrative) as ComposerJson
  composer.opening = `根据图片为你找到了 ${composer.items.length} 款相似的防晒`
  outcome.narrative = JSON.stringify(composer)
  ;(outcome.result.payload as Record<string, unknown>).summary = { hit_count: composer.items.length, needs_clarification: false, source: 'visual_search' }
  return outcome
}

/** Build the full scripted event list for one /chat/stream request. */
export function scriptTurn(req: ChatRequest): Step[] {
  const session = sessionStore.getOrCreate(req.session_id)
  const userId = req.user_id?.trim() || null
  const image = req.image_base64 || req.image_url
  const query = (req.query ?? '').trim()
  const steps: Step[] = [{ delay: 30, event: { event: 'session', data: { session_id: session.session_id } } }]

  if (mockCtl.consumeFailure()) {
    steps.push({ delay: 400, event: { event: 'status', data: { phase: 'routing', message: '识别意图中…' } } })
    steps.push({ delay: 600, event: { event: 'error', data: { message: 'APITimeoutError: Request timed out.' } } })
    sessionStore.save(session)
    return steps
  }

  let outcome: ToolOutcome
  if (image) {
    steps.push({ delay: 200, event: { event: 'status', data: { phase: 'vision', message: '正在识别图片…' } } })
    outcome = visualSearch(req, session, userId)
    steps.push({ delay: 900, event: { event: 'meta', data: { decision: outcome.decision, trace: { timings: { vision_ms: 880 }, extracted_query: outcome.decision.rewritten_query } } } })
    steps.push({ delay: 20, event: { event: 'status', data: { phase: 'tool', tool: 'recommend', message: '正在按图找相似商品…' } } })
  } else {
    steps.push({ delay: 200, event: { event: 'status', data: { phase: 'routing', message: '识别意图中…' } } })
    try {
      outcome = route(query, session, userId)
    } catch (err) {
      if (!(err instanceof CartNotFoundError)) throw err
      outcome = cartResult({ action: 'noop' }, err.message)
    }
    steps.push({ delay: 450, event: { event: 'meta', data: { decision: outcome.decision, trace: { timings: { router_ms: 440 } } } } })
    steps.push({
      delay: 20,
      event: { event: 'status', data: { phase: 'tool', tool: outcome.decision.tool, message: TOOL_WORKING_HINT[outcome.decision.tool] ?? '处理中…' } },
    })
  }

  steps.push({ delay: 650, event: { event: 'tool_result', data: outcome.result } })
  if (outcome.result.needs_composer) {
    steps.push({ delay: 30, event: { event: 'status', data: { phase: 'compose', message: TOOL_COMPOSE_HINT[outcome.decision.tool] ?? '正在生成回复…' } } })
  }
  // compose_stream buffers the model output and yields one normalized chunk.
  steps.push({ delay: outcome.result.needs_composer ? 1100 : 60, event: { event: 'token', data: outcome.narrative } })

  if (!image || query) {
    for (const update of extractPreferenceUpdates(query, userId)) {
      const ev = preferenceStore.applyUpdate(userId!, update)
      if (ev) steps.push({ delay: 20, event: { event: 'memory_update', data: ev } })
    }
  }
  steps.push({ delay: 20, event: { event: 'done', data: { timings: { composer_ms: 1100 }, narrative: outcome.narrative, trace: { timings: {} } } } })
  sessionStore.save(session)
  return steps
}
