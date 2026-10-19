/**
 * Turns raw tool_result payloads into what the chat UI renders, following
 * RESTAgentService.dispatch in client/AIShoppingGuide/FrontendServices.swift:
 * spec selection first, then comparison, then cart snapshot, then product IDs.
 */
import type {
  CartSnapshot, CartToolPayload, Comparison, ComparePayload, ComposerJson, RecommendPayload, SpecDimension, ToolResultEventData,
} from './types'

export type ToolEffect =
  | { kind: 'specSelection'; productId: string; title: string; dimensions: SpecDimension[] }
  | { kind: 'comparison'; comparison: Comparison }
  | { kind: 'cart'; action: CartToolPayload['action']; cart: CartSnapshot | null }
  | { kind: 'products'; productIds: string[] }
  | { kind: 'none' }

const EMPTY_CART: CartSnapshot = { lines: [], item_count: 0, total: 0 }

export function interpretToolResult(tr: ToolResultEventData): ToolEffect {
  if (tr.tool_name === 'cart') {
    const p = tr.payload as CartToolPayload
    if (p.action === 'ask_spec') {
      const dims = (p.dimensions ?? []).filter((d) => d.name && d.values?.length)
      if (p.product_id && dims.length) return { kind: 'specSelection', productId: p.product_id, title: p.title ?? '', dimensions: dims }
    }
    if (p.action === 'checkout') return { kind: 'cart', action: p.action, cart: EMPTY_CART }
    if ('cart' in p && p.cart && Array.isArray(p.cart.lines)) return { kind: 'cart', action: p.action, cart: p.cart }
    return { kind: 'cart', action: p.action, cart: null }
  }
  if (tr.tool_name === 'compare') {
    const p = tr.payload as ComparePayload
    if (p.comparison) return { kind: 'comparison', comparison: p.comparison }
    return { kind: 'none' }
  }
  const products = (tr.payload as RecommendPayload).products
  if (Array.isArray(products)) {
    const ids = products.map((c) => c.product_id).filter(Boolean)
    if (ids.length) return { kind: 'products', productIds: ids }
  }
  return { kind: 'none' }
}

/**
 * The composer returns JSON for recommend-style tools and plain text otherwise
 * (narrative_override, product_detail). Mirrors StructuredContent.parse on iOS,
 * which also accepts the older `questions` key for follow-ups.
 */
export function parseComposerJson(text: string): ComposerJson | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const obj = JSON.parse(trimmed) as Partial<ComposerJson> & { questions?: string[] }
    if (typeof obj.opening !== 'string' || !Array.isArray(obj.items)) return null
    return {
      opening: obj.opening,
      items: obj.items.filter((i) => i && typeof i.productId === 'string'),
      followup: Array.isArray(obj.followup) ? obj.followup : Array.isArray(obj.questions) ? obj.questions : [],
    }
  } catch {
    return null
  }
}
